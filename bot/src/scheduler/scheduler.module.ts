import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { LessonsModule } from '../lessons/lessons.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [BotModule, LessonsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
