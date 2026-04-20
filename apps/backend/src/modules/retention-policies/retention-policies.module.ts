// =============================================
// 📄 RETENTION POLICIES MODULE (Session 51)
// =============================================

import { Module } from '@nestjs/common';
import { RetentionPoliciesController } from './retention-policies.controller';
import { RetentionPoliciesService } from './retention-policies.service';

@Module({
  controllers: [RetentionPoliciesController],
  providers: [RetentionPoliciesService],
  exports: [RetentionPoliciesService],
})
export class RetentionPoliciesModule {}
