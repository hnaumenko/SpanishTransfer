import * as fs from 'fs';
import * as path from 'path';

const LESSONS_DIR = path.join(process.cwd(), 'lessons');

// All characters that must be escaped in Telegram MarkdownV2 when used literally
const MUST_ESCAPE = new Set<string>(
  ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!', '\\'],
);

interface ValidationError {
  line: number;
  col: number;
  char: string;
  lineContent: string;
}

function lineInfo(
  content: string,
  pos: number,
): { line: number; col: number; lineContent: string } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < pos; i++) {
    if (content[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  let lineEnd = lineStart;
  while (lineEnd < content.length && content[lineEnd] !== '\n') lineEnd++;
  return { line, col: pos - lineStart + 1, lineContent: content.substring(lineStart, lineEnd) };
}

function validate(content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const n = content.length;

  const addError = (pos: number, char: string) => {
    errors.push({ ...lineInfo(content, pos), char });
  };

  let i = 0;
  while (i < n) {
    const ch = content[i];

    if (ch === '\n') {
      i++;
      continue;
    }

    // Escape sequence: \X where X is any char
    if (ch === '\\') {
      const next = content[i + 1];
      if (next !== undefined) {
        // \\ is a valid escaped backslash; any other \X also skips 2 chars
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // Code block ```...``` — content inside is exempt from escaping
    if (content.startsWith('```', i)) {
      i += 3;
      const close = content.indexOf('```', i);
      i = close !== -1 ? close + 3 : n;
      continue;
    }

    // Inline code `...` — content inside is exempt
    if (ch === '`') {
      i++;
      while (i < n && content[i] !== '`' && content[i] !== '\n') i++;
      if (i < n && content[i] === '`') i++;
      continue;
    }

    // Link [text](url) — skip URL part (only ) matters there), validate text normally
    if (ch === '[') {
      // Find matching ] accounting for nesting and escapes
      let j = i + 1;
      let depth = 1;
      while (j < n && depth > 0) {
        if (content[j] === '\\' && j + 1 < n) { j += 2; continue; }
        if (content[j] === '[') depth++;
        if (content[j] === ']') depth--;
        j++;
      }
      // j is now right after the closing ]
      if (depth === 0 && j < n && content[j] === '(') {
        // Valid link: skip URL (find closing ))
        j++;
        while (j < n && content[j] !== ')' && content[j] !== '\n') {
          if (content[j] === '\\' && j + 1 < n) { j += 2; continue; }
          j++;
        }
        if (j < n && content[j] === ')') j++;
        // Re-validate [text] part by re-scanning it (the ] and ( are consumed by the link)
        // Content inside brackets will be validated on a second pass — for now just advance
        i = j;
        continue;
      }
      // Not a valid link — [ is an unescaped reserved char
      addError(i, '[');
      i++;
      continue;
    }

    // Formatting markers: consume without error (pairs checked separately below)
    if (ch === '*' || ch === '_' || ch === '~') {
      i++;
      continue;
    }

    // Spoiler || — consume the pair
    if (ch === '|' && content[i + 1] === '|') {
      i += 2;
      continue;
    }

    // Blockquote > — valid at start of line
    if (ch === '>') {
      i++;
      continue;
    }

    // ] and ) can appear here only if not part of a valid link — flag them
    if (ch === ']' || ch === ')') {
      addError(i, ch);
      i++;
      continue;
    }

    // Any other reserved character that is not escaped = error
    if (MUST_ESCAPE.has(ch)) {
      addError(i, ch);
    }

    i++;
  }

  // Check that formatting markers are balanced (odd count = unclosed entity)
  const markerCounts: Record<string, number> = { '*': 0, '~': 0 };
  const lastMarkerPos: Record<string, number> = { '*': -1, '~': -1 };
  let inCode = false;
  for (let j = 0; j < n; j++) {
    if (content[j] === '\\' && j + 1 < n) { j++; continue; }
    if (content.startsWith('```', j)) { inCode = !inCode; j += 2; continue; }
    if (!inCode && content[j] === '`') { inCode = !inCode; continue; }
    if (!inCode && (content[j] === '*' || content[j] === '~')) {
      markerCounts[content[j]]++;
      lastMarkerPos[content[j]] = j;
    }
  }
  for (const marker of ['*', '~']) {
    if (markerCounts[marker] % 2 !== 0) {
      addError(lastMarkerPos[marker], marker);
    }
  }

  return errors;
}

function findMessageFiles(dir: string): string[] {
  const result: string[] = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir).sort()) {
    const lessonDir = path.join(dir, entry);
    if (!fs.statSync(lessonDir).isDirectory()) continue;
    for (const file of fs.readdirSync(lessonDir).sort()) {
      if ((file.startsWith('message.') || file.startsWith('reminder.')) && file.endsWith('.md')) {
        result.push(path.join(lessonDir, file));
      }
    }
  }
  return result;
}

function main(): void {
  const files = findMessageFiles(LESSONS_DIR);

  if (files.length === 0) {
    console.error(`❌ No message files found in ${LESSONS_DIR}`);
    process.exit(1);
  }

  console.log(`🔍 Validating ${files.length} message files for Telegram MarkdownV2...\n`);

  let totalErrors = 0;
  let filesWithErrors = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const errors = validate(content);
    const relPath = path.relative(process.cwd(), file);

    if (errors.length === 0) {
      console.log(`✅ ${relPath}`);
      continue;
    }

    console.log(`❌ ${relPath} — ${errors.length} error(s):`);
    for (const err of errors) {
      const arrow = ' '.repeat(err.col - 1) + '^';
      console.log(`   line ${err.line}:${err.col}  unescaped '${err.char}'`);
      console.log(`   ${err.lineContent}`);
      console.log(`   ${arrow}`);
    }
    totalErrors += errors.length;
    filesWithErrors++;
  }

  console.log(
    `\n📊 ${files.length} files checked — ` +
      (totalErrors === 0
        ? '✅ all valid'
        : `❌ ${filesWithErrors} file(s) with ${totalErrors} error(s)`),
  );

  if (totalErrors > 0) process.exit(1);
}

main();
