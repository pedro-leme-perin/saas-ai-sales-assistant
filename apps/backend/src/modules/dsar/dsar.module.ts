// =============================================
// 🛡️ DsarModule (S60a) — LGPD Art. 18 workflow
// =============================================
// Exposes:
//   - HTTP controller (admin-facing CRUD + approve/reject/download)
//   - DsarService (CRUD + state machine + integration with LgpdDeletionModule)
//   - DsarExtractService (background job handler for EXTRACT_DSAR — registered
//     via OnModuleInit hook against BackgroundJobsService).
//
// Imports:
//   - BackgroundJobsModule: queue + handler registry.
//   - EmailModule: subject-facing notifications (READY, REJECTED).
//   - UploadModule: R2 putObject + signed download URLs.
//   - LgpdDeletionModule: DSAR DELETION → reuses 30d grace mechanism (S43).

import { Module } from '@nestjs/common';

import { BackgroundJobsModule } from '@modules/background-jobs/background-jobs.module';
import { EmailModule } from '@modules/email/email.module';
import { LgpdDeletionModule } from '@modules/lgpd-deletion/lgpd-deletion.module';
import { UploadModule } from '@modules/upload/upload.module';

import { DsarController } from './dsar.controller';
import { DsarExtractService } from './dsar-extract.service';
import { DsarService } from './dsar.service';

@Module({
  imports: [BackgroundJobsModule, EmailModule, UploadModule, LgpdDeletionModule],
  controllers: [DsarController],
  providers: [DsarService, DsarExtractService],
  exports: [DsarService],
})
export class DsarModule {}
