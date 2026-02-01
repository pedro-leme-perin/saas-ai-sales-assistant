// =============================================
// ❤️ HEALTH CONTROLLER
// =============================================
// System health checks for monitoring
// =============================================
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { Public } from '@common/decorators';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    api: 'ok' | 'error';
    database: 'ok' | 'error';
    cache: 'ok' | 'error';
  };
  latency?: {
    database: number;
    cache: number;
  };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Full health check' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 503, description: 'System is unhealthy' })
  async check(): Promise<HealthStatus> {
    const start = Date.now();

    // Check database
    let dbStatus: 'healthy' | 'unhealthy' = 'healthy';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      dbStatus = 'unhealthy';
    }

    // Check cache
    const cacheHealth = await this.cache.healthCheck();

    const isHealthy = dbStatus === 'healthy' && cacheHealth.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: 'ok',
        database: dbStatus === 'healthy' ? 'ok' : 'error',
        cache: cacheHealth.status === 'healthy' ? 'ok' : 'error',
      },
      latency: {
        database: dbLatency,
        cache: cacheHealth.latency || 0,
      },
    };
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe (for Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe (for Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async ready(): Promise<{ status: string; ready: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', ready: true };
    } catch {
      return { status: 'error', ready: false };
    }
  }
}