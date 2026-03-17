import { YoutubeTranscript } from 'youtube-transcript';
import * as fs from 'fs';
import * as path from 'path';

interface LessonIndex {
  lesson: number;
  videoId: string;
  title: string;
}

async function fetchTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
  return segments.map((s) => s.text).join(' ');
}

async function main(): Promise<void> {
  const indexPath = path.join(process.cwd(), 'lessons', 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ lessons/index.json not found. Run npm run fetch-playlist first.');
    process.exit(1);
  }

  const isTest = process.argv.includes('--test');
  if (isTest) console.log('🧪 Test mode: processing first 3 lessons only');

  const lessons = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as LessonIndex[];
  const lessonsToProcess = lessons.slice(0, isTest ? 3 : lessons.length);
  console.log(`📚 Loaded ${lessons.length} lessons from index.json\n`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const lesson of lessonsToProcess) {
    const padded = String(lesson.lesson).padStart(3, '0');
    const outputDir = path.join(process.cwd(), 'lessons', padded);
    const transcriptPath = path.join(outputDir, 'transcript.txt');

    if (fs.existsSync(transcriptPath)) {
      const size = fs.readFileSync(transcriptPath, 'utf-8').length;
      console.log(`⏭ lesson-${padded}: already cached (${size} chars)`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`⬇️  lesson-${padded}: fetching...`);
      const transcript = await fetchTranscript(lesson.videoId);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(transcriptPath, transcript, 'utf-8');
      console.log(` ✅ saved (${transcript.length} chars)`);
      succeeded++;
    } catch (err) {
      console.log(` ❌`);
      console.error(`   Error: ${err}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ✅ ${succeeded} fetched / ⏭ ${skipped} skipped / ❌ ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
