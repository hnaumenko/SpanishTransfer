import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsService } from '../lessons/lessons.service';

function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\-\\]/g, '\\$&');
}

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

@Injectable()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
  ) {}

  register(bot: Bot): void {
    bot.command('start', (ctx) => this.onStart(ctx));
    bot.command('lesson', (ctx) => this.onLesson(ctx));
    bot.command('progress', (ctx) => this.onProgress(ctx));
    bot.command('pause', (ctx) => this.onPause(ctx));
    bot.command('resume', (ctx) => this.onResume(ctx));
    bot.command('skip', (ctx) => this.onSkip(ctx));
  }

  private async onStart(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);

    const existing = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!existing) {
      await this.prisma.user.create({
        data: { telegramId },
      });
      this.logger.log(`New user registered: ${telegramId}`);
    }

    const welcome = escMd(
      '👋 Привіт! Я SpanishMe — твій щоденний тренер іспанської 🇪🇸\n' +
        'Курс Language Transfer: 90 уроків, один на день.\n' +
        'Щоранку о 9:00 ти отримуватимеш новий урок.\n' +
        'Починаємо? Ось твій перший урок 👇',
    );
    await ctx.reply(welcome, { parse_mode: 'MarkdownV2' });

    try {
      const message = await this.lessons.getLessonMessage(1);
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      this.logger.error(`Failed to send lesson 1 on /start: ${error}`);
    }
  }

  private async onLesson(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply(escMd('Спочатку напиши /start 👋'), {
        parse_mode: 'MarkdownV2',
      });
      return;
    }

    try {
      const message = await this.lessons.getLessonMessage(user.currentLesson);
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      this.logger.error(
        `Failed to send lesson ${user.currentLesson} to ${telegramId}: ${error}`,
      );
      await ctx.reply(
        escMd('Не вдалося завантажити урок. Спробуй пізніше.'),
        { parse_mode: 'MarkdownV2' },
      );
    }
  }

  private async onProgress(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply(escMd('Спочатку напиши /start 👋'), {
        parse_mode: 'MarkdownV2',
      });
      return;
    }

    const dateStr = formatDate(user.createdAt);
    const text =
      `📊 Твій прогрес:\n` +
      `📍 Урок: ${user.currentLesson} з 90\n` +
      `🔥 Streak: ${user.streak} днів\n` +
      `📅 Розпочато: ${dateStr}`;

    await ctx.reply(escMd(text), { parse_mode: 'MarkdownV2' });
  }

  private async onPause(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    await this.prisma.user.upsert({
      where: { telegramId },
      update: { isActive: false },
      create: { telegramId, isActive: false },
    });
    await ctx.reply(
      escMd('⏸ Паузу встановлено. Напиши /resume щоб продовжити.'),
      { parse_mode: 'MarkdownV2' },
    );
  }

  private async onResume(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    await this.prisma.user.upsert({
      where: { telegramId },
      update: { isActive: true },
      create: { telegramId, isActive: true },
    });
    await ctx.reply(
      escMd('▶️ Продовжуємо! До зустрічі завтра вранці 🌅'),
      { parse_mode: 'MarkdownV2' },
    );
  }

  private async onSkip(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply(escMd('Спочатку напиши /start 👋'), {
        parse_mode: 'MarkdownV2',
      });
      return;
    }

    const newLesson = user.currentLesson + 1;
    await this.prisma.user.update({
      where: { telegramId },
      data: { currentLesson: newLesson },
    });
    await ctx.reply(
      escMd(`⏭ Урок пропущено. Наступний урок: ${newLesson}`),
      { parse_mode: 'MarkdownV2' },
    );
  }
}
