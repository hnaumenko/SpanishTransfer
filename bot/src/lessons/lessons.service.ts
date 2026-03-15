import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  async getLessonMessage(lessonNumber: number): Promise<string> {
    const padded = String(lessonNumber).padStart(3, '0');
    const base = process.env.GITHUB_RAW_BASE;
    if (!base) {
      throw new Error('GITHUB_RAW_BASE env var is not set');
    }
    const url = `${base}/lessons/${padded}/message.md`;
    this.logger.log(`Fetching lesson ${lessonNumber} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch lesson ${lessonNumber}: HTTP ${response.status}`,
      );
    }
    return response.text();
  }

  getTotalLessons(): number {
    return 90;
  }
}
