// =============================================
// 🗑️  LGPD DELETION MODULE
// =============================================
// Session 43: Scheduled hard deletion (LGPD Art. 16, III).
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '@modules/email/email.module';
import { LgpdDeletionService } from './lgpd-deletion.service';

@Module({
  imports: [ConfigModule, EmailModule],
  providers: [LgpdDeletionService],
  exports: [LgpdDeletionService],
})
export class LgpdDeletionModule {}
