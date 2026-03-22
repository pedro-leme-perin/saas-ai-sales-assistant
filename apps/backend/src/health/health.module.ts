import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { AiModule } from '../modules/ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [HealthController],
})
export class HealthModule {}
