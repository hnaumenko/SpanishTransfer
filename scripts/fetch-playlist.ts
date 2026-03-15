import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface YtDlpEntry {
  id: string;
  title: string;
}

interface YtDlpPlaylist {
  entries: YtDlpEntry[];
}

interface LessonIndex {
  lesson: number;
  videoId: string;
  title: string;
}

function main(): void {
  const playlistUrl = process.env.YOUTUBE_PLAYLIST_URL;
  if (!playlistUrl) {
    console.error('❌ YOUTUBE_PLAYLIST_URL is not set in .env');
    process.exit(1);
  }

  console.log('🎬 Fetching playlist metadata...');
  console.log(`📋 URL: ${playlistUrl}`);

  let rawOutput: string;
  try {
    rawOutput = execSync(`yt-dlp --flat-playlist -J "${playlistUrl}"`, {
      maxBuffer: 50 * 1024 * 1024,
    }).toString();
  } catch (err) {
    console.error('❌ yt-dlp failed. Make sure yt-dlp is installed: brew install yt-dlp');
    console.error(err);
    process.exit(1);
  }

  const playlist = JSON.parse(rawOutput) as YtDlpPlaylist;
  const entries = playlist.entries;

  if (!entries || entries.length === 0) {
    console.error('❌ No entries found in playlist');
    process.exit(1);
  }

  console.log(`📦 Found ${entries.length} videos in playlist`);

  const lessons: LessonIndex[] = entries.map((entry, i) => ({
    lesson: i + 1,
    videoId: entry.id,
    title: entry.title,
  }));

  const outputDir = path.join(process.cwd(), 'lessons');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'index.json');
  fs.writeFileSync(outputPath, JSON.stringify(lessons, null, 2), 'utf-8');

  console.log(`✅ Saved ${lessons.length} lessons to lessons/index.json`);
  console.log(`📍 First: "${lessons[0].title}" (${lessons[0].videoId})`);
  console.log(`📍 Last:  "${lessons[lessons.length - 1].title}" (${lessons[lessons.length - 1].videoId})`);
}

main();
