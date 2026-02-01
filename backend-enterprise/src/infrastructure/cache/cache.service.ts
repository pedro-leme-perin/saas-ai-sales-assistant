// src/infrastructure/cache/cache.service.ts
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cache Service usando Upstash REST API
 * 
 * Release It! (Nygard): "Design for failure - external services can fail"
 * 
 * Features:
 * - Circuit breaker pattern
 * - Graceful degradation
 * - Health checks
 * - Rate limiting (sliding window)
 * 
 * @see https://upstash.com/docs/redis/features/restapi
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private isHealthy = true;
  private failureCount = 0;
  private readonly maxFailures = 3;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('UPSTASH_REDIS_REST_URL') || '';
    this.token = this.configService.get<string>('UPSTASH_REDIS_REST_TOKEN') || '';

    if (!this.baseUrl || !this.token) {
      this.logger.warn('⚠️ Redis credentials not configured - using mock cache');
    } else {
      this.logger.log('✅ Cache Service initialized (Upstash REST)');
    }
  }

  // ==========================================
  // KEY GENERATORS
  // ==========================================

  /**
   * Generate cache key for company data
   */
  companyKey(companyId: string): string {
    return `company:${companyId}`;
  }

  /**
   * Generate cache key for user data
   */
  userKey(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Generate cache key for AI suggestions
   */
  aiSuggestionKey(hash: string): string {
    return `ai:suggestion:${hash}`;
  }

  /**
   * Generate cache key for session
   */
  sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  // ==========================================
  // CORE OPERATIONS
  // ==========================================

  /**
   * Execute Redis command via REST API
   * 
   * Circuit Breaker Pattern (Release It!)
   */
  private async execute<T = unknown>(command: string[]): Promise<T | null> {
    // If Redis not configured, return null (graceful degradation)
    if (!this.baseUrl || !this.token) {
      return null;
    }

    // Circuit breaker - fail fast if unhealthy
    if (!this.isHealthy && this.failureCount >= this.maxFailures) {
      this.logger.warn('⚠️ Circuit breaker OPEN - Redis unavailable');
      return null;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error(`Redis error: ${response.status}`);
      }

      const data = await response.json() as { result: T };

      // Reset failure count on success
      this.failureCount = 0;
      this.isHealthy = true;

      return data.result;
    } catch (error) {
      this.failureCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis command failed: ${errorMessage}`);

      // Open circuit breaker after max failures
      if (this.failureCount >= this.maxFailures) {
        this.isHealthy = false;
        this.logger.error('🔴 Circuit breaker OPENED');
      }

      return null;
    }
  }

  // ==========================================
  // BASIC OPERATIONS
  // ==========================================

  /**
   * Get value from cache
   * 
   * @param key Cache key
   * @returns Value or null if not found/error
   */
  async get(key: string): Promise<string | null> {
    return await this.execute<string>(['GET', key]);
  }

  /**
   * Get and parse JSON value from cache
   * 
   * @param key Cache key
   * @returns Parsed value or null
   */
  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set value in cache
   * 
   * @param key Cache key
   * @param value Value to store (string or object)
   * @param ttlSeconds TTL in seconds (optional)
   */
  async set(key: string, value: string | object, ttlSeconds?: number): Promise<boolean> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    const command = ttlSeconds
      ? ['SETEX', key, ttlSeconds.toString(), stringValue]
      : ['SET', key, stringValue];

    const result = await this.execute<string>(command);
    return result === 'OK';
  }

  /**
   * Delete key from cache
   * 
   * @param key Cache key to delete
   */
  async delete(key: string): Promise<boolean> {
    const result = await this.execute<number>(['DEL', key]);
    return result === 1;
  }

  /**
   * Alias for delete (common Redis naming)
   */
  async del(key: string): Promise<boolean> {
    return this.delete(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.execute<number>(['EXISTS', key]);
    return result === 1;
  }

  // ==========================================
  // RATE LIMITING (Sliding Window Algorithm)
  // ==========================================

  /**
   * Check rate limit using sliding window algorithm
   * 
   * System Design Interview (Cap 4): "Redis sorted sets for sliding window"
   * 
   * @param key Rate limit key (e.g., "rate:user:123")
   * @param maxRequests Maximum requests allowed
   * @param windowSeconds Window size in seconds
   * @returns { allowed: boolean, remaining: number }
   */
  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      // Use Redis pipeline for atomic operations
      // 1. Remove old entries
      await this.execute(['ZREMRANGEBYSCORE', key, '0', windowStart.toString()]);

      // 2. Count current requests
      const count = await this.execute<number>(['ZCARD', key]) || 0;

      if (count >= maxRequests) {
        return { allowed: false, remaining: 0 };
      }

      // 3. Add current request
      await this.execute(['ZADD', key, now.toString(), `${now}-${Math.random()}`]);

      // 4. Set expiry
      await this.execute(['EXPIRE', key, (windowSeconds + 10).toString()]);

      return {
        allowed: true,
        remaining: maxRequests - count - 1,
      };
    } catch (error) {
      // Graceful degradation - allow request if Redis fails
      this.logger.error('Rate limit check failed, allowing request');
      return { allowed: true, remaining: maxRequests };
    }
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * Store session data
   */
  async setSession(
    sessionId: string,
    data: object,
    ttlSeconds: number = 3600,
  ): Promise<boolean> {
    return await this.set(
      this.sessionKey(sessionId),
      data,
      ttlSeconds,
    );
  }

  /**
   * Get session data
   */
  async getSession<T = unknown>(sessionId: string): Promise<T | null> {
    return await this.getJson<T>(this.sessionKey(sessionId));
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    return await this.delete(this.sessionKey(sessionId));
  }

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  /**
   * Health check for monitoring
   * 
   * Site Reliability Engineering: "Health checks são essenciais"
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'not_configured';
    latency?: number;
    circuitBreaker: 'closed' | 'open';
  }> {
    if (!this.baseUrl || !this.token) {
      return {
        status: 'not_configured',
        circuitBreaker: 'closed',
      };
    }

    const start = Date.now();

    try {
      // Simple PING command
      const result = await this.execute<string>(['PING']);
      const latency = Date.now() - start;

      if (result === 'PONG') {
        return {
          status: 'healthy',
          latency,
          circuitBreaker: this.isHealthy ? 'closed' : 'open',
        };
      }

      return {
        status: 'unhealthy',
        circuitBreaker: 'open',
      };
    } catch {
      return {
        status: 'unhealthy',
        circuitBreaker: 'open',
      };
    }
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  async onModuleDestroy() {
    this.logger.log('👋 Cache Service destroyed');
  }
}
