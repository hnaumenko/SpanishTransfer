import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsService } from '../lessons/lessons.service';
import { BotService } from '../bot/bot.service';

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
          this.logger.log(`User ${user.telegramId} completed the course`);
        } else {
          const message = await this.lessons.getLessonMessage(
            user.currentLesson,
            user.locale,
          );
          await this.bot.sendMessage(user.telegramId, message);
          const audio = this.lessons.getLessonAudio(user.currentLesson);
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
          this.logger.log(
            `Sent lesson ${user.currentLesson} to user ${user.telegramId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to process user ${user.telegramId}: ${error}`,
        );
      }
    }
  }

  @Cron('0 20 * * *', { timeZone: 'Europe/Madrid' })
  async sendEveningReminder(): Promise<void> {
    this.logger.log('Running evening reminder cron');

    // Find users whose lesson was sent today — morning cron ran at 9:00, evening at 20:00,
    // so checking last 12 hours is sufficient to identify today's recipients.
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        lastLessonAt: { gte: twelveHoursAgo },
      },
    });

    this.logger.log(`Sending evening reminder to ${users.length} users`);

    for (const user of users) {
      try {
        // currentLesson was already incremented after morning send, so subtract 2 for display
        const lessonNumber = user.currentLesson - 2;
        const text = escMd(
          `🔄 Нагадування\n\nСьогодні був урок ${lessonNumber}.\nПовтори ключові конструкції перед сном 💪`,
        );
        await this.bot.sendMessage(user.telegramId, text);
        this.logger.log(`Sent evening reminder to user ${user.telegramId}`);
      } catch (error) {
        this.logger.error(
          `Failed to send reminder to user ${user.telegramId}: ${error}`,
        );
      }
    }
  }
}
