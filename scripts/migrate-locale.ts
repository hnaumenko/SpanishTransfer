import * as fs from 'fs';
import * as path from 'path';

function main(): void {
  const lessonsDir = path.join(process.cwd(), 'lessons');
  if (!fs.existsSync(lessonsDir)) {
    console.log('ℹ️  No lessons/ directory found. Nothing to do.');
    return;
  }

  const entries = fs.readdirSync(lessonsDir).filter((e) => {
    const full = path.join(lessonsDir, e);
    return fs.statSync(full).isDirectory();
  });

  let renamed = 0;

  for (const entry of entries) {
    const dir = path.join(lessonsDir, entry);

    const messageSrc = path.join(dir, 'message.md');
    const messageDst = path.join(dir, 'message.uk.md');
    if (fs.existsSync(messageSrc) && !fs.existsSync(messageDst)) {
      fs.renameSync(messageSrc, messageDst);
      console.log(`✅ Renamed lesson-${entry}/message.md → message.uk.md`);
      renamed++;
    }

    const examplesSrc = path.join(dir, 'examples.json');
    const examplesDst = path.join(dir, 'examples.uk.json');
    if (fs.existsSync(examplesSrc) && !fs.existsSync(examplesDst)) {
      fs.renameSync(examplesSrc, examplesDst);
      console.log(`✅ Renamed lesson-${entry}/examples.json → examples.uk.json`);
      renamed++;
    }
  }

  if (renamed === 0) {
    console.log('ℹ️  No files to rename. All already migrated or nothing exists.');
  } else {
    console.log(`\n✅ Renamed ${renamed} files total`);
  }
}

main();
