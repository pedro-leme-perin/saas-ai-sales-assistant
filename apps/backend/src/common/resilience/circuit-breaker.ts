// =====================================================
// CIRCUIT BREAKER
// =====================================================
// Implementation based on Release It! - Stability Patterns
//
// States:
//   CLOSED  → Normal operation, calls pass through
//   OPEN    → Failures exceeded threshold, calls fail fast
//   HALF_OPEN → Testing if service recovered
//
// State transitions:
//   CLOSED → OPEN: When failure count exceeds threshold within window
//   OPEN → HALF_OPEN: After resetTimeout expires
//   HALF_OPEN → CLOSED: If trial call succeeds
//   HALF_OPEN → OPEN: If trial call fails
//
// "Circuit breaker tripping is abnormal and must be visible to Ops"
// =====================================================

import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Name for logging (e.g., 'OpenAI', 'Deepgram') */
  name: string;
  /** Max failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms before trying again (OPEN → HALF_OPEN) */
  resetTimeoutMs?: number;
  /** Time window in ms to count failures */
  failureWindowMs?: number;
  /** Timeout for each call in ms (Release It! - Timeouts pattern) */
  callTimeoutMs?: number;
  /** Fallback function when circuit is open */
  fallback?: () => Promise<unknown>;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = []; // timestamps of failures
  private lastFailureTime = 0;
  private readonly logger: Logger;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly failureWindowMs: number;
  private readonly callTimeoutMs: number;
  private readonly fallback?: () => Promise<unknown>;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.logger = new Logger(`CircuitBreaker:${options.name}`);
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000; // 30s
    this.failureWindowMs = options.failureWindowMs ?? 60000; // 60s
    this.callTimeoutMs = options.callTimeoutMs ?? 10000; // 10s
    this.fallback = options.fallback;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // ── OPEN: Fail fast (Release It! - Fail Fast pattern) ──
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.warn(`⚡ ${this.options.name}: OPEN → HALF_OPEN (testing recovery)`);
      } else {
        this.logger.warn(`🚫 ${this.options.name}: Circuit OPEN — failing fast`);
        if (this.fallback) {
          return this.fallback() as Promise<T>;
        }
        throw new Error(`Circuit breaker OPEN for ${this.options.name}`);
      }
    }

    try {
      // ── Apply timeout (Release It! - Timeouts pattern) ──
      const result = await this.withTimeout(fn(), this.callTimeoutMs);

      // Success: reset on HALF_OPEN → CLOSED
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.failures = [];
        this.logger.log(`✅ ${this.options.name}: HALF_OPEN → CLOSED (recovered)`);
      }

      return result;
    } catch (error) {
      this.recordFailure();

      // HALF_OPEN failure → back to OPEN
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.OPEN;
        this.lastFailureTime = Date.now();
        this.logger.error(`❌ ${this.options.name}: HALF_OPEN → OPEN (still failing)`);
      }

      // Check if we should trip the circuit
      if (this.state === CircuitState.CLOSED && this.shouldTrip()) {
        this.state = CircuitState.OPEN;
        this.lastFailureTime = Date.now();
        this.logger.error(
          `🔴 ${this.options.name}: CLOSED → OPEN (${this.getRecentFailures()} failures in ${this.failureWindowMs / 1000}s)`,
        );
      }

      if (this.fallback) {
        this.logger.warn(`↩️ ${this.options.name}: Using fallback`);
        return this.fallback() as Promise<T>;
      }

      throw error;
    }
  }

  /** Get current circuit state */
  getState(): CircuitState {
    return this.state;
  }

  /** Get health info for /health endpoint */
  getHealthInfo() {
    return {
      name: this.options.name,
      state: this.state,
      recentFailures: this.getRecentFailures(),
      failureThreshold: this.failureThreshold,
    };
  }

  /** Manually reset (for ops intervention) */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.logger.log(`🔧 ${this.options.name}: Manually reset to CLOSED`);
  }

  // ── Private helpers ──

  private recordFailure(): void {
    this.failures.push(Date.now());
    // Prune old failures outside window
    const cutoff = Date.now() - this.failureWindowMs;
    this.failures = this.failures.filter((t) => t > cutoff);
  }

  private getRecentFailures(): number {
    const cutoff = Date.now() - this.failureWindowMs;
    return this.failures.filter((t) => t > cutoff).length;
  }

  private shouldTrip(): boolean {
    return this.getRecentFailures() >= this.failureThreshold;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeoutMs}ms for ${this.options.name}`)),
          timeoutMs,
        ),
      ),
    ]);
  }
}
