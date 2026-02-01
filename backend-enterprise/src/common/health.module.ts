// =============================================
// 🏥 HEALTH MODULE
// =============================================
// Module for health check endpoints

import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { CacheModule } from '../infrastructure/cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
