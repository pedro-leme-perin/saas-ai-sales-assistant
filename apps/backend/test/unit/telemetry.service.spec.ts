// =====================================================
// 📊 TELEMETRY SERVICE — Unit Tests
// SRE Book: Four Golden Signals (latency, traffic, errors, saturation)
// =====================================================

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TelemetryService } from '../../src/infrastructure/telemetry/telemetry.service';
import { SpanStatusCode } from '@opentelemetry/api';

// Suppress logger output during tests
jest.spyOn(Logger.prototype, 'warn').mockImplementation();

// Mock @opentelemetry/api — factory creates mocks internally (jest hoists jest.mock)
jest.mock('@opentelemetry/api', () => {
  const mockCounterAdd = jest.fn();
  const mockHistogramRecord = jest.fn();
  const mockUpDownCounterAdd = jest.fn();

  const mockSpan = {
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    spanContext: jest.fn().mockReturnValue({ traceId: 'abc123', spanId: 'def456' }),
  };

  return {
    __mocks: { mockCounterAdd, mockHistogramRecord, mockUpDownCounterAdd, mockSpan },
    metrics: {
      getMeter: jest.fn().mockReturnValue({
        createCounter: jest.fn().mockReturnValue({ add: mockCounterAdd }),
        createHistogram: jest.fn().mockReturnValue({ record: mockHistogramRecord }),
        createUpDownCounter: jest.fn().mockReturnValue({ add: mockUpDownCounterAdd }),
      }),
    },
    trace: {
      getTracer: jest.fn().mockReturnValue({
        startActiveSpan: jest
          .fn()
          .mockImplementation((_name: string, _opts: unknown, fn: (s: unknown) => unknown) =>
            fn(mockSpan),
          ),
      }),
      getActiveSpan: jest.fn().mockReturnValue(mockSpan),
    },
    SpanKind: { INTERNAL: 0 },
    SpanStatusCode: { OK: 1, ERROR: 2 },
  };
});

// Retrieve the internal mocks AFTER jest.mock has run
const otelMock = jest.requireMock('@opentelemetry/api') as {
  __mocks: {
    mockCounterAdd: jest.Mock;
    mockHistogramRecord: jest.Mock;
    mockUpDownCounterAdd: jest.Mock;
    mockSpan: {
      setAttribute: jest.Mock;
      setStatus: jest.Mock;
      recordException: jest.Mock;
      end: jest.Mock;
      spanContext: jest.Mock;
    };
  };
  trace: { getActiveSpan: jest.Mock };
};
const { mockCounterAdd, mockHistogramRecord, mockUpDownCounterAdd, mockSpan } = otelMock.__mocks;

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemetryService],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  // ── Traffic Signal ───────────────────────────────────

  describe('recordRequest', () => {
    it('should increment request counter and record duration', () => {
      service.recordRequest('GET', '/api/calls', 200, 45);

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        method: 'GET',
        route: '/api/calls',
        status_code: 200,
      });
      expect(mockHistogramRecord).toHaveBeenCalledWith(45, {
        method: 'GET',
        route: '/api/calls',
        status_code: 200,
      });
    });

    it('should handle error status codes', () => {
      service.recordRequest('POST', '/api/auth', 500, 120);

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        method: 'POST',
        route: '/api/auth',
        status_code: 500,
      });
    });
  });

  describe('recordAISuggestion', () => {
    it('should record successful AI suggestion', () => {
      service.recordAISuggestion('openai', 850, true);

      expect(mockCounterAdd).toHaveBeenCalledWith(1, { provider: 'openai', success: true });
      expect(mockHistogramRecord).toHaveBeenCalledWith(850, { provider: 'openai', success: true });
    });

    it('should increment error counter on failure', () => {
      service.recordAISuggestion('openai', 5000, false);

      expect(mockCounterAdd).toHaveBeenCalledWith(1, { provider: 'openai', success: false });
      expect(mockCounterAdd).toHaveBeenCalledWith(1, { provider: 'openai' });
    });
  });

  // ── Error Signal ─────────────────────────────────────

  describe('recordCircuitBreakerTrip', () => {
    it('should increment circuit breaker counter', () => {
      service.recordCircuitBreakerTrip('deepgram');

      expect(mockCounterAdd).toHaveBeenCalledWith(1, { integration: 'deepgram' });
    });
  });

  describe('recordWebhook', () => {
    it('should increment webhook counter with provider and event', () => {
      service.recordWebhook('stripe', 'invoice.paid');

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        provider: 'stripe',
        event: 'invoice.paid',
      });
    });
  });

  // ── Latency Signal ───────────────────────────────────

  describe('recordDbQuery', () => {
    it('should record database query duration', () => {
      service.recordDbQuery('findMany', 'User', 12);

      expect(mockHistogramRecord).toHaveBeenCalledWith(12, {
        operation: 'findMany',
        model: 'User',
      });
    });
  });

  // ── Saturation Signal ────────────────────────────────

  describe('WebSocket connection tracking', () => {
    it('should increment on connection opened', () => {
      service.wsConnectionOpened();
      expect(mockUpDownCounterAdd).toHaveBeenCalledWith(1);
    });

    it('should decrement on connection closed', () => {
      service.wsConnectionClosed();
      expect(mockUpDownCounterAdd).toHaveBeenCalledWith(-1);
    });
  });

  // ── Span Management ──────────────────────────────────

  describe('withSpan', () => {
    it('should execute function within a traced span', async () => {
      const result = await service.withSpan('test.operation', { key: 'value' }, async (span) => {
        span.setAttribute('custom', 'attr');
        return 42;
      });

      expect(result).toBe(42);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('custom', 'attr');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record exception and re-throw on error', async () => {
      const error = new Error('Operation failed');

      await expect(
        service.withSpan('test.failing', {}, async () => {
          throw error;
        }),
      ).rejects.toThrow('Operation failed');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Operation failed',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      await expect(
        service.withSpan('test.string-error', {}, async () => {
          throw 'string error';
        }),
      ).rejects.toBe('string error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Unknown error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(new Error('string error'));
    });

    it('should always end span even on error', async () => {
      try {
        await service.withSpan('test.always-end', {}, async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      expect(mockSpan.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTraceContext', () => {
    it('should return trace and span IDs from active span', () => {
      const ctx = service.getTraceContext();

      expect(ctx).toEqual({ traceId: 'abc123', spanId: 'def456' });
    });

    it('should return null when no active span', () => {
      otelMock.trace.getActiveSpan.mockReturnValueOnce(null);

      const ctx = service.getTraceContext();

      expect(ctx).toBeNull();
    });
  });
});
