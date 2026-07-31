// =====================================================
// REDIS IO ADAPTER
// =====================================================
// Custom Socket.io adapter with Redis for horizontal scaling
// Based on: System Design Interview - Chapter 12 (Chat System)
//           NestJS docs - Custom WebSocket Adapter
//
// This is the CORRECT way to integrate Redis with Socket.io
// in NestJS. Using server.adapter() in afterInit does NOT work
// because NestJS wraps the server object.
// =====================================================

import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

/**
 * Estado observavel do adapter de WebSocket.
 *
 * S84: o fallback para adapter em memoria abaixo e correto (padrao Timeouts,
 * Release It!), mas era MUDO. Em 2026-07-31 descobriu-se que os dois bancos
 * Redis do Upstash estavam deletados havia tempo indeterminado: o backend
 * degradou exatamente como projetado, escreveu o erro no log e ninguem viu,
 * porque /health so verificava Postgres.
 *
 * Degradacao graciosa sem alarme nao e resiliencia - e uma falha que aprendeu
 * a ficar quieta (licao #52: observabilidade interna nao detecta ausencia).
 * Este objeto existe para que o health check possa reportar o estado real.
 */
export const redisAdapterStatus: {
  mode: 'redis' | 'in-memory' | 'unknown';
  connected: boolean;
  lastError: string | null;
  checkedAt: string | null;
} = {
  mode: 'unknown',
  connected: false,
  lastError: null,
  checkedAt: null,
};

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('⚠️ No REDIS_URL — using in-memory adapter (single instance only)');
      redisAdapterStatus.mode = 'in-memory';
      redisAdapterStatus.connected = false;
      redisAdapterStatus.lastError = 'REDIS_URL nao configurada';
      redisAdapterStatus.checkedAt = new Date().toISOString();
      return;
    }

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      // Timeout: 5s — fail fast (Release It! - Timeouts pattern)
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout (5s)')), 5000),
        ),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('✅ Redis Adapter connected — WebSocket can scale horizontally');
      redisAdapterStatus.mode = 'redis';
      redisAdapterStatus.connected = true;
      redisAdapterStatus.lastError = null;
      redisAdapterStatus.checkedAt = new Date().toISOString();
    } catch (error) {
      this.logger.error('❌ Redis Adapter failed — falling back to in-memory adapter');
      this.logger.error(error instanceof Error ? error.message : String(error));
      redisAdapterStatus.mode = 'in-memory';
      redisAdapterStatus.connected = false;
      redisAdapterStatus.lastError = error instanceof Error ? error.message : String(error);
      redisAdapterStatus.checkedAt = new Date().toISOString();
      // Continue without Redis (single instance only)
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
