import { Injectable, Logger } from '@nestjs/common';

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

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  async getLessonMessage(lessonNumber: number, locale: string = 'uk'): Promise<string> {
    const padded = String(lessonNumber).padStart(3, '0');
    const url = `${this.getBase()}/lessons/${padded}/message.${locale}.md`;
    this.logger.log(`Fetching lesson ${lessonNumber} [${locale}] from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch lesson ${lessonNumber} [${locale}]: HTTP ${response.status}`,
      );
    }
    return response.text();
  }

  async getLessonExamples(lessonNumber: number, locale: string = 'uk'): Promise<string> {
    const padded = String(lessonNumber).padStart(3, '0');
    const url = `${this.getBase()}/lessons/${padded}/examples.json`;
    this.logger.log(`Fetching examples for lesson ${lessonNumber} [${locale}] from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      this.logger.warn(
        `Examples not found for lesson ${lessonNumber}: HTTP ${response.status}`,
      );
      return '';
    }
    const examples = (await response.json()) as ExamplesItem[];

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

  getTotalLessons(): number {
    return 90;
  }
}
