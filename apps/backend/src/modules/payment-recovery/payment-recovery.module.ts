// =============================================
// 💸 PAYMENT RECOVERY MODULE
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { EmailModule } from '@modules/email/email.module';
import { PaymentRecoveryController } from './payment-recovery.controller';
import { PaymentRecoveryService } from './payment-recovery.service';

@Module({
  imports: [ConfigModule, AuthModule, EmailModule],
  controllers: [PaymentRecoveryController],
  providers: [PaymentRecoveryService],
  exports: [PaymentRecoveryService],
})
export class PaymentRecoveryModule {}
