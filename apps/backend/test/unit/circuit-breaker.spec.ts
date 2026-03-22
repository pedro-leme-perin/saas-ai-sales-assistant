import { CircuitBreaker, CircuitState } from '../../src/common/resilience/circuit-breaker';

jest.setTimeout(15000);

describe('CircuitBreaker', () => {
  describe('Initialization', () => {
    it('should start in CLOSED state', () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should use default options when not provided', () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const healthInfo = cb.getHealthInfo();
      expect(healthInfo.state).toBe(CircuitState.CLOSED);
      expect(healthInfo.failureThreshold).toBe(5);
    });

    it('should accept custom options', () => {
      const cb = new CircuitBreaker({
        name: 'CustomService',
        failureThreshold: 3,
        resetTimeoutMs: 200,
        failureWindowMs: 500,
        callTimeoutMs: 100,
      });
      const healthInfo = cb.getHealthInfo();
      expect(healthInfo.failureThreshold).toBe(3);
    });
  });

  describe('CLOSED state behavior', () => {
    it('should pass successful calls through in CLOSED state', async () => {
      const cb = new CircuitBreaker({ name: 'TestService', failureThreshold: 2 });
      const fn = jest.fn().mockResolvedValue('success');

      const result = await cb.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should record failures but stay CLOSED below threshold', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 3,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // First failure - should stay CLOSED
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getHealthInfo().recentFailures).toBe(1);

      // Second failure - should stay CLOSED
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getHealthInfo().recentFailures).toBe(2);
    });

    it('should transition CLOSED → OPEN after failureThreshold failures', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 2,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Two failures should trip the circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      expect(cb.getState()).toBe(CircuitState.OPEN);
      expect(cb.getHealthInfo().state).toBe(CircuitState.OPEN);
      expect(cb.getHealthInfo().recentFailures).toBe(2);
    });

    it('should handle multiple successful calls without state change', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const fn = jest.fn().mockResolvedValue('success');

      await cb.execute(fn);
      await cb.execute(fn);
      await cb.execute(fn);

      expect(fn).toHaveBeenCalledTimes(3);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('OPEN state behavior', () => {
    it('should fail fast when OPEN (throws error)', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Now the circuit is OPEN - should fail fast without calling fn again
      const fn2 = jest.fn();
      await expect(cb.execute(fn2)).rejects.toThrow('Circuit breaker OPEN for TestService');
      expect(fn2).not.toHaveBeenCalled(); // fn2 should not be executed
    });

    it('should use fallback when OPEN and fallback provided', async () => {
      const fallbackFn = jest.fn().mockResolvedValue('fallback response');
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
        fallback: fallbackFn,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit — with fallback, execute resolves with fallback instead of rejecting
      const fallbackResult = await cb.execute(fn);
      expect(fallbackResult).toBe('fallback response');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Circuit is OPEN, fallback should be called again
      const result = await cb.execute(jest.fn());
      expect(result).toBe('fallback response');
      expect(fallbackFn).toHaveBeenCalledTimes(2);
    });

    it('should prevent cascading failures while OPEN', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      // Multiple rapid calls should fail fast without executing fn
      const fn2 = jest.fn();
      await expect(cb.execute(fn2)).rejects.toThrow('Circuit breaker OPEN');
      await expect(cb.execute(fn2)).rejects.toThrow('Circuit breaker OPEN');
      await expect(cb.execute(fn2)).rejects.toThrow('Circuit breaker OPEN');

      expect(fn2).not.toHaveBeenCalled();
    });
  });

  describe('State transitions OPEN → HALF_OPEN', () => {
    it('should transition OPEN → HALF_OPEN → CLOSED after resetTimeout expires and success', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        resetTimeoutMs: 200,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for resetTimeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Next call transitions HALF_OPEN then succeeds → CLOSED
      const successFn = jest.fn().mockResolvedValue('recovered');
      const result = await cb.execute(successFn);

      expect(result).toBe('recovered');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should remain OPEN until resetTimeout expires', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        resetTimeoutMs: 300,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait less than resetTimeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be OPEN
      const fn2 = jest.fn();
      await expect(cb.execute(fn2)).rejects.toThrow('Circuit breaker OPEN');
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('State transitions HALF_OPEN → CLOSED/OPEN', () => {
    it('should transition HALF_OPEN → CLOSED on success', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        resetTimeoutMs: 200,
        failureWindowMs: 5000,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(failFn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for resetTimeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Successful call in HALF_OPEN state
      const successFn = jest.fn().mockResolvedValue('recovered');
      const result = await cb.execute(successFn);

      expect(result).toBe('recovered');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getHealthInfo().recentFailures).toBe(0); // Failures cleared
    });

    it('should transition HALF_OPEN → OPEN on failure', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        resetTimeoutMs: 200,
        failureWindowMs: 5000,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(failFn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for resetTimeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Failing call in HALF_OPEN state
      const stillFailingFn = jest.fn().mockRejectedValue(new Error('Still broken'));
      await expect(cb.execute(stillFailingFn)).rejects.toThrow('Still broken');

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should use fallback when HALF_OPEN call fails and fallback provided', async () => {
      const fallbackFn = jest.fn().mockResolvedValue('fallback data');
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        resetTimeoutMs: 200,
        failureWindowMs: 5000,
        fallback: fallbackFn,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit — with fallback, resolves instead of rejecting
      const fallbackResult = await cb.execute(failFn);
      expect(fallbackResult).toBe('fallback data');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for resetTimeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Failing call in HALF_OPEN state should return fallback
      const stillFailingFn = jest.fn().mockRejectedValue(new Error('Still broken'));
      const result = await cb.execute(stillFailingFn);

      expect(result).toBe('fallback data');
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Health info', () => {
    it('should return correct health info in CLOSED state', () => {
      const cb = new CircuitBreaker({
        name: 'MyService',
        failureThreshold: 3,
        failureWindowMs: 5000,
      });

      const health = cb.getHealthInfo();
      expect(health.name).toBe('MyService');
      expect(health.state).toBe(CircuitState.CLOSED);
      expect(health.recentFailures).toBe(0);
      expect(health.failureThreshold).toBe(3);
    });

    it('should return correct health info in OPEN state', async () => {
      const cb = new CircuitBreaker({
        name: 'MyService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      const health = cb.getHealthInfo();
      expect(health.name).toBe('MyService');
      expect(health.state).toBe(CircuitState.OPEN);
      expect(health.recentFailures).toBe(1);
      expect(health.failureThreshold).toBe(1);
    });

    it('should track multiple failures correctly', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 5,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getHealthInfo().recentFailures).toBe(1);

      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getHealthInfo().recentFailures).toBe(2);

      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getHealthInfo().recentFailures).toBe(3);
    });
  });

  describe('Reset functionality', () => {
    it('should reset to CLOSED and clear failures', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);
      expect(cb.getHealthInfo().recentFailures).toBe(1);

      // Reset
      cb.reset();

      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getHealthInfo().recentFailures).toBe(0);
    });

    it('should allow normal operation after reset', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip the circuit
      await expect(cb.execute(failFn)).rejects.toThrow('Test error');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Reset
      cb.reset();

      // Should now execute successfully
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await cb.execute(successFn);

      expect(result).toBe('success');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should accept multiple resets', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trip and reset multiple times
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(fn)).rejects.toThrow('Test error');
        expect(cb.getState()).toBe(CircuitState.OPEN);
        cb.reset();
        expect(cb.getState()).toBe(CircuitState.CLOSED);
      }
    });
  });

  describe('Timeout handling', () => {
    it('should trigger failure when call exceeds callTimeoutMs', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        callTimeoutMs: 50,
        failureWindowMs: 5000,
      });
      const slowFn = jest.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('slow'), 500);
          }),
      );

      await expect(cb.execute(slowFn)).rejects.toThrow(/Timeout after 50ms/);
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should complete call before timeout', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        callTimeoutMs: 500,
        failureWindowMs: 5000,
      });
      const quickFn = jest.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('quick'), 50);
          }),
      );

      const result = await cb.execute(quickFn);
      expect(result).toBe('quick');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should use fallback when timeout occurs and fallback provided', async () => {
      const fallbackFn = jest.fn().mockResolvedValue('fallback');
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        callTimeoutMs: 50,
        failureWindowMs: 5000,
        fallback: fallbackFn,
      });
      const slowFn = jest.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('slow'), 500);
          }),
      );

      const result = await cb.execute(slowFn);
      expect(result).toBe('fallback');
      expect(fallbackFn).toHaveBeenCalled();
    });
  });

  describe('Failure window pruning', () => {
    it('should prune old failures outside window', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 5,
        failureWindowMs: 200,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Record a failure
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getHealthInfo().recentFailures).toBe(1);

      // Wait for the failure to age out
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Record another failure - old one should be pruned
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      expect(cb.getHealthInfo().recentFailures).toBe(1); // Only the new failure
    });

    it('should keep failures within window and prune old ones', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 10,
        failureWindowMs: 300,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Record failures
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await expect(cb.execute(fn)).rejects.toThrow('Test error');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      expect(cb.getHealthInfo().recentFailures).toBe(3);

      // Wait for first failure to age out
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Record another failure
      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      // Should have 3 failures (first one pruned)
      expect(cb.getHealthInfo().recentFailures).toBe(3);
    });
  });

  describe('Generic type handling', () => {
    it('should return correct type from successful call', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });

      interface User {
        id: number;
        name: string;
      }

      const fn = jest.fn().mockResolvedValue({ id: 1, name: 'Test' } as User);
      const result = await cb.execute<User>(fn);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
    });

    it('should handle fallback with correct type', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        fallback: async () => ({ default: true }),
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // With fallback, execute resolves with fallback on error
      const fallbackResult = await cb.execute<{ default: boolean }>(fn);
      expect(fallbackResult.default).toBe(true);
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Should return fallback with correct structure when OPEN
      const result = await cb.execute<{ default: boolean }>(jest.fn());
      expect(result.default).toBe(true);
    });
  });

  describe('Concurrent calls', () => {
    it('should handle multiple concurrent calls in CLOSED state', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const fn = jest.fn(
        (delay: number) =>
          new Promise((resolve) => {
            setTimeout(() => resolve(`result-${delay}`), delay);
          }),
      );

      const promises = [
        cb.execute(() => fn(10)),
        cb.execute(() => fn(20)),
        cb.execute(() => fn(30)),
      ];

      const results = await Promise.all(promises);
      expect(results).toEqual(['result-10', 'result-20', 'result-30']);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should handle concurrent calls when circuit trips', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));

      // First call fails and trips circuit
      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      // Concurrent calls should all fail fast
      const promises = [cb.execute(jest.fn()), cb.execute(jest.fn()), cb.execute(jest.fn())];

      await Promise.allSettled(promises);
      const results = await Promise.allSettled(promises);

      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined returns from successful calls', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const fn = jest.fn().mockResolvedValue(null);

      const result = await cb.execute(fn);
      expect(result).toBeNull();
    });

    it('should handle empty string returns', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const fn = jest.fn().mockResolvedValue('');

      const result = await cb.execute(fn);
      expect(result).toBe('');
    });

    it('should handle zero returns', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const fn = jest.fn().mockResolvedValue(0);

      const result = await cb.execute(fn);
      expect(result).toBe(0);
    });

    it('should handle false boolean returns', async () => {
      const cb = new CircuitBreaker({ name: 'TestService' });
      const fn = jest.fn().mockResolvedValue(false);

      const result = await cb.execute(fn);
      expect(result).toBe(false);
    });

    it('should not confuse 0 failure count with no failures', async () => {
      const cb = new CircuitBreaker({
        name: 'TestService',
        failureThreshold: 1,
        failureWindowMs: 5000,
      });

      expect(cb.getHealthInfo().recentFailures).toBe(0);

      const fn = jest.fn().mockRejectedValue(new Error('Test error'));
      await expect(cb.execute(fn)).rejects.toThrow('Test error');

      expect(cb.getHealthInfo().recentFailures).toBe(1);
    });
  });
});
