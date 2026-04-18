// =============================================
// 📄 COACHING MODULE
// =============================================
// Session 44: Weekly AI coaching reports per vendor.
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '@modules/email/email.module';
import { CoachingService } from './coaching.service';
import { CoachingController } from './coaching.controller';

@Module({
  imports: [ConfigModule, EmailModule],
  controllers: [CoachingController],
  providers: [CoachingService],
  exports: [CoachingService],
})
export class CoachingModule {}
