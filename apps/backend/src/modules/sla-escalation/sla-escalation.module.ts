// =============================================
// 🚨 SLA Escalation Module (Session 57 — Feature A2)
// =============================================
// Extends Session 49 sla-policies with multi-tier escalation chains.
// Consumes PresenceService (Session 57 A1) for presence-aware REASSIGN.
// Emits `webhooks.emit` via in-process EventEmitter2 (registered globally).

import { Module } from '@nestjs/common';

import { PresenceModule } from '@modules/presence/presence.module';
import { SlaEscalationController } from './sla-escalation.controller';
import { SlaEscalationService } from './sla-escalation.service';

@Module({
  imports: [PresenceModule],
  controllers: [SlaEscalationController],
  providers: [SlaEscalationService],
  exports: [SlaEscalationService],
})
export class SlaEscalationModule {}
