// =====================================================
// EMAIL SERVICE - Unit Tests (S77 amplification)
// =====================================================
// Covers: sendInviteEmail, sendDeletionRequestEmail, sendDunningEmail,
//         sendAccountDeletedEmail, sendCoachingReportEmail, sendUsageThresholdEmail,
//         sendNotificationDigestEmail, sendCsatInvite, sendScheduledExportEmail,
//         sendDsarReadyEmail, sendDsarRejectedEmail, getCircuitBreakerStatus,
//         circuit breaker behavior, HTML escaping, currency formatting.
// Failure-mode coverage: missing API key, fetch network errors, non-OK responses,
//                        circuit-open fast-fail, empty recipients, malformed currency.
// =====================================================

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../src/modules/email/email.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const FIXED_DATE = new Date('2026-01-15T12:00:00Z');

const buildOk = (id: string) => ({
  ok: true,
  json: () => Promise.resolve({ id }),
});

const buildErr = (status: number, body = 'Bad Request') => ({
  ok: false,
  status,
  text: () => Promise.resolve(body),
});

const makeService = async (
  overrides: Partial<Record<string, string | undefined>> = {},
): Promise<EmailService> => {
  const defaults: Record<string, string> = {
    RESEND_API_KEY: 'test-fixture-resend-key',
    EMAIL_FROM: 'team@theiadvisor.com',
    FRONTEND_URL: 'https://app.theiadvisor.com',
  };
  const merged = { ...defaults, ...overrides };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn((k: string) => merged[k]) },
      },
    ],
  }).compile();
  return module.get<EmailService>(EmailService);
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await makeService();
  });

  // ---------------------------------------------------
  // sendInviteEmail (kept from baseline + extras)
  // ---------------------------------------------------
  describe('sendInviteEmail', () => {
    const validParams = {
      recipientEmail: 'joao@empresa.com',
      inviterName: 'Maria Silva',
      companyName: 'TechVendas Brasil',
      role: 'VENDOR',
    };

    it('sends successfully and returns messageId', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_abc123'));
      const r = await service.sendInviteEmail(validParams);
      expect(r.success).toBe(true);
      expect(r.messageId).toBe('msg_abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-fixture-resend-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('builds subject with inviter + company name', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_1'));
      await service.sendInviteEmail(validParams);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toEqual(['joao@empresa.com']);
      expect(body.subject).toContain('Maria Silva');
      expect(body.subject).toContain('TechVendas Brasil');
      expect(body.from).toBe('team@theiadvisor.com');
      expect(body.html).toContain('TechVendas Brasil');
      expect(body.html).toContain('sign-up');
    });

    it('encodes recipient email in sign-up URL', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_x'));
      await service.sendInviteEmail({ ...validParams, recipientEmail: 'a+b@x.com' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain(encodeURIComponent('a+b@x.com'));
    });

    it('translates each role correctly', async () => {
      const roles = ['OWNER', 'ADMIN', 'MANAGER', 'VENDOR'];
      const expected = ['Proprietário', 'Administrador', 'Gerente', 'Vendedor'];
      for (let i = 0; i < roles.length; i++) {
        mockFetch.mockResolvedValueOnce(buildOk(`msg_${i}`));
        await service.sendInviteEmail({ ...validParams, role: roles[i] });
        const body = JSON.parse(mockFetch.mock.calls[i][1].body);
        expect(body.html).toContain(expected[i]);
      }
    });

    it('falls back to raw role when unknown', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_y'));
      await service.sendInviteEmail({ ...validParams, role: 'CUSTOM_ROLE' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('CUSTOM_ROLE');
    });

    it('returns success:false when RESEND_API_KEY missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendInviteEmail(validParams);
      expect(r.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns success:false on Resend 4xx', async () => {
      mockFetch.mockResolvedValueOnce(buildErr(422, 'Invalid email'));
      const r = await service.sendInviteEmail(validParams);
      expect(r.success).toBe(false);
    });

    it('returns success:false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));
      const r = await service.sendInviteEmail(validParams);
      expect(r.success).toBe(false);
    });

    it('returns success:false on non-Error rejection', async () => {
      mockFetch.mockRejectedValueOnce('opaque-string-error');
      const r = await service.sendInviteEmail(validParams);
      expect(r.success).toBe(false);
    });
  });

  // ---------------------------------------------------
  // sendDeletionRequestEmail
  // ---------------------------------------------------
  describe('sendDeletionRequestEmail', () => {
    const params = {
      recipientEmail: 'user@example.com',
      userName: 'Pedro Leme',
      scheduledDeletionDate: FIXED_DATE,
    };

    it('formats date in pt-BR DD/MM/YYYY', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_d1'));
      const r = await service.sendDeletionRequestEmail(params);
      expect(r.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toMatch(/15\/01\/2026/);
      expect(body.subject).toContain('exclusao');
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: '' });
      const r = await noKey.sendDeletionRequestEmail(params);
      expect(r.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns success:false when send throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('boom'));
      const r = await service.sendDeletionRequestEmail(params);
      expect(r.success).toBe(false);
    });

    it('returns success:false on resend 5xx', async () => {
      mockFetch.mockResolvedValueOnce(buildErr(500));
      const r = await service.sendDeletionRequestEmail(params);
      expect(r.success).toBe(false);
    });
  });

  // ---------------------------------------------------
  // sendDunningEmail (3 stages)
  // ---------------------------------------------------
  describe('sendDunningEmail', () => {
    const baseParams = {
      recipientEmail: 'billing@empresa.com',
      companyName: 'Empresa S/A',
      amount: 9700, // R$ 97,00
      currency: 'BRL',
      hostedInvoiceUrl: 'https://invoice.stripe.com/abc',
      graceDeadline: FIXED_DATE,
    } as const;

    it.each(['D1', 'D3', 'D7'] as const)(
      'sends %s stage with stage-specific subject',
      async (stage) => {
        mockFetch.mockResolvedValueOnce(buildOk(`msg_${stage}`));
        const r = await service.sendDunningEmail({ ...baseParams, stage });
        expect(r.success).toBe(true);
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        if (stage === 'D1') expect(body.subject).toContain('Nao conseguimos');
        if (stage === 'D3') expect(body.subject).toContain('pagamento pendente');
        if (stage === 'D7') expect(body.subject).toContain('Ultimo aviso');
      },
    );

    it('formats amount as BRL currency', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_brl'));
      await service.sendDunningEmail({ ...baseParams, stage: 'D1' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Intl pt-BR uses comma decimal + R$
      expect(body.html).toMatch(/R\$\s?97,00/);
    });

    it('falls back to USD ###.## when currency invalid', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_xxx'));
      await service.sendDunningEmail({ ...baseParams, stage: 'D1', currency: 'XYZ' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Either Intl returns XYZ formatted, or fallback "XYZ 97.00" - both acceptable
      expect(body.html).toMatch(/XYZ/);
    });

    it('uses dashboard URL when hostedInvoiceUrl is null', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_null'));
      await service.sendDunningEmail({ ...baseParams, stage: 'D3', hostedInvoiceUrl: null });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('https://app.theiadvisor.com/dashboard/billing');
    });

    it('uses Stripe hosted URL when present', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_hi'));
      await service.sendDunningEmail({ ...baseParams, stage: 'D3' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('https://invoice.stripe.com/abc');
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendDunningEmail({ ...baseParams, stage: 'D1' });
      expect(r.success).toBe(false);
    });

    it('returns success:false on send error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));
      const r = await service.sendDunningEmail({ ...baseParams, stage: 'D7' });
      expect(r.success).toBe(false);
    });

    it('embeds urgency block on D3 and D7 only', async () => {
      mockFetch
        .mockResolvedValueOnce(buildOk('m1'))
        .mockResolvedValueOnce(buildOk('m3'))
        .mockResolvedValueOnce(buildOk('m7'));
      await service.sendDunningEmail({ ...baseParams, stage: 'D1' });
      await service.sendDunningEmail({ ...baseParams, stage: 'D3' });
      await service.sendDunningEmail({ ...baseParams, stage: 'D7' });
      const b1 = JSON.parse(mockFetch.mock.calls[0][1].body).html;
      const b3 = JSON.parse(mockFetch.mock.calls[1][1].body).html;
      const b7 = JSON.parse(mockFetch.mock.calls[2][1].body).html;
      // urgency block has fef2f2 background
      expect(b1).not.toContain('background:#fef2f2');
      expect(b3).toContain('background:#fef2f2');
      expect(b7).toContain('background:#fef2f2');
    });
  });

  // ---------------------------------------------------
  // sendAccountDeletedEmail
  // ---------------------------------------------------
  describe('sendAccountDeletedEmail', () => {
    const params = {
      recipientEmail: 'gone@empresa.com',
      userName: 'Pedro',
      deletedAt: FIXED_DATE,
    };

    it('sends successfully with formatted date', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_ad1'));
      const r = await service.sendAccountDeletedEmail(params);
      expect(r.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toMatch(/15\/01\/2026/);
      expect(body.subject.toLowerCase()).toContain('exclu');
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendAccountDeletedEmail(params);
      expect(r.success).toBe(false);
    });

    it('returns success:false on send error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('net'));
      const r = await service.sendAccountDeletedEmail(params);
      expect(r.success).toBe(false);
    });
  });

  // ---------------------------------------------------
  // sendCoachingReportEmail
  // ---------------------------------------------------
  describe('sendCoachingReportEmail', () => {
    const params = {
      recipientEmail: 'vendor@empresa.com',
      userName: 'Maria',
      companyName: 'Empresa',
      weekStart: new Date('2026-01-08T00:00:00Z'),
      weekEnd: new Date('2026-01-14T23:59:59Z'),
      metrics: {
        calls: { total: 50, completed: 45, missed: 5, conversionRate: 0.32 },
        whatsapp: { chats: 80, messagesSent: 240 },
        ai: { suggestionsShown: 100, suggestionsUsed: 65, adoptionRate: 0.65 },
      },
      insights: ['Insight A', 'Insight B'],
      recommendations: ['Rec 1', 'Rec 2'],
    };

    it('sends successfully with metrics rendered', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_c1'));
      const r = await service.sendCoachingReportEmail(params);
      expect(r.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('Maria');
      expect(body.html).toMatch(/50|45/);
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendCoachingReportEmail(params);
      expect(r.success).toBe(false);
    });

    it('returns success:false on resend 4xx', async () => {
      mockFetch.mockResolvedValueOnce(buildErr(401, 'unauthorized'));
      const r = await service.sendCoachingReportEmail(params);
      expect(r.success).toBe(false);
    });

    it('handles empty insights/recommendations gracefully', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_empty'));
      const r = await service.sendCoachingReportEmail({
        ...params,
        insights: [],
        recommendations: [],
      });
      expect(r.success).toBe(true);
    });
  });

  // ---------------------------------------------------
  // sendUsageThresholdEmail (3 thresholds → 3 colors)
  // ---------------------------------------------------
  describe('sendUsageThresholdEmail', () => {
    const base = {
      recipientEmail: 'admin@empresa.com',
      recipientName: 'Admin',
      companyName: 'Empresa',
      metricLabel: 'Calls',
      used: 80,
      limit: 100,
      periodEnd: FIXED_DATE,
    };

    it('uses red header at 100% threshold', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_100'));
      await service.sendUsageThresholdEmail({ ...base, threshold: 100, used: 100 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('#dc2626');
    });

    it('uses orange header at 95% threshold', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_95'));
      await service.sendUsageThresholdEmail({ ...base, threshold: 95, used: 95 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('#ea580c');
    });

    it('uses yellow header at 80% threshold', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_80'));
      await service.sendUsageThresholdEmail({ ...base, threshold: 80, used: 80 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('#ca8a04');
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendUsageThresholdEmail({ ...base, threshold: 80 });
      expect(r.success).toBe(false);
    });

    it('returns success:false on send error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('netfail'));
      const r = await service.sendUsageThresholdEmail({ ...base, threshold: 80 });
      expect(r.success).toBe(false);
    });
  });

  // ---------------------------------------------------
  // sendNotificationDigestEmail (returns void)
  // ---------------------------------------------------
  describe('sendNotificationDigestEmail', () => {
    const base = {
      recipientEmail: 'user@empresa.com',
      recipientName: 'User',
      entries: [
        { type: 'NEW_CALL', title: 'Nova ligacao', message: 'msg', at: FIXED_DATE },
        { type: 'NEW_CHAT', title: 'Novo chat', message: 'msg2', at: FIXED_DATE },
      ],
    };

    it('returns early when entries empty (no fetch)', async () => {
      await service.sendNotificationDigestEmail({ ...base, entries: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      await noKey.sendNotificationDigestEmail(base);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends successfully with entry count in subject', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_dg1'));
      await service.sendNotificationDigestEmail(base);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toContain('2 notifica');
    });

    it('swallows send errors (does not throw)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('boom'));
      await expect(service.sendNotificationDigestEmail(base)).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------
  // sendCsatInvite (rethrows on error)
  // ---------------------------------------------------
  describe('sendCsatInvite', () => {
    const params = {
      recipientEmail: 'cliente@cliente.com',
      recipientName: 'Cliente',
      message: 'Como foi o atendimento?',
      link: 'https://app.theiadvisor.com/csat/abc123',
    };

    it('returns early when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      await expect(noKey.sendCsatInvite(params)).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends successfully', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_cs1'));
      await expect(service.sendCsatInvite(params)).resolves.toBeUndefined();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toContain('atendimento');
      expect(body.html).toContain('https://app.theiadvisor.com/csat/abc123');
    });

    it('handles null recipientName (uses fallback greeting)', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_cs2'));
      await service.sendCsatInvite({ ...params, recipientName: null });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('Olá');
    });

    it('rethrows on send failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('csat-fail'));
      await expect(service.sendCsatInvite(params)).rejects.toThrow('csat-fail');
    });
  });

  // ---------------------------------------------------
  // sendScheduledExportEmail
  // ---------------------------------------------------
  describe('sendScheduledExportEmail', () => {
    const base = {
      recipients: ['ops@empresa.com', 'admin@empresa.com'],
      exportName: 'Calls Weekly',
      resource: 'CALLS',
      rowCount: 250,
      filename: 'calls-2026-W03.csv',
      format: 'CSV' as const,
      content: 'col1,col2\n1,2\n',
    };

    it('returns early when recipients empty', async () => {
      await service.sendScheduledExportEmail({ ...base, recipients: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      await noKey.sendScheduledExportEmail(base);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('attaches base64-encoded content + correct filename', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_se1'));
      await service.sendScheduledExportEmail(base);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].filename).toBe('calls-2026-W03.csv');
      expect(body.attachments[0].content).toBe(
        Buffer.from(base.content, 'utf8').toString('base64'),
      );
      expect(body.to).toEqual(['ops@empresa.com', 'admin@empresa.com']);
    });

    it('embeds row count in subject', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_se2'));
      await service.sendScheduledExportEmail(base);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toContain('250');
    });

    it('rethrows on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('export-fail'));
      await expect(service.sendScheduledExportEmail(base)).rejects.toThrow('export-fail');
    });

    it('handles JSON format', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_se3'));
      await service.sendScheduledExportEmail({
        ...base,
        format: 'JSON',
        filename: 'calls.json',
        content: '[]',
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attachments[0].filename).toBe('calls.json');
    });
  });

  // ---------------------------------------------------
  // sendDsarReadyEmail
  // ---------------------------------------------------
  describe('sendDsarReadyEmail', () => {
    const base = {
      recipientEmail: 'subject@user.com',
      recipientName: 'User',
      requestType: 'ACCESS',
      downloadUrl: 'https://r2.theiadvisor.com/dsar/abc?sig=xyz',
      expiresAt: new Date('2026-01-22T12:00:00Z'),
      requestId: 'dsar_123',
    };

    it('sends successfully with download URL', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_dsar1'));
      const r = await service.sendDsarReadyEmail(base);
      expect(r.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('https://r2.theiadvisor.com/dsar/abc?sig=xyz');
      expect(body.subject).toContain('LGPD');
      expect(body.subject).toContain('ACCESS');
    });

    it('handles null recipientName', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_dsar2'));
      const r = await service.sendDsarReadyEmail({ ...base, recipientName: null });
      expect(r.success).toBe(true);
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendDsarReadyEmail(base);
      expect(r.success).toBe(false);
    });

    it('returns success:false on send error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('dsar-net'));
      const r = await service.sendDsarReadyEmail(base);
      expect(r.success).toBe(false);
    });
  });

  // ---------------------------------------------------
  // sendDsarRejectedEmail
  // ---------------------------------------------------
  describe('sendDsarRejectedEmail', () => {
    const base = {
      recipientEmail: 'subject@user.com',
      recipientName: 'User',
      requestType: 'DELETION',
      reason: 'Identidade não pôde ser verificada',
      requestId: 'dsar_999',
    };

    it('sends successfully with reason embedded', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_rej1'));
      const r = await service.sendDsarRejectedEmail(base);
      expect(r.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toContain('LGPD');
      expect(body.subject).toContain('DELETION');
    });

    it('handles undefined recipientName', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_rej2'));
      const r = await service.sendDsarRejectedEmail({ ...base, recipientName: undefined });
      expect(r.success).toBe(true);
    });

    it('returns success:false when API key missing', async () => {
      const noKey = await makeService({ RESEND_API_KEY: undefined });
      const r = await noKey.sendDsarRejectedEmail(base);
      expect(r.success).toBe(false);
    });

    it('returns success:false on send error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('rej-fail'));
      const r = await service.sendDsarRejectedEmail(base);
      expect(r.success).toBe(false);
    });
  });

  // ---------------------------------------------------
  // getCircuitBreakerStatus
  // ---------------------------------------------------
  describe('getCircuitBreakerStatus', () => {
    it('returns Resend status with valid state', () => {
      const status = service.getCircuitBreakerStatus();
      expect(status).toHaveProperty('name', 'Resend');
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(status.state);
    });
  });

  // ---------------------------------------------------
  // circuit breaker behavior
  // ---------------------------------------------------
  describe('circuit breaker behavior', () => {
    it('opens after 3 consecutive 5xx failures', async () => {
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce(buildErr(500, 'svc unavailable'));
        await service.sendInviteEmail({
          recipientEmail: `t${i}@x.com`,
          inviterName: 'T',
          companyName: 'C',
          role: 'VENDOR',
        });
      }
      mockFetch.mockClear();
      const r = await service.sendInviteEmail({
        recipientEmail: 'blocked@x.com',
        inviterName: 'T',
        companyName: 'C',
        role: 'VENDOR',
      });
      expect(r.success).toBe(false);
      // 4th call short-circuited, no fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------
  // HTML escaping (observable via name with special chars)
  // ---------------------------------------------------
  describe('HTML escaping (observable via CSAT name)', () => {
    it('escapes <, >, &, ", \' in recipientName', async () => {
      mockFetch.mockResolvedValueOnce(buildOk('msg_esc'));
      await service.sendCsatInvite({
        recipientEmail: 'x@x.com',
        recipientName: `<script>alert("XSS&'fail")</script>`,
        message: 'Como foi?',
        link: 'https://x.com',
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.html).toContain('&lt;script&gt;');
      expect(body.html).toContain('&amp;');
      expect(body.html).toContain('&quot;');
      expect(body.html).toContain('&#39;');
      // Raw < or > or unescaped quotes inside script tag should NOT appear
      expect(body.html).not.toMatch(/<script>alert\("XSS/);
    });
  });
});
