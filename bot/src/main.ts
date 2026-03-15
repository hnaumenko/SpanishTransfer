import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  logger.log('SpanishTransfer bot is running');
}

bootstrap().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
