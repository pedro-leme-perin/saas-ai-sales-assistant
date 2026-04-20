// =============================================
// 📊 UsageQuotasModule (Session 55 — Feature A2)
// =============================================

import { Module } from '@nestjs/common';

import { EmailModule } from '@modules/email/email.module';

import { UsageQuotaAlertsListener } from './usage-quota-alerts.listener';
import { UsageQuotasController } from './usage-quotas.controller';
import { UsageQuotasService } from './usage-quotas.service';

@Module({
  imports: [EmailModule],
  controllers: [UsageQuotasController],
  providers: [UsageQuotasService, UsageQuotaAlertsListener],
  exports: [UsageQuotasService],
})
export class UsageQuotasModule {}
