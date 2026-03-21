/**
 * Process lessons 005-090:
 * TASK 1: Rewrite final section of message.en.md and message.uk.md
 * TASK 2: Fix reminder.en.md and reminder.uk.md
 */
import * as fs from 'fs';
import * as path from 'path';

const LESSONS_DIR = path.join(process.cwd(), 'lessons');

const ESCAPE_CHARS = new Set(['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!', '\\']);

function escapeMdV2(text: string): string {
  let result = '';
  for (const ch of text) {
    if (ESCAPE_CHARS.has(ch)) result += '\\';
    result += ch;
  }
  return result;
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

function extractCoreRuleEn(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const titleMatch = firstLine.match(/\*Lesson \d+:?\s*([^*|]+?)(?:\*|\|)/);
  if (titleMatch && titleMatch[1].trim().length > 10) {
    return titleMatch[1].trim().replace(/\\/g, '');
  }
  const pipeMatch = firstLine.match(/\|\s*(.+)$/);
  if (pipeMatch && pipeMatch[1].trim().length > 10) return pipeMatch[1].trim().replace(/\\/g, '');
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines[1]) {
    let s = lines[1].replace(/\\/g, '').replace(/\*|_|`|\([^)]*\)/g, '').trim();
    if (s.length > 100) s = s.slice(0, 97) + '...';
    return s;
  }
  return 'Continue building your Spanish.';
}

function extractCoreRuleUk(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const titleMatch = firstLine.match(/\*Урок \d+:?\s*([^*|]+?)(?:\*|\|)/);
  if (titleMatch && titleMatch[1].trim().length > 10) {
    return titleMatch[1].trim().replace(/\\/g, '');
  }
  const pipeMatch = firstLine.match(/\|\s*(.+)$/);
  if (pipeMatch && pipeMatch[1].trim().length > 10) return pipeMatch[1].trim().replace(/\\/g, '');
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines[1]) {
    let s = lines[1].replace(/\\/g, '').replace(/\*|_|`|\([^)]*\)/g, '').trim();
    if (s.length > 100) s = s.slice(0, 97) + '...';
    return s;
  }
  return 'Продовжуй вивчати іспанську.';
}

function processMessageEn(lessonNum: number): void {
  const dir = path.join(LESSONS_DIR, pad(lessonNum));
  const file = path.join(dir, 'message.en.md');
  if (!fs.existsSync(file)) {
    console.log(`⏭️ Skip (missing): ${file}`);
    return;
  }

  let content = fs.readFileSync(file, 'utf-8');

  if (lessonNum === 90) {
    const newEnd = `You've reached the last lesson\\. The rest is practice\\.\n\n▶️ [Complete the course](https://t.me/SpanishMeBot?start=next_en)`;
    content = content.replace(/\*Next[^*]*\*[^\n]*\n\n▶️ \[Next lesson\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/s, newEnd);
    content = content.replace(/\*Next time:[^\n]*\n\n▶️ \[Next lesson\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/s, newEnd);
    content = content.replace(/Next lesson:[^\n]*\n\n▶️ \[Next lesson\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/s, newEnd);
    if (content.includes('▶️ [Next lesson]')) {
      content = content.replace(/\n\n▶️ \[Next lesson\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/, '\n\n' + newEnd);
    }
  } else {
    const nextPath = path.join(LESSONS_DIR, pad(lessonNum + 1), 'message.en.md');
    const teaser = fs.existsSync(nextPath)
      ? extractCoreRuleEn(fs.readFileSync(nextPath, 'utf-8'))
      : 'Continue building your Spanish.';
    const escaped = escapeMdV2(teaser);
    const newEnd = `Next: ${escaped}\n\n▶️ [Unlock next lesson](https://t.me/SpanishMeBot?start=next_en)`;

    // Match teaser line + link (teaser contains Next, *Next*, Next lesson, etc.)
    const oldBlock = /[^\n]*Next[^\n]*\n\s*\n▶️ \[(?:Next lesson|Unlock next lesson)\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/;
    if (oldBlock.test(content)) {
      content = content.replace(oldBlock, newEnd);
    } else {
      content = content.replace(/▶️ \[Next lesson\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/, newEnd);
      content = content.replace(/▶️ \[Unlock next lesson\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_en\)/, newEnd);
    }
  }

  fs.writeFileSync(file, content);
  console.log(`✅ message.en.md ${pad(lessonNum)}`);
}

function processMessageUk(lessonNum: number): void {
  const dir = path.join(LESSONS_DIR, pad(lessonNum));
  const file = path.join(dir, 'message.uk.md');
  if (!fs.existsSync(file)) {
    console.log(`⏭️ Skip (missing): ${file}`);
    return;
  }

  let content = fs.readFileSync(file, 'utf-8');

  if (lessonNum === 90) {
    const newEnd = `Це останній урок\\. Далі — тільки практика\\.\n\n▶️ [Завершити курс](https://t.me/SpanishMeBot?start=next_uk)`;
    content = content.replace(/\*¡Mucha suerte\!*[^\n]*\n\n▶️ \[Наступний урок\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_uk\)/s, newEnd);
    content = content.replace(/І якщо[^\n]*\n\n▶️ \[Наступний урок\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_uk\)/s, newEnd);
    if (content.includes('▶️ [Наступний урок]')) {
      content = content.replace(/\n\n▶️ \[Наступний урок\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_uk\)/, '\n\n' + newEnd);
    }
  } else {
    const nextPath = path.join(LESSONS_DIR, pad(lessonNum + 1), 'message.uk.md');
    const teaser = fs.existsSync(nextPath)
      ? extractCoreRuleUk(fs.readFileSync(nextPath, 'utf-8'))
      : 'Продовжуй вивчати іспанську.';
    const escaped = escapeMdV2(teaser);
    const newEnd = `Далі: ${escaped}\n\n▶️ [Дивитись наступний урок](https://t.me/SpanishMeBot?start=next_uk)`;

    const replaced = content.replace(
      /(?:У наступному уроці[^\n]*|Далі:[^\n]*|\*У наступному[^*]*\*|👉[^\n]*У наступному[^\n]*)\n\n▶️ \[Наступний урок\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_uk\)/s,
      newEnd,
    );
    if (replaced !== content) {
      content = replaced;
    } else {
      content = content.replace(
        /\n\n▶️ \[Наступний урок\]\(https:\/\/t\.me\/SpanishMeBot\?start=next_uk\)/,
        '\n\n' + newEnd,
      );
    }
  }

  fs.writeFileSync(file, content);
  console.log(`✅ message.uk.md ${pad(lessonNum)}`);
}

function fixReminder(filePath: string, lessonNum: number, lang: 'en' | 'uk'): void {
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️ Skip (missing): ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8').trim();

  const headerEn = `🌙 *Lesson ${lessonNum} — reminder*`;
  const headerUk = `🌙 *Урок ${lessonNum} — нагадування*`;

  if (lang === 'en') {
    content = content.replace(/^🌙\s*\*?Lesson\s*\d+[^\n]*/m, headerEn);
  } else {
    content = content.replace(/^🌙\s*\*?Урок\s*\d+[^\n]*/m, headerUk);
  }

  content = content.replace(/\n+$/, '\n');

  if (content.length > 400) {
    console.warn(`⚠️ ${filePath} exceeds 400 chars (${content.length})`);
  }

  fs.writeFileSync(filePath, content);
  console.log(`✅ reminder.${lang}.md ${pad(lessonNum)}`);
}

function main(): void {
  console.log('📝 TASK 1: Rewriting message final sections (005-090)\n');
  for (let n = 5; n <= 90; n++) {
    processMessageEn(n);
    processMessageUk(n);
  }

  console.log('\n📝 TASK 2: Fixing reminders (005-090)\n');
  for (let n = 5; n <= 90; n++) {
    const dir = path.join(LESSONS_DIR, pad(n));
    fixReminder(path.join(dir, 'reminder.en.md'), n, 'en');
    fixReminder(path.join(dir, 'reminder.uk.md'), n, 'uk');
  }

  console.log('\n✅ Done.');
}

main();
