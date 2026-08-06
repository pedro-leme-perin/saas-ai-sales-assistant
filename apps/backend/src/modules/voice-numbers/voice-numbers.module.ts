// ====================================================
// 📞 VOICE NUMBERS MODULE — ADR-018
// ====================================================

import { Module } from '@nestjs/common';
import { VoiceNumbersController } from './voice-numbers.controller';
import { VoiceNumbersService } from './voice-numbers.service';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [AuthModule], // TenantGuard / RolesGuard depend on it
  controllers: [VoiceNumbersController],
  providers: [VoiceNumbersService],
  exports: [VoiceNumbersService], // onboarding will provision from here
})
export class VoiceNumbersModule {}
