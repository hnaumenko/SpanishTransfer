import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Bot, InputFile } from 'grammy';
import { BotUpdate } from './bot.update';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot!: Bot;

  constructor(private readonly botUpdate: BotUpdate) {}

  onModuleInit(): void {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error('BOT_TOKEN env var is not set');
    }

    this.bot = new Bot(token);
    this.botUpdate.register(this.bot);

    void this.bot
      .start({
        onStart: (botInfo) => {
          this.logger.log(`Bot @${botInfo.username} started polling`);
        },
      })
      .catch((err: unknown) => {
        this.logger.error('Bot polling crashed', err);
      });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot.stop();
    this.logger.log('Bot stopped');
  }

  async sendMessage(telegramId: bigint, text: string): Promise<void> {
    await this.bot.api.sendMessage(Number(telegramId), text, {
      parse_mode: 'MarkdownV2',
    });
  }

  async sendAudio(telegramId: bigint, audio: InputFile | string): Promise<void> {
    await this.bot.api.sendAudio(Number(telegramId), audio);
  }
}
