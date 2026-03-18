import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { BotService } from './bot/bot.service';
import { webhookCallback } from 'grammy';
import type { Request, Response } from 'express';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });

  // Health endpoint
  app.use('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Webhook endpoint (production only)
  if (process.env.NODE_ENV === 'production') {
    const botService = app.get(BotService);
    app.use('/bot', webhookCallback(botService.getBot(), 'express'));
    logger.log('Webhook mode enabled at /bot');
  }

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`SpanishTransfer bot listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
