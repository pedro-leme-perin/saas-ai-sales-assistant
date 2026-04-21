// =============================================
// 🛠 MACROS MODULE (Session 56)
// =============================================

import { forwardRef, Module } from '@nestjs/common';

import { WhatsappModule } from '@modules/whatsapp/whatsapp.module';

import { MacrosController } from './macros.controller';
import { MacrosService } from './macros.service';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [MacrosController],
  providers: [MacrosService],
  exports: [MacrosService],
})
export class MacrosModule {}
