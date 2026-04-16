import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import {
  TransformInterceptor,
  ApiResponse,
} from '../../src/common/interceptors/transform.interceptor';
import { RequestLoggerMiddleware } from '../../src/common/middleware/request-logger.middleware';

jest.setTimeout(10000);

// =====================================================================
// MOCK BUILDERS
// =====================================================================

interface ExtendedRequest extends Request {
  requestId?: string;
}

function createMockRequest(
  method = 'GET',
  url = '/api/calls',
  user?: { id: string; companyId: string },
): ExtendedRequest {
  return {
    method,
    url,
    originalUrl: url,
    headers: {},
    user,
    ip: '127.0.0.1',
    connection: {
      remoteAddress: '127.0.0.1',
    } as unknown,
    get: jest.fn((_header: string) => ''),
  } as unknown as ExtendedRequest;
}

function createMockResponse(statusCode = 200): Response & { statusCode?: number } {
  return {
    statusCode,
    setHeader: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  } as unknown as Response & { statusCode?: number };
}

function createMockExecutionContext(request: Request, response: Response): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext;
}

function createMockCallHandler<T>(data: T, shouldError = false): CallHandler {
  return {
    handle: () => {
      if (shouldError) {
        return throwError(() => new Error('Handler error'));
      }
      return of(data);
    },
  };
}

// =====================================================================
// LOGGING INTERCEPTOR TESTS
// =====================================================================

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('intercept - Basic Functionality', () => {
    it('should extract and set request ID from headers', (done) => {
      const request = createMockRequest();
      (request as unknown as Record<string, unknown>).headers = { 'x-request-id': 'req-12345' };
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ success: true });

      interceptor.intercept(context, handler).subscribe(() => {
        expect(request.requestId).toBe('req-12345');
        expect(response.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-12345');
        done();
      });
    });

    it('should generate UUID if request ID not in headers', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ success: true });

      interceptor.intercept(context, handler).subscribe(() => {
        expect(request.requestId).toBeDefined();
        expect(request.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        done();
      });
    });

    it('should call next.handle()', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ success: true });
      const handleSpy = jest.spyOn(handler, 'handle');

      interceptor.intercept(context, handler).subscribe(() => {
        expect(handleSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should return an Observable', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ data: 'test' });

      const result = interceptor.intercept(context, handler);
      expect(result.subscribe).toBeDefined();
      result.subscribe(() => {
        done();
      });
    });
  });

  describe('intercept - Request Logging', () => {
    it('should log REQUEST with all required fields', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest('POST', '/api/calls', {
        id: 'user-123',
        companyId: 'company-456',
      });
      (request as unknown as Record<string, unknown>).headers = { 'user-agent': 'Mozilla/5.0' };
      (request as unknown as Record<string, unknown>).ip = '192.168.1.100';
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ success: true });

      interceptor.intercept(context, handler).subscribe(() => {
        const calls = logSpy.mock.calls;
        const requestLog = calls.find(
          (call) => typeof call[0] === 'object' && call[0]?.type === 'REQUEST',
        );

        expect(requestLog).toBeDefined();
        const logData = requestLog![0] as Record<string, unknown>;
        expect(logData).toEqual(
          expect.objectContaining({
            type: 'REQUEST',
            requestId: expect.any(String),
            method: 'POST',
            url: '/api/calls',
            userId: 'user-123',
            companyId: 'company-456',
          }),
        );

        logSpy.mockRestore();
        done();
      });
    });

    it('should log RESPONSE on successful request', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse(200);
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ data: 'success' });

      interceptor.intercept(context, handler).subscribe(() => {
        const calls = logSpy.mock.calls;
        const responseLog = calls.find(
          (call) => typeof call[0] === 'object' && call[0]?.type === 'RESPONSE',
        );

        expect(responseLog).toBeDefined();
        const logData = responseLog![0] as Record<string, unknown>;
        expect(logData).toEqual(
          expect.objectContaining({
            type: 'RESPONSE',
            statusCode: 200,
            duration: expect.stringMatching(/^\d+ms$/),
          }),
        );

        logSpy.mockRestore();
        done();
      });
    });

    it('should log ERROR when handler throws', (done) => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse(500);
      const context = createMockExecutionContext(request, response);

      const handler = createMockCallHandler(null, true);

      interceptor.intercept(context, handler).subscribe({
        next: () => {
          // Should not reach here
          expect(true).toBe(false);
          done();
        },
        error: () => {
          const calls = errorSpy.mock.calls;
          const errorLog = calls.find(
            (call) => typeof call[0] === 'object' && call[0]?.type === 'ERROR',
          );

          expect(errorLog).toBeDefined();
          const logData = errorLog![0] as Record<string, unknown>;
          expect(logData).toEqual(
            expect.objectContaining({
              type: 'ERROR',
              statusCode: 500,
              error: expect.stringContaining('Handler error'),
            }),
          );

          errorSpy.mockRestore();
          done();
        },
      });
    });
  });

  describe('intercept - Edge Cases', () => {
    it('should handle null response data', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler(null);

      interceptor.intercept(context, handler).subscribe(() => {
        expect(logSpy).toHaveBeenCalledTimes(2); // REQUEST + RESPONSE
        logSpy.mockRestore();
        done();
      });
    });

    it('should maintain request ID consistency across logs', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest();
      (request as unknown as Record<string, unknown>).headers = {
        'x-request-id': 'consistent-id-123',
      };
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, handler).subscribe(() => {
        const calls = logSpy.mock.calls;
        const requestLog = calls.find(
          (call) => typeof call[0] === 'object' && call[0]?.type === 'REQUEST',
        )?.[0] as Record<string, unknown>;
        const responseLog = calls.find(
          (call) => typeof call[0] === 'object' && call[0]?.type === 'RESPONSE',
        )?.[0] as Record<string, unknown>;

        expect(requestLog?.requestId).toBe(responseLog?.requestId);
        expect(requestLog?.requestId).toBe('consistent-id-123');

        logSpy.mockRestore();
        done();
      });
    });
  });
});

// =====================================================================
// TRANSFORM INTERCEPTOR TESTS
// =====================================================================

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  describe('intercept - Standard Response', () => {
    it('should transform plain data into ApiResponse format', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ name: 'John', email: 'john@example.com' });

      interceptor.intercept(context, handler).subscribe((result) => {
        expect(result).toEqual(
          expect.objectContaining({
            success: true,
            data: { name: 'John', email: 'john@example.com' },
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          }),
        );
        done();
      });
    });

    it('should include success: true in response', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler([1, 2, 3]);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.success).toBe(true);
        done();
      });
    });

    it('should add ISO timestamp to response', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ id: '123' });

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        done();
      });
    });

    it('should preserve data as-is in response', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const testData = { id: '123', name: 'Test', nested: { value: 42 } };
      const handler = createMockCallHandler(testData);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.data).toEqual(testData);
        done();
      });
    });

    it('should not include meta when not provided', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.meta).toBeUndefined();
        done();
      });
    });
  });

  describe('intercept - Pagination Response', () => {
    it('should handle response with data and meta pagination fields', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const paginatedData = {
        data: [{ id: '1' }, { id: '2' }],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
        },
      };
      const handler = createMockCallHandler(paginatedData);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as ApiResponse<unknown>;
        expect(apiResponse).toEqual(
          expect.objectContaining({
            success: true,
            data: [{ id: '1' }, { id: '2' }],
            meta: {
              total: 100,
              page: 1,
              limit: 10,
              totalPages: 10,
            },
            timestamp: expect.any(String),
          }),
        );
        done();
      });
    });

    it('should preserve partial meta fields', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const data = {
        data: [{ id: '1' }],
        meta: {
          total: 50,
          page: 2,
        },
      };
      const handler = createMockCallHandler(data);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        const meta = apiResponse.meta as Record<string, unknown>;
        expect(meta.total).toBe(50);
        expect(meta.page).toBe(2);
        expect(meta.limit).toBeUndefined();
        done();
      });
    });
  });

  describe('intercept - Already Formatted Response', () => {
    it('should return response as-is if success property exists', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const alreadyFormatted: ApiResponse<{ name: string }> = {
        success: true,
        data: { name: 'Already formatted' },
        timestamp: '2024-03-20T10:00:00Z',
      };
      const handler = createMockCallHandler(alreadyFormatted);

      interceptor.intercept(context, handler).subscribe((result) => {
        expect(result).toEqual(alreadyFormatted);
        done();
      });
    });
  });

  describe('intercept - Null & Undefined Handling', () => {
    it('should handle null data', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler(null);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.success).toBe(true);
        expect(apiResponse.data).toBeNull();
        done();
      });
    });

    it('should handle undefined data', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler(undefined);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.success).toBe(true);
        expect(apiResponse.data).toBeUndefined();
        done();
      });
    });
  });

  describe('intercept - Edge Cases', () => {
    it('should handle empty array data', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler([]);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.data).toEqual([]);
        done();
      });
    });

    it('should handle boolean data', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const handler = createMockCallHandler(true);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.data).toBe(true);
        done();
      });
    });

    it('should handle deeply nested data structures', (done) => {
      const request = createMockRequest();
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const complexData = {
        level1: {
          level2: {
            level3: {
              items: [1, 2, 3],
            },
          },
        },
      };
      const handler = createMockCallHandler(complexData);

      interceptor.intercept(context, handler).subscribe((result: unknown) => {
        const apiResponse = result as Record<string, unknown>;
        expect(apiResponse.data).toEqual(complexData);
        done();
      });
    });
  });
});

// =====================================================================
// REQUEST LOGGER MIDDLEWARE TESTS
// =====================================================================

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;

  beforeEach(() => {
    middleware = new RequestLoggerMiddleware();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('use - Basic Functionality', () => {
    it('should call next() to proceed with request', () => {
      const request = createMockRequest();
      const response = createMockResponse();
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should attach finish event listener to response', () => {
      const request = createMockRequest();
      const response = createMockResponse();
      const onSpy = jest.spyOn(response, 'on');
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      expect(onSpy).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  describe('use - Logging on Response Finish', () => {
    it('should log successful response (2xx) with log level', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest('GET', '/api/calls');
      const response = createMockResponse(200);
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      // Simulate response finish
      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/api\/calls 200/));

      logSpy.mockRestore();
    });

    it('should log client errors (4xx) with warn level', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const request = createMockRequest('POST', '/api/users');
      const response = createMockResponse(400);
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/POST \/api\/users 400/));

      warnSpy.mockRestore();
    });

    it('should log server errors (5xx) with error level', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const request = createMockRequest('GET', '/api/data');
      const response = createMockResponse(500);
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/api\/data 500/));

      errorSpy.mockRestore();
    });
  });

  describe('use - Request Information Logging', () => {
    it('should log HTTP method', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest('PATCH', '/api/test');
      const response = createMockResponse(200);
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('PATCH'));

      logSpy.mockRestore();
    });

    it('should log response status code', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest('GET', '/api/test');
      const response = createMockResponse(201);
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('201'));

      logSpy.mockRestore();
    });

    it('should log duration in milliseconds', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse(200);
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/\d+ms$/));

      logSpy.mockRestore();
    });
  });

  describe('use - Boundary Status Codes', () => {
    it('should handle boundary status code 399 as successful', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse();
      response.statusCode = 399;
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle boundary status code 400 as client error', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse();
      response.statusCode = 400;
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should handle boundary status code 500 as server error', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const request = createMockRequest();
      const response = createMockResponse();
      response.statusCode = 500;
      const next = jest.fn();

      middleware.use(request, response as Response, next);

      const finishCallback = (response.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'finish',
      )?.[1];

      if (typeof finishCallback === 'function') {
        finishCallback();
      }

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });
});
