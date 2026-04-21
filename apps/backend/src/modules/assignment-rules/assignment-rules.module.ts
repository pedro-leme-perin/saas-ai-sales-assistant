// =============================================
// 🎯 AssignmentRulesModule (Session 54 — Feature A2)
// =============================================
// Listens to `chat.created` events emitted by WhatsappService
// (in-process EventEmitter — registered globally in AppModule).
// Zero direct import of WhatsappModule → no circular dep.

import { Module } from '@nestjs/common';

import { PresenceModule } from '@modules/presence/presence.module';
import { AssignmentRulesController } from './assignment-rules.controller';
import { AssignmentRulesService } from './assignment-rules.service';

@Module({
  imports: [PresenceModule],
  controllers: [AssignmentRulesController],
  providers: [AssignmentRulesService],
  exports: [AssignmentRulesService],
})
export class AssignmentRulesModule {}
