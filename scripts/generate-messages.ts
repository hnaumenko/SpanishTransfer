import Anthropic from '@anthropic-ai/sdk';
import { YoutubeTranscript } from 'youtube-transcript';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { buildUkPrompt, buildEnPrompt, buildExamplesPrompt } from './shared/prompt';

dotenv.config();

interface LessonIndex {
  lesson: number;
  videoId: string;
  title: string;
}

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    messages: Array<{ role: 'user'; content: string }>;
  };
}

async function fetchTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
  return segments.map((s) => s.text).join(' ');
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not set in .env');
    process.exit(1);
  }

  const indexPath = path.join(process.cwd(), 'lessons', 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ lessons/index.json not found. Run npm run fetch-playlist first.');
    process.exit(1);
  }

  const isTest = process.argv.includes('--test');
  if (isTest) console.log('🧪 Test mode: processing first 3 lessons only');

  const lessons = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as LessonIndex[];
  const lessonsToProcess = lessons.slice(0, isTest ? 3 : lessons.length);
  console.log(`📚 Loaded ${lessons.length} lessons from index.json`);

  const client = new Anthropic({ apiKey });

  console.log('\n📝 Fetching transcripts from YouTube...');
  const requests: BatchRequest[] = [];
  let transcriptFailed = 0;

  for (const lesson of lessonsToProcess) {
    const padded = String(lesson.lesson).padStart(3, '0');
    const outputDir = path.join(process.cwd(), 'lessons', padded);

    const ukMessageExists = fs.existsSync(path.join(outputDir, 'message.uk.md'));
    const enMessageExists = fs.existsSync(path.join(outputDir, 'message.en.md'));
    const isFirstLesson = lesson.lesson === 1;
    const examplesExists = isFirstLesson || fs.existsSync(path.join(outputDir, 'examples.json'));

    if (ukMessageExists && enMessageExists && examplesExists) {
      console.log(`⏭ lesson-${padded}: all files exist, skipping`);
      continue;
    }

    try {
      process.stdout.write(`⬇️  Fetching transcript for lesson-${padded}...`);
      const transcript = await fetchTranscript(lesson.videoId);
      console.log(` ✅ (${transcript.length} chars)`);

      if (!ukMessageExists) {
        requests.push({
          custom_id: `lesson-uk-${padded}`,
          params: {
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: buildUkPrompt(lesson.lesson, transcript) }],
          },
        });
      }

      if (!enMessageExists) {
        requests.push({
          custom_id: `lesson-en-${padded}`,
          params: {
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: buildEnPrompt(lesson.lesson, transcript) }],
          },
        });
      }

      if (!examplesExists) {
        requests.push({
          custom_id: `examples-${padded}`,
          params: {
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            messages: [
              { role: 'user', content: buildExamplesPrompt(lesson.lesson, transcript) },
            ],
          },
        });
      }
    } catch (err) {
      console.log(` ❌`);
      console.error(`❌ Failed to fetch transcript for lesson-${padded}: ${err}`);
      transcriptFailed++;
    }
  }

  if (requests.length === 0) {
    console.log('\n✅ All lessons already generated. Nothing to do.');
    return;
  }

  console.log(`\n🚀 Sending batch of ${requests.length} requests to Claude API...`);

  const batch = await client.messages.batches.create({ requests });
  console.log(`📬 Batch created: ${batch.id}`);

  let status = await client.messages.batches.retrieve(batch.id);
  while (status.processing_status !== 'ended') {
    await new Promise<void>((resolve) => setTimeout(resolve, 15_000));
    status = await client.messages.batches.retrieve(batch.id);
    const counts = status.request_counts;
    console.log(
      `⏳ Processing: ${counts.succeeded + counts.errored}/${requests.length} done` +
        ` (✅ ${counts.succeeded} / ❌ ${counts.errored})`,
    );
  }

  console.log('\n💾 Saving results...');
  let succeeded = 0;
  let failed = transcriptFailed;

  for await (const result of await client.messages.batches.results(batch.id)) {
    const id = result.custom_id;
    // custom_id format: "lesson-uk-001", "lesson-en-001", "examples-001"
    const isExamples = id.startsWith('examples-');
    const locale = id.includes('-uk-') ? 'uk' : 'en';
    const padded = isExamples
      ? id.slice('examples-'.length)
      : id.startsWith('lesson-uk-')
        ? id.slice('lesson-uk-'.length)
        : id.slice('lesson-en-'.length);

    if (result.result.type !== 'succeeded') {
      const errorType =
        result.result.type === 'errored' ? result.result.error.type : result.result.type;
      console.error(`❌ ${id}: ${errorType}`);
      failed++;
      continue;
    }

    const firstBlock = result.result.message.content[0];
    if (firstBlock.type !== 'text') {
      console.error(`❌ ${id}: unexpected content type ${firstBlock.type}`);
      failed++;
      continue;
    }

    const text = firstBlock.text;
    const outputDir = path.join(process.cwd(), 'lessons', padded);
    fs.mkdirSync(outputDir, { recursive: true });

    if (isExamples) {
      try {
        // Strip markdown code block if Claude wrapped the JSON
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        JSON.parse(cleaned); // validate before saving
        fs.writeFileSync(path.join(outputDir, 'examples.json'), cleaned, 'utf-8');
        console.log(`✅ Saved ${id} (${cleaned.length} chars)`);
        succeeded++;
      } catch {
        console.error(`❌ ${id}: Claude returned invalid JSON`);
        failed++;
      }
    } else {
      const filename = `message.${locale}.md`;
      fs.writeFileSync(path.join(outputDir, filename), text, 'utf-8');
      console.log(`✅ Saved ${id} (${text.length} chars)`);
      succeeded++;
    }
  }

  console.log(`\n📊 Summary: ✅ ${succeeded} succeeded / ❌ ${failed} failed`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
