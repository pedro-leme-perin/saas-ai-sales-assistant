// src/infrastructure/cache/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Cache Module
 * 
 * Global module - disponível em toda aplicação
 * Usa Upstash REST API
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}