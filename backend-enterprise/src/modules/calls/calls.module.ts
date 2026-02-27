import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { MediaStreamsGateway } from './media-streams.gateway';
import { DeepgramService } from '../../infrastructure/stt/deepgram.service';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [AiModule, NotificationsModule, PrismaModule],
  controllers: [CallsController],
  providers: [CallsService, DeepgramService, MediaStreamsGateway],
  exports: [CallsService, DeepgramService],
})
export class CallsModule {}
