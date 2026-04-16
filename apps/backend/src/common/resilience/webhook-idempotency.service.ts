// =============================================
// Webhook Idempotency Service (Release It! — Stability Patterns)
// =============================================
// Prevents duplicate webhook processing using Redis SETNX + TTL.
// Each webhook event ID is stored with a 48h TTL (covers Stripe retry window).
// Pattern: check-before-process with atomic SET NX EX.
// Refs: Release It! — Idempotent Receivers; DDIA Cap. 11 — Exactly-Once Semantics
// =============================================

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';

export interface WebhookProcessResult {
  /** Whether this event was already processed */
  isDuplicate: boolean;
  /** Correlation ID for structured logging */
  correlationId: string;
}

@Injectable()
export class WebhookIdempotencyService {
  private readonly logger = new Logger(WebhookIdempotencyService.name);

  /** 48 hours — covers Stripe's retry window (up to 72h) with margin */
  private readonly DEFAULT_TTL_SECONDS = 48 * 60 * 60;

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Check if a webhook event has already been processed.
   * Uses Redis SETNX (set-if-not-exists) for atomic deduplication.
   *
   * @param source - Webhook source (stripe, clerk, whatsapp)
   * @param eventId - Unique event identifier
   * @param ttlSeconds - TTL for the dedup key (default: 48h)
   * @returns WebhookProcessResult with isDuplicate flag and correlationId
   */
  async checkAndMark(
    source: 'stripe' | 'clerk' | 'whatsapp',
    eventId: string,
    ttlSeconds?: number,
  ): Promise<WebhookProcessResult> {
    const key = this.buildKey(source, eventId);
    const correlationId = `wh_${source}_${eventId}`;
    const ttl = ttlSeconds ?? this.DEFAULT_TTL_SECONDS;

    try {
      // Check if already processed
      const exists = await this.cacheService.exists(key);

      if (exists) {
        this.logger.warn(
          `Duplicate webhook detected [${correlationId}] source=${source} eventId=${eventId}`,
        );
        return { isDuplicate: true, correlationId };
      }

      // Mark as processing (atomic set with TTL)
      await this.cacheService.set(key, { processedAt: new Date().toISOString(), source }, ttl);

      this.logger.debug(`Webhook marked for processing [${correlationId}]`);
      return { isDuplicate: false, correlationId };
    } catch (error) {
      // Graceful degradation: if Redis fails, allow processing (at-least-once > at-most-once)
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Idempotency check failed [${correlationId}]: ${message} — allowing processing`,
      );
      return { isDuplicate: false, correlationId };
    }
  }

  private buildKey(source: string, eventId: string): string {
    return `webhook:dedup:${source}:${eventId}`;
  }
}
