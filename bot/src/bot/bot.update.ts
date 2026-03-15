import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
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
    bot.callbackQuery('locale_en', (ctx) => this.onLocaleSelected(ctx, 'en'));
    bot.callbackQuery('locale_uk', (ctx) => this.onLocaleSelected(ctx, 'uk'));
    bot.callbackQuery('locale_en_selected', (ctx) => ctx.answerCallbackQuery());
    bot.callbackQuery('locale_uk_selected', (ctx) => ctx.answerCallbackQuery());
    bot.command('почати_перший_урок', (ctx) => this.sendLesson1WithLocalePicker(ctx, 'uk'));
    bot.hears(/^\/приклади_(\d+)$/, (ctx) => this.onExamples(ctx));
    bot.hears(/^\/examples_(\d+)$/, (ctx) => this.onExamples(ctx));
  }

  private async onStart(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);

    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!existing) {
      await this.prisma.user.create({ data: { telegramId } });
      this.logger.log(`New user registered: ${telegramId}`);
    }

    await this.sendLesson1WithLocalePicker(ctx, 'uk');
  }

  private async onLocaleSelected(ctx: Context, locale: string): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    await this.prisma.user.update({ where: { telegramId }, data: { locale } });
    await ctx.answerCallbackQuery();
    await this.sendLesson1WithLocalePicker(ctx, locale);
  }

  private async sendLesson1WithLocalePicker(ctx: Context, locale: string): Promise<void> {
    const keyboard =
      locale === 'en'
        ? new InlineKeyboard()
            .text('🇬🇧 English ✓', 'locale_en_selected')
            .text('🇺🇦 Продовжити українською', 'locale_uk')
        : new InlineKeyboard()
            .text('🇬🇧 Continue in English', 'locale_en')
            .text('🇺🇦 Українська ✓', 'locale_uk_selected');

    try {
      const message = await this.lessons.getLessonMessage(1, locale);
      await ctx.reply(message, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
    } catch (error) {
      this.logger.error(`Failed to send lesson 1 [${locale}]: ${error}`);
      const errorText =
        locale === 'en'
          ? 'Failed to load the lesson. Please try again later.'
          : 'Не вдалося завантажити урок. Спробуй пізніше.';
      await ctx.reply(escMd(errorText), { parse_mode: 'MarkdownV2' });
    }
  }

  private async onLesson(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply(escMd('Спочатку напиши /start 👋'), { parse_mode: 'MarkdownV2' });
      return;
    }

    try {
      const message = await this.lessons.getLessonMessage(user.currentLesson, user.locale);
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
      await ctx.reply(escMd('Спочатку напиши /start 👋'), { parse_mode: 'MarkdownV2' });
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
      await ctx.reply(escMd('Спочатку напиши /start 👋'), { parse_mode: 'MarkdownV2' });
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

  private async onExamples(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const lessonNumber = Number((ctx.match as RegExpMatchArray)[1]);

    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    const locale = user?.locale ?? 'uk';

    try {
      const examples = await this.lessons.getLessonExamples(lessonNumber, locale);
      await ctx.reply(examples, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      this.logger.error(`Failed to send examples for lesson ${lessonNumber}: ${error}`);
      await ctx.reply(
        escMd('Не вдалося завантажити приклади. Спробуй пізніше.'),
        { parse_mode: 'MarkdownV2' },
      );
    }
  }
}
