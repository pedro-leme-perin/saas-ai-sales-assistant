// =============================================
// 📦 BULK ACTIONS MODULE (Session 52)
// =============================================

import { Module } from '@nestjs/common';
import { BackgroundJobsModule } from '@modules/background-jobs/background-jobs.module';
import { BulkActionsController } from './bulk-actions.controller';
import { BulkActionsService } from './bulk-actions.service';

@Module({
  imports: [BackgroundJobsModule],
  controllers: [BulkActionsController],
  providers: [BulkActionsService],
  exports: [BulkActionsService],
})
export class BulkActionsModule {}
