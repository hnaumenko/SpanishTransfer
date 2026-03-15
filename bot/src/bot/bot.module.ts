import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';

@Module({
  imports: [LessonsModule],
  providers: [BotUpdate, BotService],
  exports: [BotService],
})
export class BotModule {}
