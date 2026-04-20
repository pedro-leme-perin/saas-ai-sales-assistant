// =============================================
// 📥 DataImportModule (Session 54 — Feature A1)
// =============================================
// Imports BackgroundJobsModule to register IMPORT_CONTACTS handler
// via DataImportService.onModuleInit.

import { Module } from '@nestjs/common';

import { BackgroundJobsModule } from '@modules/background-jobs/background-jobs.module';

import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';

@Module({
  imports: [BackgroundJobsModule],
  controllers: [DataImportController],
  providers: [DataImportService],
  exports: [DataImportService],
})
export class DataImportModule {}
