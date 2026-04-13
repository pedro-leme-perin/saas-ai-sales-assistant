// =====================================================
// 🔐 TWILIO SIGNATURE GUARD — Unit Tests
// =====================================================
// Validates webhook signature verification behavior
// Reference: Release It! — Stability Patterns (Fail Fast)
// =====================================================

import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioSignatureGuard } from '../../src/common/guards/twilio-signature.guard';
import * as twilio from 'twilio';

// Mock twilio.validateRequest
jest.mock('twilio', () => ({
  validateRequest: jest.fn(),
}));

describe('TwilioSignatureGuard', () => {
  let guard: TwilioSignatureGuard;
  let configService: { get: jest.Mock };

  const createMockContext = (overrides: {
    headers?: Record<string, string>;
    originalUrl?: string;
    body?: Record<string, unknown>;
    protocol?: string;
  }): ExecutionContext => {
    const request = {
      headers: {
        host: 'api.theiadvisor.com',
        'x-forwarded-proto': 'https',
        ...overrides.headers,
      },
      originalUrl: overrides.originalUrl || '/calls/webhook/voice',
      body: overrides.body || {},
      protocol: overrides.protocol || 'https',
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => jest.fn(),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      getArgs: () => [],
      getArgByIndex: () => null,
      switchToRpc: () => ({}) as never,
      switchToWs: () => ({}) as never,
      getType: () => 'http' as const,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn(),
    };
    guard = new TwilioSignatureGuard(configService as unknown as ConfigService);
  });

  describe('when Twilio is not configured', () => {
    it('should allow request when no auth token is set', () => {
      configService.get.mockReturnValue(undefined);
      const context = createMockContext({
        headers: { 'x-twilio-signature': 'some-sig' },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when in test environment', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      configService.get.mockReturnValue('test-auth-token');
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should skip validation in test environment', () => {
      const context = createMockContext({});
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when Twilio is configured', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('real-auth-token');
      // Override NODE_ENV to non-test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      // Recreate guard in production mode
      guard = new TwilioSignatureGuard(configService as unknown as ConfigService);
      process.env.NODE_ENV = originalEnv;
    });

    it('should reject request without signature header', () => {
      // Force non-test environment check
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      guard = new TwilioSignatureGuard(configService as unknown as ConfigService);

      const context = createMockContext({ headers: {} });

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
      expect(() => guard.canActivate(context)).toThrow('Missing Twilio signature');

      process.env.NODE_ENV = origEnv;
    });

    it('should reject request with invalid signature', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      guard = new TwilioSignatureGuard(configService as unknown as ConfigService);

      (twilio.validateRequest as jest.Mock).mockReturnValue(false);

      const context = createMockContext({
        headers: { 'x-twilio-signature': 'invalid-signature' },
      });

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
      expect(() => guard.canActivate(context)).toThrow('Invalid Twilio signature');

      process.env.NODE_ENV = origEnv;
    });

    it('should accept request with valid signature', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      guard = new TwilioSignatureGuard(configService as unknown as ConfigService);

      (twilio.validateRequest as jest.Mock).mockReturnValue(true);

      const context = createMockContext({
        headers: { 'x-twilio-signature': 'valid-signature' },
        originalUrl: '/calls/webhook/status/abc123',
        body: { CallStatus: 'completed' },
      });

      expect(guard.canActivate(context)).toBe(true);
      expect(twilio.validateRequest).toHaveBeenCalledWith(
        'real-auth-token',
        'valid-signature',
        'https://api.theiadvisor.com/calls/webhook/status/abc123',
        { CallStatus: 'completed' },
      );

      process.env.NODE_ENV = origEnv;
    });

    it('should construct URL with x-forwarded-proto header', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      guard = new TwilioSignatureGuard(configService as unknown as ConfigService);

      (twilio.validateRequest as jest.Mock).mockReturnValue(true);

      const context = createMockContext({
        headers: {
          'x-twilio-signature': 'valid-sig',
          'x-forwarded-proto': 'https',
          host: 'api.theiadvisor.com',
        },
        originalUrl: '/whatsapp/webhook',
      });

      guard.canActivate(context);

      expect(twilio.validateRequest).toHaveBeenCalledWith(
        'real-auth-token',
        'valid-sig',
        'https://api.theiadvisor.com/whatsapp/webhook',
        {},
      );

      process.env.NODE_ENV = origEnv;
    });
  });
});
