import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import type { Request, Response } from 'express';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });

  // Health endpoint for Railway healthcheck
  app.use('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`SpanishTransfer bot listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
