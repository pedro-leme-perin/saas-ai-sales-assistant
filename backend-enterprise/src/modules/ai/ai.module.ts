import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AIManagerService } from '@/infrastructure/ai/ai-manager.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [AiService, AIManagerService],
  exports: [AiService],
})
export class AiModule {}