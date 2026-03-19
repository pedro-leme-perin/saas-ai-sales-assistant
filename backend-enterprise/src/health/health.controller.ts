// =============================================
// HEALTH CHECK CONTROLLER
// =============================================
// Comprehensive health endpoint for load balancers, monitoring
// Based on: Release It! - Health Checks, SRE - Monitoring
//
// Reports: DB status, cache status, circuit breaker states,
// version, node version, environment, uptime

import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { AIManagerService } from '../infrastructure/ai/ai-manager.service';

@ApiTags('Health')
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

    const circuitBreakers = this.aiManager ? this.aiManager.getCircuitBreakerStatus() : {};

    const allHealthy = database.status === 'ok';

    return {
      status: allHealthy ? 'ok' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      services: { database },
      circuitBreakers,
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
