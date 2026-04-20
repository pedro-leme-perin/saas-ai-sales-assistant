// =============================================
// 📄 SLA POLICIES MODULE (Session 49)
// =============================================

import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';

@Module({
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService],
  exports: [SlaPoliciesService],
})
export class SlaPoliciesModule {}
