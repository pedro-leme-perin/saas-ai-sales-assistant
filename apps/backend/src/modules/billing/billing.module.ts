// =============================================
// 💳 BILLING MODULE
// =============================================

import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentRecoveryModule } from '@modules/payment-recovery/payment-recovery.module';

@Module({
  imports: [ConfigModule, forwardRef(() => PaymentRecoveryModule)],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
