// =============================================
// 📡 PresenceModule (Session 57 — Feature A1)
// =============================================

import { Module } from '@nestjs/common';

import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

@Module({
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
