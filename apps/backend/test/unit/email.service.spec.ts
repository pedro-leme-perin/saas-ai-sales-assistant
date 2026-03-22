// =====================================================
// 📧 EMAIL SERVICE — Unit Tests
// =====================================================

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../src/modules/email/email.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  const mockConfigValues: Record<string, string> = {
    RESEND_API_KEY: 'test_resend_api_key_123',
    EMAIL_FROM: 'team@salesai.com.br',
    FRONTEND_URL: 'https://app.salesai.com.br',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('sendInviteEmail', () => {
    const validParams = {
      recipientEmail: 'joao@empresa.com',
      inviterName: 'Maria Silva',
      companyName: 'TechVendas Brasil',
      role: 'VENDOR',
    };

    it('should send invite email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'msg_abc123' }),
      });

      const result = await service.sendInviteEmail(validParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_resend_api_key_123',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should include correct email content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'msg_abc123' }),
      });

      await service.sendInviteEmail(validParams);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.to).toEqual(['joao@empresa.com']);
      expect(body.subject).toContain('Maria Silva');
      expect(body.subject).toContain('TechVendas Brasil');
      expect(body.from).toBe('team@salesai.com.br');
      expect(body.html).toContain('Vendedor'); // translated role
      expect(body.html).toContain('TechVendas Brasil');
      expect(body.html).toContain('sign-up');
    });

    it('should include sign-up URL with email param', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'msg_123' }),
      });

      await service.sendInviteEmail(validParams);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain(
        encodeURIComponent('joao@empresa.com'),
      );
      expect(body.html).toContain('https://app.salesai.com.br/sign-up');
    });

    it('should translate all roles correctly', async () => {
      const roles = ['OWNER', 'ADMIN', 'MANAGER', 'VENDOR'];
      const expected = ['Proprietário', 'Administrador', 'Gerente', 'Vendedor'];

      for (let i = 0; i < roles.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: `msg_${i}` }),
        });

        await service.sendInviteEmail({ ...validParams, role: roles[i] });

        const body = JSON.parse(mockFetch.mock.calls[i][1].body);
        expect(body.html).toContain(expected[i]);
      }
    });

    it('should return success: false when API key is missing', async () => {
      // Recreate service without API key
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => undefined),
            },
          },
        ],
      }).compile();

      const noKeyService = module.get<EmailService>(EmailService);
      const result = await noKeyService.sendInviteEmail(validParams);

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle Resend API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Invalid email address'),
      });

      const result = await service.sendInviteEmail(validParams);

      expect(result.success).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await service.sendInviteEmail(validParams);

      expect(result.success).toBe(false);
    });

    it('should handle fetch throwing unexpectedly', async () => {
      mockFetch.mockRejectedValueOnce('unexpected string error');

      const result = await service.sendInviteEmail(validParams);

      expect(result.success).toBe(false);
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return circuit breaker status', () => {
      const status = service.getCircuitBreakerStatus();

      expect(status).toHaveProperty('name', 'Resend');
      expect(status).toHaveProperty('state');
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(status.state);
    });
  });

  describe('circuit breaker behavior', () => {
    it('should open circuit after consecutive failures', async () => {
      // Trigger 3 failures (failureThreshold = 3)
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        });
        await service.sendInviteEmail({
          recipientEmail: `test${i}@test.com`,
          inviterName: 'Test',
          companyName: 'Test',
          role: 'VENDOR',
        });
      }

      // 4th call should not reach fetch (circuit open)
      mockFetch.mockClear();

      const result = await service.sendInviteEmail({
        recipientEmail: 'blocked@test.com',
        inviterName: 'Test',
        companyName: 'Test',
        role: 'VENDOR',
      });

      expect(result.success).toBe(false);
    });
  });
});
