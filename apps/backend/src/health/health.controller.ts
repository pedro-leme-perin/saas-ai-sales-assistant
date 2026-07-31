// =============================================
// HEALTH CHECK CONTROLLER
// =============================================
// Comprehensive health endpoint for load balancers, monitoring
// Based on: Release It! - Health Checks, SRE - Monitoring
//
// Reports: DB status, cache status, circuit breaker states,
// version, node version, environment, uptime

import { Controller, Get, Header, Inject, Optional, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { AIManagerService } from '../infrastructure/ai/ai-manager.service';
import { redisAdapterStatus } from '../common/adapters/redis-io.adapter';

@ApiTags('health')
@Public()
@SkipThrottle() // Health checks must never be rate-limited (load balancers poll frequently)
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(AIManagerService) private readonly aiManager?: AIManagerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive health check' })
  @ApiResponse({ status: 200, description: 'Returns health status of all services' })
  async check() {
    const database = await this.checkDatabase();
    const redis = this.checkRedis();

    const circuitBreakers = this.aiManager ? this.aiManager.getCircuitBreakerStatus() : {};

    // Postgres em falha = unhealthy (nao ha fallback).
    // Redis em falha = degraded: o RedisIoAdapter cai para adapter em memoria e
    // o processo continua servindo. NAO retornamos erro HTTP aqui de proposito:
    // /health e o healthcheck de deploy da Railway e o monitor de uptime, e uma
    // queda de Redis nao pode bloquear deploy nem abrir incidente de "fora do ar".
    // O alarme de degradacao vive em GET /health/deps (503 quando degradado).
    const status =
      database.status !== 'ok' ? 'unhealthy' : redis.status !== 'ok' ? 'degraded' : 'ok';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      services: { database, redis },
      circuitBreakers,
    };
  }

  // S84: endpoint dedicado a MONITORAMENTO, nunca a load balancer nem a
  // healthcheck de deploy. Retorna 503 quando qualquer dependencia esta
  // degradada, para que um monitor externo (UptimeRobot) transforme perda
  // silenciosa de capacidade em alerta.
  //
  // Motivo de existir separado de /health: os dois Redis do Upstash foram
  // perdidos em data indeterminada e nada avisou, porque o fallback do
  // adapter e mudo e /health so olhava Postgres (licao #52).
  @Get('deps')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Estado das dependencias — 503 quando degradado (monitoramento)' })
  @ApiResponse({ status: 200, description: 'Todas as dependencias operacionais' })
  @ApiResponse({ status: 503, description: 'Alguma dependencia degradada ou indisponivel' })
  async deps(@Res({ passthrough: true }) res: Response) {
    const database = await this.checkDatabase();
    const redis = this.checkRedis();

    const degraded = database.status !== 'ok' || redis.status !== 'ok';
    res.status(degraded ? 503 : 200);

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      dependencies: { database, redis },
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (for load balancers)' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  live() {
    return { alive: true };
  }

  // Le o estado publicado pelo RedisIoAdapter no bootstrap (main.ts).
  // Nao reconecta aqui: o adapter e criado uma vez, fora do ciclo de DI.
  private checkRedis() {
    if (redisAdapterStatus.connected) {
      return { status: 'ok' as const, mode: redisAdapterStatus.mode };
    }
    return {
      status: 'degraded' as const,
      mode: redisAdapterStatus.mode,
      impact: 'WebSocket sem escala horizontal (ADR-004) — eventos nao cruzam replicas',
      message: redisAdapterStatus.lastError ?? 'adapter nao inicializado',
      checkedAt: redisAdapterStatus.checkedAt,
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const };
    } catch (error) {
      return {
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
