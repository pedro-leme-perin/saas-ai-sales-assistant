// =============================================
// 📅 SCHEDULED MESSAGES MODULE (Session 56)
// =============================================

import { forwardRef, Module } from '@nestjs/common';

import { BackgroundJobsModule } from '@modules/background-jobs/background-jobs.module';
import { WhatsappModule } from '@modules/whatsapp/whatsapp.module';

import { ScheduledMessagesController } from './scheduled-messages.controller';
import { ScheduledMessagesService } from './scheduled-messages.service';

@Module({
  imports: [BackgroundJobsModule, forwardRef(() => WhatsappModule)],
  controllers: [ScheduledMessagesController],
  providers: [ScheduledMessagesService],
  exports: [ScheduledMessagesService],
})
export class ScheduledMessagesModule {}
