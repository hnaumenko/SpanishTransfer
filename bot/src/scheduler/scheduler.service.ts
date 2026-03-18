import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsService } from '../lessons/lessons.service';
import { BotService } from '../bot/bot.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { buildDailyReport } from './report.util';

function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\-\\]/g, '\\$&');
}

const COMPLETION_MESSAGE = escMd(
  '🎉 Вітаємо! Ти пройшов увесь курс із 90 уроків!\n' +
    'Твій іспанський вже ніколи не буде таким самим 🇪🇸',
);

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
    private readonly bot: BotService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Europe/Madrid' })
  async sendMorningLesson(): Promise<void> {
    this.logger.log('Running morning lesson cron');

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });

    this.logger.log(`Sending morning lesson to ${users.length} active users`);

    for (const user of users) {
      try {
        if (user.currentLesson > 90) {
          await this.bot.sendMessage(user.telegramId, COMPLETION_MESSAGE);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { isActive: false },
          });
          void this.analytics.track(user.telegramId, 'COURSE_COMPLETED', undefined, user.locale);
          this.logger.log(`User ${user.telegramId} completed the course`);
        } else {
          const lessonNumber = user.currentLesson;
          let message: string;
          try {
            message = await this.lessons.getLessonMessage(lessonNumber, user.locale);
          } catch (fetchError) {
            const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            void this.analytics.track(user.telegramId, 'ERROR_LESSON_FETCH', lessonNumber, user.locale, { error: msg });
            throw fetchError;
          }
          try {
            await this.bot.sendMessage(user.telegramId, message);
          } catch (sendError) {
            const msg = sendError instanceof Error ? sendError.message : String(sendError);
            void this.analytics.track(user.telegramId, 'ERROR_BOT_SEND', lessonNumber, user.locale, {
              error: msg,
              telegramId: user.telegramId.toString(),
            });
            throw sendError;
          }
          const audio = this.lessons.getLessonAudio(lessonNumber);
          if (audio !== null) {
            await this.bot.sendAudio(user.telegramId, audio);
          }
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              currentLesson: user.currentLesson + 1,
              streak: user.streak + 1,
              lastLessonAt: new Date(),
            },
          });
          void this.analytics.track(user.telegramId, 'LESSON_RECEIVED', lessonNumber, user.locale);
          this.logger.log(`Sent lesson ${lessonNumber} to user ${user.telegramId}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process user ${user.telegramId}: ${error}`,
        );
      }
    }
  }

  @Cron('0 21 * * *', { timeZone: 'Europe/Madrid' })
  async sendEveningReminder(): Promise<void> {
    this.logger.log('Evening reminder: starting delivery');

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });

    const eligible = users.filter((u) => this.isToday(u.lastLessonAt));
    this.logger.log(`Evening reminder: ${eligible.length} eligible users`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of eligible) {
      const lessonNumber = user.currentLesson - 1;

      if (lessonNumber < 1) {
        skipped++;
        continue;
      }

      try {
        const message = await this.lessons.getReminderMessage(lessonNumber, user.locale);
        await this.bot.sendMessage(user.telegramId, message);
        void this.analytics.track(user.telegramId, 'REMINDER_RECEIVED', lessonNumber, user.locale);
        sent++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('404') || msg.includes('not found')) {
          this.logger.warn(
            `Evening reminder: no reminder file for lesson ${lessonNumber} [${user.locale}]`,
          );
          skipped++;
        } else {
          this.logger.error(
            `Evening reminder: failed for user ${user.telegramId}: ${msg}`,
          );
          failed++;
        }
      }
    }

    this.logger.log(
      `Evening reminder complete: ✅ ${sent} sent / ⏭ ${skipped} skipped / ❌ ${failed} failed`,
    );
  }

  @Cron('0 22 * * *', { timeZone: 'Europe/Madrid' })
  async sendDailyReport(): Promise<void> {
    const ownerId = process.env.OWNER_TELEGRAM_ID;
    if (!ownerId) {
      this.logger.warn('Daily report: OWNER_TELEGRAM_ID not set, skipping');
      return;
    }

    try {
      const stats = await this.analytics.getDailyStats();
      const dropOff = await this.analytics.getDropOffStats();
      const report = buildDailyReport(stats, dropOff);
      await this.bot.sendMessage(BigInt(ownerId), report);
      this.logger.log('Daily report sent to owner');
    } catch (error) {
      this.logger.error(`Failed to send daily report: ${error}`);
    }
  }

  public async sendEveningReminderToUser(telegramId: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) throw new Error(`User ${telegramId} not found`);

    const lessonNumber = user.currentLesson - 1;
    if (lessonNumber < 1) {
      throw new Error(`User ${telegramId} has not started the course yet`);
    }

    const message = await this.lessons.getReminderMessage(lessonNumber, user.locale);
    await this.bot.sendMessage(user.telegramId, message);
  }

  private isToday(date: Date | null): boolean {
    if (!date) return false;
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }
}
