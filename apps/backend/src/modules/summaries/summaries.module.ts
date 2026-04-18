// =============================================
// 📄 SUMMARIES MODULE
// =============================================
// Session 44: On-demand AI summaries for calls and WhatsApp chats.
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@infrastructure/cache/cache.module';
import { SummariesService } from './summaries.service';
import { SummariesController } from './summaries.controller';

@Module({
  imports: [ConfigModule, CacheModule],
  controllers: [SummariesController],
  providers: [SummariesService],
  exports: [SummariesService],
})
export class SummariesModule {}
