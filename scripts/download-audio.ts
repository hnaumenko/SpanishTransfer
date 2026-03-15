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

  const lessons = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as LessonIndex[];
  console.log(`📚 Loaded ${lessons.length} lessons from index.json`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const lesson of lessons) {
    const padded = String(lesson.lesson).padStart(3, '0');
    const audioPath = path.join(process.cwd(), 'lessons', padded, 'audio.mp3');

    if (fs.existsSync(audioPath)) {
      console.log(`⏭ lesson-${padded} already exists, skipping`);
      skipped++;
      continue;
    }

    const outputDir = path.join(process.cwd(), 'lessons', padded);
    fs.mkdirSync(outputDir, { recursive: true });

    const videoUrl = `https://youtube.com/watch?v=${lesson.videoId}`;
    const outputTemplate = path.join(outputDir, 'audio%(ext)s');

    console.log(`⬇️  Downloading lesson ${padded}: ${lesson.title}`);

    try {
      execSync(`yt-dlp -x --audio-format mp3 -o "${outputTemplate}" "${videoUrl}"`, {
        stdio: 'pipe',
      });
      console.log(`✅ Done lesson-${padded}`);
      succeeded++;
    } catch (err) {
      console.error(`❌ Failed lesson-${padded}: ${err}`);
      failed++;
    }

    // Avoid rate limiting between downloads
    if (lesson.lesson < lessons.length) {
      await sleep(2000);
    }
  }

  console.log(`\n📊 Summary: ✅ ${succeeded} downloaded / ⏭ ${skipped} skipped / ❌ ${failed} failed`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
