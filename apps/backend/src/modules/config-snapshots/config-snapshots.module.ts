// =============================================
// 📸 ConfigSnapshotsModule (Session 58 — Feature A2)
// =============================================

import { Module } from '@nestjs/common';

import { ConfigSnapshotsController } from './config-snapshots.controller';
import { ConfigSnapshotsService } from './config-snapshots.service';

@Module({
  controllers: [ConfigSnapshotsController],
  providers: [ConfigSnapshotsService],
  exports: [ConfigSnapshotsService],
})
export class ConfigSnapshotsModule {}
