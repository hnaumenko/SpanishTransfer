import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const LESSONS = ['005', '038', '043', '053', '061', '062', '077'];

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not set in .env');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  let succeeded = 0;
  let failed = 0;

  for (const padded of LESSONS) {
    const outputDir = path.join(process.cwd(), 'lessons', padded);
    const elPath = path.join(outputDir, 'transcript.el.txt');
    const enPath = path.join(outputDir, 'transcript.txt');

    if (fs.existsSync(enPath)) {
      console.log(`⏭ lesson-${padded}: transcript.txt already exists, skipping`);
      continue;
    }

    if (!fs.existsSync(elPath)) {
      console.error(`❌ lesson-${padded}: transcript.el.txt not found`);
      failed++;
      continue;
    }

    const greek = fs.readFileSync(elPath, 'utf-8');
    process.stdout.write(`🔄 lesson-${padded}: translating ${greek.length} chars...`);

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content:
              `Translate the following Greek text to English. ` +
              `Return only the translated text, no commentary.\n\n${greek}`,
          },
        ],
      });

      const firstBlock = response.content[0];
      if (firstBlock.type !== 'text') {
        console.log(` ❌ unexpected response type`);
        failed++;
        continue;
      }

      fs.writeFileSync(enPath, firstBlock.text, 'utf-8');
      console.log(` ✅ saved (${firstBlock.text.length} chars)`);
      succeeded++;
    } catch (err) {
      console.log(` ❌`);
      console.error(`   Error: ${err}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ✅ ${succeeded} translated / ❌ ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
