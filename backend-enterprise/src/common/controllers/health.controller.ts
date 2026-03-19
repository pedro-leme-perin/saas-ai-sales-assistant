// =============================================
// 🏥 HEALTH CHECK CONTROLLER
// =============================================
// Provides health check endpoint for monitoring

import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';

interface ServiceStatus {
  status: 'ok' | 'error';
  message?: string;
}

interface HealthCheckResponse {
  status: 'ok' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  nodeVersion: string;
  environment: string;
  services: {
    database: ServiceStatus;
    cache: ServiceStatus;
  };
}

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns health status of all services',
  })
  async check(): Promise<HealthCheckResponse> {
    // Initialize with ok status
    const services: HealthCheckResponse['services'] = {
      database: { status: 'ok' },
      cache: { status: 'ok' },
    };

    // Check PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      services.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Redis
    try {
      const testKey = '__health_check__';
      const testValue = Date.now().toString();
      await this.cache.set(testKey, testValue, 5);
      const retrieved = await this.cache.get(testKey);
      
      if (retrieved !== testValue) {
        throw new Error('Cache value mismatch');
      }
      
      await this.cache.del(testKey);
    } catch (error) {
      services.cache = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Overall status
    const allHealthy = services.database.status === 'ok' && services.cache.status === 'ok';

    return {
      status: allHealthy ? 'ok' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      services,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async ready(): Promise<{ ready: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live(): { alive: boolean } {
    return { alive: true };
  }
}
