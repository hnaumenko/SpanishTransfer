import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DailyStats {
  newUsers: number;
  lessonsDelivered: number;
  remindersDelivered: number;
  completions: number;
  skips: number;
  activeUsers: number;
  totalUsers: number;
  errors: number;
}

interface DropOffRow {
  lessonNumber: number;
  skips: bigint;
  pauses: bigint;
}

export interface DropOffStats {
  lessonNumber: number;
  skips: number;
  pauses: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(
    telegramId: bigint,
    event: string,
    lessonNumber?: number,
    locale?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.userEvent.create({
        data: {
          telegramId,
          event,
          lessonNumber: lessonNumber ?? null,
          locale: locale ?? null,
          metadata: metadata ? (metadata as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Analytics track failed: ${err}`);
    }
  }

  async getDailyStats(): Promise<DailyStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      newUsers,
      lessonsDelivered,
      remindersDelivered,
      completions,
      skips,
      activeUsers,
      totalUsers,
      errors,
    ] = await Promise.all([
      this.prisma.userEvent.count({
        where: { event: 'USER_STARTED', createdAt: { gte: today } },
      }),
      this.prisma.userEvent.count({
        where: { event: 'LESSON_RECEIVED', createdAt: { gte: today } },
      }),
      this.prisma.userEvent.count({
        where: { event: 'REMINDER_RECEIVED', createdAt: { gte: today } },
      }),
      this.prisma.userEvent.count({
        where: { event: 'LESSON_COMPLETED', createdAt: { gte: today } },
      }),
      this.prisma.userEvent.count({
        where: { event: 'LESSON_SKIPPED', createdAt: { gte: today } },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.userEvent.count({
        where: {
          event: { in: ['ERROR_LESSON_FETCH', 'ERROR_BOT_SEND'] },
          createdAt: { gte: today },
        },
      }),
    ]);

    return {
      newUsers,
      lessonsDelivered,
      remindersDelivered,
      completions,
      skips,
      activeUsers,
      totalUsers,
      errors,
    };
  }

  async getDropOffStats(): Promise<DropOffStats[]> {
    const rows = await this.prisma.$queryRaw<DropOffRow[]>`
      SELECT
        "lessonNumber",
        COUNT(*) FILTER (WHERE event = 'LESSON_SKIPPED') as skips,
        COUNT(*) FILTER (WHERE event = 'COURSE_PAUSED') as pauses
      FROM "UserEvent"
      WHERE "lessonNumber" IS NOT NULL
      GROUP BY "lessonNumber"
      ORDER BY (COUNT(*) FILTER (WHERE event = 'LESSON_SKIPPED') + COUNT(*) FILTER (WHERE event = 'COURSE_PAUSED')) DESC
      LIMIT 10
    `;
    // Raw BigInt → number
    return rows.map((r) => ({
      lessonNumber: r.lessonNumber,
      skips: Number(r.skips),
      pauses: Number(r.pauses),
    }));
  }
}
