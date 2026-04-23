// =============================================
// 🎓 AgentSkillsModule (Session 59 — Feature A1)
// =============================================
// Exports AgentSkillsService so AssignmentRulesModule can import it for
// skill-based filtering inside tryAutoAssign.

import { Module } from '@nestjs/common';

import { AgentSkillsController } from './agent-skills.controller';
import { AgentSkillsService } from './agent-skills.service';

@Module({
  controllers: [AgentSkillsController],
  providers: [AgentSkillsService],
  exports: [AgentSkillsService],
})
export class AgentSkillsModule {}
