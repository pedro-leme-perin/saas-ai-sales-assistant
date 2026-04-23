// =============================================
// 🎯 AssignmentRulesModule (Session 54 — extended by S59)
// =============================================
// Listens to `chat.created` events emitted by WhatsappService
// (in-process EventEmitter — registered globally in AppModule).
// Zero direct import of WhatsappModule → no circular dep.
//
// S59: imports AgentSkillsModule + PresenceModule so the service can
// narrow candidates by skill and presence before strategy dispatch.

import { Module } from '@nestjs/common';

import { AgentSkillsModule } from '../agent-skills/agent-skills.module';
import { PresenceModule } from '../presence/presence.module';
import { AssignmentRulesController } from './assignment-rules.controller';
import { AssignmentRulesService } from './assignment-rules.service';

@Module({
  imports: [AgentSkillsModule, PresenceModule],
  controllers: [AssignmentRulesController],
  providers: [AssignmentRulesService],
  exports: [AssignmentRulesService],
})
export class AssignmentRulesModule {}
