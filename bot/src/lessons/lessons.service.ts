import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InputFile } from 'grammy';

interface ExamplesItem {
  es: string;
  uk: string;
  en: string;
  note: string;
}

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  private getBase(): string {
    const base = process.env.GITHUB_RAW_BASE;
    if (!base) throw new Error('GITHUB_RAW_BASE env var is not set');
    return base;
  }

  private stripMarkdownWrapper(content: string): string {
    let text = content.replace(/^#[^\n]*\n+/, '');
    text = text.replace(/^```(?:markdown)?\n/, '');
    text = text.replace(/\n```\s*$/, '');
    return text.trim();
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  private isDev(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private lessonsDir(): string {
    return path.join(process.cwd(), '..', 'lessons');
  }

  async getLessonMessage(lessonNumber: number, locale: string = 'uk'): Promise<string> {
    const padded = String(lessonNumber).padStart(3, '0');

    if (this.isDev()) {
      const localPath = path.join(this.lessonsDir(), padded, `message.${locale}.md`);
      this.logger.log(`[dev] Reading lesson ${lessonNumber} [${locale}] from ${localPath}`);
      const raw = await fs.promises.readFile(localPath, 'utf-8');
      return this.stripMarkdownWrapper(raw);
    }

    const url = `${this.getBase()}/lessons/${padded}/message.${locale}.md`;
    this.logger.log(`Fetching lesson ${lessonNumber} [${locale}] from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch lesson ${lessonNumber} [${locale}]: HTTP ${response.status}`,
      );
    }
    return this.stripMarkdownWrapper(await response.text());
  }

  async getLessonExamples(lessonNumber: number, locale: string = 'uk'): Promise<string> {
    const padded = String(lessonNumber).padStart(3, '0');
    let examples: ExamplesItem[];

    if (this.isDev()) {
      const localPath = path.join(this.lessonsDir(), padded, 'examples.json');
      this.logger.log(`[dev] Reading examples for lesson ${lessonNumber} from ${localPath}`);
      try {
        const raw = await fs.promises.readFile(localPath, 'utf-8');
        examples = JSON.parse(raw) as ExamplesItem[];
      } catch {
        this.logger.warn(`Examples not found for lesson ${lessonNumber} at ${localPath}`);
        return '';
      }
    } else {
      const url = `${this.getBase()}/lessons/${padded}/examples.json`;
      this.logger.log(`Fetching examples for lesson ${lessonNumber} [${locale}] from ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          `Examples not found for lesson ${lessonNumber}: HTTP ${response.status}`,
        );
        return '';
      }
      examples = (await response.json()) as ExamplesItem[];
    }

    const lines = examples.map((ex, i) => {
      const index = `${i + 1}\\.`;
      if (locale === 'uk') {
        return [
          `${index} _${this.escapeMarkdown(ex.es)}_ — ${this.escapeMarkdown(ex.uk)}`,
          `🇬🇧 ${this.escapeMarkdown(ex.en)}`,
          `\`${this.escapeMarkdown(ex.note)}\``,
        ].join('\n');
      }
      return [
        `${index} _${this.escapeMarkdown(ex.es)}_ — ${this.escapeMarkdown(ex.en)}`,
        `\`${this.escapeMarkdown(ex.note)}\``,
      ].join('\n');
    });

    const header =
      locale === 'uk'
        ? `*Приклади до уроку ${lessonNumber}:*`
        : `*Examples for lesson ${lessonNumber}:*`;

    return `${header}\n\n${lines.join('\n\n')}`;
  }

  getLessonAudio(lessonNumber: number): InputFile | string | null {
    const padded = String(lessonNumber).padStart(3, '0');

    if (this.isDev()) {
      for (const ext of ['mp3', 'm4a']) {
        const localPath = path.join(this.lessonsDir(), padded, `audio.en.${ext}`);
        if (fs.existsSync(localPath)) return new InputFile(localPath);
      }
      return null;
    }

    return `${this.getBase()}/lessons/${padded}/audio.en.mp3`;
  }

  async getReminderMessage(lessonNumber: number, locale: string = 'uk'): Promise<string> {
    const padded = String(lessonNumber).padStart(3, '0');

    if (this.isDev()) {
      const localPath = path.join(this.lessonsDir(), padded, `reminder.${locale}.md`);
      this.logger.log(`[dev] Reading reminder ${lessonNumber} [${locale}] from ${localPath}`);
      const raw = await fs.promises.readFile(localPath, 'utf-8');
      return this.stripMarkdownWrapper(raw);
    }

    const url = `${this.getBase()}/lessons/${padded}/reminder.${locale}.md`;
    this.logger.log(`Fetching reminder ${lessonNumber} [${locale}] from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Reminder not found for lesson ${lessonNumber} [${locale}]: ${response.status}`,
      );
    }
    return this.stripMarkdownWrapper(await response.text());
  }

  getTotalLessons(): number {
    return 90;
  }
}
