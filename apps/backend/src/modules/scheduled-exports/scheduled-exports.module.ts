// =============================================
// 📄 SCHEDULED EXPORTS MODULE (Session 51)
// =============================================

import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ScheduledExportsController } from './scheduled-exports.controller';
import { ScheduledExportsService } from './scheduled-exports.service';

@Module({
  imports: [EmailModule],
  controllers: [ScheduledExportsController],
  providers: [ScheduledExportsService],
  exports: [ScheduledExportsService],
})
export class ScheduledExportsModule {}
