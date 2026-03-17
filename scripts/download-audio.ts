import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface LessonIndex {
  lesson: number;
  videoId: string;
  title: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const audioPath = path.join(outputDir, 'audio.en.mp3');

    if (fs.existsSync(audioPath)) {
      console.log(`⏭ lesson-${padded}: audio.en.mp3 already exists, skipping`);
      skipped++;
      continue;
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const videoUrl = `https://youtube.com/watch?v=${lesson.videoId}`;
    // yt-dlp will produce audio.en.mp3 directly via the output template
    const outputTemplate = path.join(outputDir, 'audio.en.%(ext)s');

    console.log(`⬇️  lesson-${padded}: ${lesson.title}`);

    try {
      execSync(`yt-dlp -x --audio-format mp3 -o "${outputTemplate}" "${videoUrl}"`, {
        stdio: 'pipe',
      });
      console.log(`✅ lesson-${padded}: saved audio.en.mp3`);
      succeeded++;
    } catch (err) {
      console.error(`❌ lesson-${padded}: ${err}`);
      failed++;
    }

    if (lesson.lesson < lessonsToProcess[lessonsToProcess.length - 1].lesson) {
      await sleep(2000);
    }
  }

  console.log(`\n📊 Summary: ✅ ${succeeded} downloaded / ⏭ ${skipped} skipped / ❌ ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
