// =====================================================
// 📞 VoiceNumbersService — ADR-018 §4.1
//
// The interesting tests here are not the happy path. They are the window between "Twilio took
// our money" and "our database knows about it", because that is the only step of provisioning
// that cannot be undone by a transaction.
// =====================================================

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VoiceNumbersService } from '../../src/modules/voice-numbers/voice-numbers.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

describe('VoiceNumbersService', () => {
  let service: VoiceNumbersService;

  const mockPrismaService = {
    company: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const env: Record<string, string | undefined> = {
    TWILIO_ACCOUNT_SID: 'AC-test',
    TWILIO_AUTH_TOKEN: 'token-test',
    TWILIO_BR_REGULATORY_BUNDLE_SID: 'BU-test',
    TWILIO_BR_ADDRESS_SID: 'AD-test',
    TWILIO_WEBHOOK_URL: 'https://api.example.com',
  };

  const mockConfigService = {
    get: jest.fn((key: string) => env[key]),
  };

  /** Replaces the Twilio client built in the constructor with a controllable stub. */
  const stubTwilio = (overrides: Record<string, unknown>) => {
    (service as unknown as { twilioClient: unknown }).twilioClient = overrides;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.assign(env, {
      TWILIO_ACCOUNT_SID: 'AC-test',
      TWILIO_AUTH_TOKEN: 'token-test',
      TWILIO_BR_REGULATORY_BUNDLE_SID: 'BU-test',
      TWILIO_BR_ADDRESS_SID: 'AD-test',
      TWILIO_WEBHOOK_URL: 'https://api.example.com',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceNumbersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<VoiceNumbersService>(VoiceNumbersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('listAvailable', () => {
    it('filters on voiceEnabled and maps the Twilio payload down to what a chooser needs', async () => {
      const list = jest.fn().mockResolvedValue([
        {
          phoneNumber: '+551623980155',
          friendlyName: '(16) 2398-0155',
          locality: 'Ribeirao Preto',
          region: 'SP',
        },
      ]);
      stubTwilio({ availablePhoneNumbers: () => ({ local: { list } }) });

      const result = await service.listAvailable('br', '16', 5);

      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ voiceEnabled: true, contains: '16', limit: 5 }),
      );
      expect(result).toEqual([
        {
          phoneNumber: '+551623980155',
          friendlyName: '(16) 2398-0155',
          locality: 'Ribeirao Preto',
          region: 'SP',
          voiceEnabled: true,
        },
      ]);
    });

    it('omits the area-code filter when none is given', async () => {
      const list = jest.fn().mockResolvedValue([]);
      stubTwilio({ availablePhoneNumbers: () => ({ local: { list } }) });

      await service.listAvailable('BR');

      expect(list).toHaveBeenCalledWith(
        expect.not.objectContaining({ contains: expect.anything() }),
      );
    });

    it('throws ServiceUnavailableException when Twilio is not configured', async () => {
      stubTwilio(null as unknown as Record<string, unknown>);
      await expect(service.listAvailable('BR')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('provisionForCompany', () => {
    const COMPANY = { id: 'company-1', voicePhoneNumber: null, name: 'ACME' };

    it('buys the number, persists it and writes an audit entry', async () => {
      const create = jest.fn().mockResolvedValue({ phoneNumber: '+551623980155', sid: 'PN-123' });
      stubTwilio({ incomingPhoneNumbers: Object.assign(jest.fn(), { create }) });
      mockPrismaService.company.findFirst.mockResolvedValue(COMPANY);
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.provisionForCompany('company-1', '+551623980155', 'user-1');

      expect(result).toEqual({ phoneNumber: '+551623980155', sid: 'PN-123' });
      // The regulatory bundle must ride along, or Anatel rejects the number.
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '+551623980155',
          bundleSid: 'BU-test',
          addressSid: 'AD-test',
          voiceUrl: 'https://api.example.com/api/calls/webhook/voice',
        }),
      );
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-1' },
        data: { voicePhoneNumber: '+551623980155', voicePhoneSid: 'PN-123' },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resource: 'VOICE_NUMBER', resourceId: 'PN-123' }),
        }),
      );
    });

    it('refuses to buy a second number for a tenant that already has one', async () => {
      const create = jest.fn();
      stubTwilio({ incomingPhoneNumbers: Object.assign(jest.fn(), { create }) });
      mockPrismaService.company.findFirst.mockResolvedValue({
        ...COMPANY,
        voicePhoneNumber: '+551623980155',
      });

      await expect(
        service.provisionForCompany('company-1', '+551133334444', 'user-1'),
      ).rejects.toThrow(ConflictException);

      // No money spent: the guard runs before Twilio is touched.
      expect(create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown or inactive tenant', async () => {
      stubTwilio({ incomingPhoneNumbers: Object.assign(jest.fn(), { create: jest.fn() }) });
      mockPrismaService.company.findFirst.mockResolvedValue(null);

      await expect(service.provisionForCompany('ghost', '+551623980155', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses Brazilian numbers when the regulatory bundle is not configured', async () => {
      env.TWILIO_BR_REGULATORY_BUNDLE_SID = undefined;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VoiceNumbersService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const bareService = module.get<VoiceNumbersService>(VoiceNumbersService);
      const create = jest.fn();
      (bareService as unknown as { twilioClient: unknown }).twilioClient = {
        incomingPhoneNumbers: Object.assign(jest.fn(), { create }),
      };
      mockPrismaService.company.findFirst.mockResolvedValue(COMPANY);

      await expect(
        bareService.provisionForCompany('company-1', '+551623980155', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(create).not.toHaveBeenCalled();
    });

    it('translates Twilio error 21422 into a clear "number already taken" conflict', async () => {
      // This is the exact failure that lost the Ribeirão Preto number on 06/08/2026: the
      // number was sold between rendering the list and clicking buy.
      const create = jest.fn().mockRejectedValue(new Error('21422 Phone number not available'));
      stubTwilio({ incomingPhoneNumbers: Object.assign(jest.fn(), { create }) });
      mockPrismaService.company.findFirst.mockResolvedValue(COMPANY);

      await expect(
        service.provisionForCompany('company-1', '+551623980155', 'user-1'),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.company.update).not.toHaveBeenCalled();
    });

    // --- the dangerous window: purchased, but not persisted ---

    it('releases the number back to Twilio when persisting the assignment fails', async () => {
      const create = jest.fn().mockResolvedValue({ phoneNumber: '+551623980155', sid: 'PN-123' });
      const remove = jest.fn().mockResolvedValue({});
      const incomingPhoneNumbers = Object.assign(jest.fn().mockReturnValue({ remove }), { create });
      stubTwilio({ incomingPhoneNumbers });
      mockPrismaService.company.findFirst.mockResolvedValue(COMPANY);
      mockPrismaService.company.update.mockRejectedValue(new Error('db-down'));

      await expect(
        service.provisionForCompany('company-1', '+551623980155', 'user-1'),
      ).rejects.toThrow('db-down');

      // Compensating action: an orphan number bills every month and nobody knows it exists.
      expect(incomingPhoneNumbers).toHaveBeenCalledWith('PN-123');
      expect(remove).toHaveBeenCalled();
    });

    it('surfaces a P2002 on the number as a conflict, not as a raw prisma error', async () => {
      const create = jest.fn().mockResolvedValue({ phoneNumber: '+551623980155', sid: 'PN-123' });
      const remove = jest.fn().mockResolvedValue({});
      stubTwilio({
        incomingPhoneNumbers: Object.assign(jest.fn().mockReturnValue({ remove }), { create }),
      });
      mockPrismaService.company.findFirst.mockResolvedValue(COMPANY);
      mockPrismaService.company.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      // The global unique index from ADR-018 doing its job: two tenants raced for the same
      // number and the database refused the second one.
      await expect(
        service.provisionForCompany('company-1', '+551623980155', 'user-1'),
      ).rejects.toThrow(ConflictException);

      expect(remove).toHaveBeenCalled();
    });

    it('does not throw when the compensating release also fails', async () => {
      const create = jest.fn().mockResolvedValue({ phoneNumber: '+551623980155', sid: 'PN-123' });
      const remove = jest.fn().mockRejectedValue(new Error('twilio-also-down'));
      stubTwilio({
        incomingPhoneNumbers: Object.assign(jest.fn().mockReturnValue({ remove }), { create }),
      });
      mockPrismaService.company.findFirst.mockResolvedValue(COMPANY);
      mockPrismaService.company.update.mockRejectedValue(new Error('db-down'));

      // The original cause must survive; a failed compensation must not mask it.
      await expect(
        service.provisionForCompany('company-1', '+551623980155', 'user-1'),
      ).rejects.toThrow('db-down');
    });
  });

  describe('releaseForCompany', () => {
    it('clears the database BEFORE releasing at Twilio', async () => {
      const order: string[] = [];
      const remove = jest.fn().mockImplementation(async () => {
        order.push('twilio');
      });
      stubTwilio({ incomingPhoneNumbers: jest.fn().mockReturnValue({ remove }) });
      mockPrismaService.company.findFirst.mockResolvedValue({
        voicePhoneNumber: '+551623980155',
        voicePhoneSid: 'PN-123',
      });
      mockPrismaService.company.update.mockImplementation(async () => {
        order.push('db');
        return {};
      });

      await service.releaseForCompany('company-1', 'user-1');

      // Order matters: releasing at Twilio first would leave the Company pointing at a number
      // a stranger can buy, and inbound calls for that stranger would resolve to this tenant.
      expect(order).toEqual(['db', 'twilio']);
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-1' },
        data: { voicePhoneNumber: null, voicePhoneSid: null, voiceDefaultUserId: null },
      });
    });

    it('still clears the assignment when Twilio refuses the release', async () => {
      const remove = jest.fn().mockRejectedValue(new Error('twilio-down'));
      stubTwilio({ incomingPhoneNumbers: jest.fn().mockReturnValue({ remove }) });
      mockPrismaService.company.findFirst.mockResolvedValue({
        voicePhoneNumber: '+551623980155',
        voicePhoneSid: 'PN-123',
      });
      mockPrismaService.company.update.mockResolvedValue({});

      // From the tenant's point of view the number is gone, which is what they asked for.
      // The leftover billing is our problem and is loud in the logs.
      await expect(service.releaseForCompany('company-1', 'user-1')).resolves.toBeUndefined();
      expect(mockPrismaService.company.update).toHaveBeenCalled();
    });

    it('clears the assignment even with no SID recorded', async () => {
      const remove = jest.fn();
      stubTwilio({ incomingPhoneNumbers: jest.fn().mockReturnValue({ remove }) });
      mockPrismaService.company.findFirst.mockResolvedValue({
        voicePhoneNumber: '+551623980155',
        voicePhoneSid: null,
      });
      mockPrismaService.company.update.mockResolvedValue({});

      await service.releaseForCompany('company-1', 'user-1');

      expect(remove).not.toHaveBeenCalled();
      expect(mockPrismaService.company.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when the tenant has no number', async () => {
      mockPrismaService.company.findFirst.mockResolvedValue({
        voicePhoneNumber: null,
        voicePhoneSid: null,
      });

      await expect(service.releaseForCompany('company-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getForCompany', () => {
    it('returns the current assignment', async () => {
      mockPrismaService.company.findFirst.mockResolvedValue({
        voicePhoneNumber: '+551623980155',
        voicePhoneSid: 'PN-123',
      });

      await expect(service.getForCompany('company-1')).resolves.toEqual({
        phoneNumber: '+551623980155',
        sid: 'PN-123',
      });
    });

    it('reports null for a tenant that cannot place calls yet', async () => {
      mockPrismaService.company.findFirst.mockResolvedValue({
        voicePhoneNumber: null,
        voicePhoneSid: null,
      });

      await expect(service.getForCompany('company-1')).resolves.toEqual({
        phoneNumber: null,
        sid: null,
      });
    });

    it('throws NotFoundException for an unknown tenant', async () => {
      mockPrismaService.company.findFirst.mockResolvedValue(null);
      await expect(service.getForCompany('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
