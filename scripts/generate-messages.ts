import Anthropic from '@anthropic-ai/sdk';
import { YoutubeTranscript } from 'youtube-transcript';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { buildUkPrompt, buildEnPrompt, buildUkReminderPrompt, buildEnReminderPrompt } from './shared/prompt';

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

async function fetchTranscriptWithFallback(
  videoId: string,
  padded: string,
): Promise<string | null> {
  // Priority 1: English transcript
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    return segments.map((s) => s.text).join(' ');
  } catch {
    console.log(`   ⚠️  No English transcript, trying Greek...`);
  }

  // Priority 2: Greek transcript (saved as-is, no translation)
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'el' });
    const text = segments.map((s) => s.text).join(' ');
    const outputDir = path.join(process.cwd(), 'lessons', padded);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'transcript.el.txt'), text, 'utf-8');
    console.log(`   🇬🇷 Saved Greek transcript (${text.length} chars)`);
    return text;
  } catch (err) {
    console.error(`   ❌ Greek transcript also failed: ${err}`);
    return null;
  }
}

function loadNextTranscript(lessonNumber: number): string {
  const nextPadded = String(lessonNumber + 1).padStart(3, '0');
  const nextDir = path.join(process.cwd(), 'lessons', nextPadded);
  const formattedPath = path.join(nextDir, 'transcript.formatted.txt');
  const plainPath = path.join(nextDir, 'transcript.txt');
  if (fs.existsSync(formattedPath)) return fs.readFileSync(formattedPath, 'utf-8');
  if (fs.existsSync(plainPath)) return fs.readFileSync(plainPath, 'utf-8');
  return '';
}

// Detects CJK and other unexpected Unicode blocks that indicate a generation artifact
function hasGarbledTokens(text: string): boolean {
  // CJK Unified Ideographs, CJK Extensions, Hangul, Hiragana, Katakana, Arabic, Hebrew
  return /[\u2E80-\u9FFF\uA000-\uA4FF\uAC00-\uD7FF\u0600-\u06FF\u0590-\u05FF]/.test(text);
}

function parseCustomId(id: string): { padded: string; filename: string } {
  const isReminder = id.startsWith('lesson-reminder-');
  const locale = id.includes('-uk-') ? 'uk' : 'en';
  const prefix = isReminder ? `lesson-reminder-${locale}-` : `lesson-${locale}-`;
  const padded = id.slice(prefix.length);
  const filename = isReminder ? `reminder.${locale}.md` : `message.${locale}.md`;
  return { padded, filename };
}

async function runRequests(
  client: Anthropic,
  requests: BatchRequest[],
  isTest: boolean,
): Promise<{ succeeded: number; failed: number }> {
  if (requests.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  if (isTest) {
    console.log(`\n🚀 Sending ${requests.length} requests via regular API (test mode)...`);
    for (const req of requests) {
      try {
        process.stdout.write(`⬇️  ${req.custom_id}...`);
        const response = await client.messages.create(req.params);
        const firstBlock = response.content[0];
        if (firstBlock.type !== 'text') {
          console.error(` ❌ unexpected content type ${firstBlock.type}`);
          failed++;
          continue;
        }
        let text = firstBlock.text.trim();
        text = text.replace(/^```(?:markdown)?\n/, '').replace(/\n```\s*$/, '').trim();
        if (hasGarbledTokens(text)) {
          console.error(` ❌ garbled tokens detected, skipping save`);
          failed++;
          continue;
        }
        const { padded, filename } = parseCustomId(req.custom_id);
        const outputDir = path.join(process.cwd(), 'lessons', padded);
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, filename), text, 'utf-8');
        console.log(` ✅ (${text.length} chars)`);
        succeeded++;
      } catch (err) {
        console.error(` ❌ ${err}`);
        failed++;
      }
    }
  } else {
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

    for await (const result of await client.messages.batches.results(batch.id)) {
      const id = result.custom_id;
      const { padded, filename } = parseCustomId(id);

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

      let text = firstBlock.text.trim();
      text = text.replace(/^```(?:markdown)?\n/, '').replace(/\n```\s*$/, '').trim();

      if (hasGarbledTokens(text)) {
        console.error(`❌ ${id}: garbled tokens detected, skipping save`);
        failed++;
        continue;
      }

      const outputDir = path.join(process.cwd(), 'lessons', padded);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(path.join(outputDir, filename), text, 'utf-8');
      console.log(`✅ Saved ${id} (${text.length} chars)`);
      succeeded++;
    }
  }

  return { succeeded, failed };
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
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const fromLesson = positional[0] ? parseInt(positional[0], 10) : 2;
  const toLesson = positional[1] ? parseInt(positional[1], 10) : 4;

  if (isTest) console.log(`🧪 Test mode: processing lessons ${fromLesson}–${toLesson}`);

  const lessons = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as LessonIndex[];

  if (isTest && !process.argv.includes('--no-clean')) {
    console.log('\n🗑  Cleaning generated files...');
    const filesToDelete = ['message.en.md', 'message.uk.md', 'reminder.en.md', 'reminder.uk.md'];
    for (const lesson of lessons.filter((l) => l.lesson >= fromLesson && l.lesson <= toLesson)) {
      const dir = path.join(process.cwd(), 'lessons', String(lesson.lesson).padStart(3, '0'));
      for (const file of filesToDelete) {
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath);
          console.log(`   🗑  Deleted ${path.relative(process.cwd(), filePath)}`);
        }
      }
    }
  }
  const lessonsToProcess = isTest
    ? lessons.filter((l) => l.lesson >= fromLesson && l.lesson <= toLesson)
    : lessons;
  console.log(`📚 Loaded ${lessons.length} lessons from index.json`);

  const client = new Anthropic({ apiKey });

  // ─── Phase 1: generate messages ──────────────────────────────────────────────

  console.log('\n📝 Fetching transcripts from YouTube...');
  const messageRequests: BatchRequest[] = [];
  let transcriptFailed = 0;

  for (const lesson of lessonsToProcess) {
    const padded = String(lesson.lesson).padStart(3, '0');
    const outputDir = path.join(process.cwd(), 'lessons', padded);

    const ukMessageExists = fs.existsSync(path.join(outputDir, 'message.uk.md'));
    const enMessageExists = fs.existsSync(path.join(outputDir, 'message.en.md'));

    if (ukMessageExists && enMessageExists) {
      console.log(`⏭ lesson-${padded}: messages exist, skipping phase 1`);
      continue;
    }

    if (lesson.videoId === 'ClG2KKF5v2M') {
      console.log(`⚠️  lesson-${padded}: deleted video, skipping`);
      transcriptFailed++;
      continue;
    }

    try {
      const transcriptPath = path.join(outputDir, 'transcript.txt');
      const transcriptElPath = path.join(outputDir, 'transcript.el.txt');
      let transcript: string;

      if (fs.existsSync(transcriptPath)) {
        transcript = fs.readFileSync(transcriptPath, 'utf-8');
        console.log(`📄 lesson-${padded}: loaded transcript from cache (${transcript.length} chars)`);
      } else if (fs.existsSync(transcriptElPath)) {
        transcript = fs.readFileSync(transcriptElPath, 'utf-8');
        console.log(`📄 lesson-${padded}: loaded Greek transcript from cache (${transcript.length} chars)`);
      } else {
        process.stdout.write(`⬇️  Fetching transcript for lesson-${padded}...`);
        const fetched = await fetchTranscriptWithFallback(lesson.videoId, padded);
        if (fetched === null) {
          transcriptFailed++;
          continue;
        }
        transcript = fetched;
        console.log(` ✅ (${transcript.length} chars)`);
        fs.mkdirSync(outputDir, { recursive: true });
        if (!fs.existsSync(transcriptElPath)) {
          fs.writeFileSync(transcriptPath, transcript, 'utf-8');
        }
      }

      const nextTranscript = loadNextTranscript(lesson.lesson);

      if (!ukMessageExists) {
        messageRequests.push({
          custom_id: `lesson-uk-${padded}`,
          params: {
            model: 'claude-sonnet-4-5',
            max_tokens: 2048,
            messages: [{ role: 'user', content: buildUkPrompt(lesson.lesson, transcript, nextTranscript) }],
          },
        });
      }

      if (!enMessageExists) {
        messageRequests.push({
          custom_id: `lesson-en-${padded}`,
          params: {
            model: 'claude-sonnet-4-5',
            max_tokens: 2048,
            messages: [{ role: 'user', content: buildEnPrompt(lesson.lesson, transcript, nextTranscript) }],
          },
        });
      }
    } catch (err) {
      console.log(` ❌`);
      console.error(`❌ Failed to fetch transcript for lesson-${padded}: ${err}`);
      transcriptFailed++;
    }
  }

  if (messageRequests.length === 0) {
    console.log('\n✅ All messages already generated.');
  }
  const phase1 = await runRequests(client, messageRequests, isTest);

  // ─── Phase 2: generate reminders ─────────────────────────────────────────────
  // Reminders read from the saved message files, so phase 1 must complete first.

  console.log('\n📝 Building reminder requests...');
  const reminderRequests: BatchRequest[] = [];

  for (const lesson of lessonsToProcess) {
    const padded = String(lesson.lesson).padStart(3, '0');
    const outputDir = path.join(process.cwd(), 'lessons', padded);

    const ukReminderExists = fs.existsSync(path.join(outputDir, 'reminder.uk.md'));
    const enReminderExists = fs.existsSync(path.join(outputDir, 'reminder.en.md'));

    if (ukReminderExists && enReminderExists) {
      console.log(`⏭ lesson-${padded}: reminders exist, skipping phase 2`);
      continue;
    }

    const ukMessagePath = path.join(outputDir, 'message.uk.md');
    const enMessagePath = path.join(outputDir, 'message.en.md');

    if (!fs.existsSync(ukMessagePath) || !fs.existsSync(enMessagePath)) {
      console.log(`⚠️  lesson-${padded}: message files missing, cannot generate reminders`);
      continue;
    }

    if (!ukReminderExists) {
      const lessonMessage = fs.readFileSync(ukMessagePath, 'utf-8');
      reminderRequests.push({
        custom_id: `lesson-reminder-uk-${padded}`,
        params: {
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: buildUkReminderPrompt(lesson.lesson, lessonMessage) }],
        },
      });
    }

    if (!enReminderExists) {
      const lessonMessage = fs.readFileSync(enMessagePath, 'utf-8');
      reminderRequests.push({
        custom_id: `lesson-reminder-en-${padded}`,
        params: {
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: buildEnReminderPrompt(lesson.lesson, lessonMessage) }],
        },
      });
    }
  }

  if (reminderRequests.length === 0) {
    console.log('\n✅ All reminders already generated.');
  }
  const phase2 = await runRequests(client, reminderRequests, isTest);

  const totalSucceeded = phase1.succeeded + phase2.succeeded;
  const totalFailed = transcriptFailed + phase1.failed + phase2.failed;
  console.log(`\n📊 Summary: ✅ ${totalSucceeded} succeeded / ❌ ${totalFailed} failed`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
