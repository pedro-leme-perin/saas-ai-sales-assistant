// =============================================================
// WhatsappService — failure-mode amplification (S77-B)
// =============================================================
// Covers branches not exercised by whatsapp.service.spec.ts:
//   - processWebhook empty-content / no-media early return
//   - processWebhook no-company-found early return
//   - processStatusCallback status mapping (5 branches) + unknown-status early return
//   - processStatusCallback prisma update error caught (no rethrow)
//   - resolveChat happy path + tenant-mismatch NotFoundException
//   - extractPhone via processWebhook payloads (whatsapp: prefix strip)
//   - getMediaType via getMediaType-driven branch in processWebhook
// =============================================================

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway';

describe('WhatsappService — failure modes (S77-B)', () => {
  let service: WhatsappService;

  const mockPrisma = {
    company: { findFirst: jest.fn() },
    whatsappChat: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    whatsappMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    aISuggestion: { create: jest.fn() },
  };

  const mockAi = {
    generateSuggestion: jest.fn(),
    analyzeConversation: jest.fn(),
  };

  const mockGateway = {
    sendToCompany: jest.fn(),
    sendToUser: jest.fn(),
    sendAISuggestion: jest.fn(),
  };

  const mockConfig = { get: jest.fn(() => undefined) };
  const mockEvents = { emit: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AiService, useValue: mockAi },
        { provide: NotificationsGateway, useValue: mockGateway },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get<WhatsappService>(WhatsappService);
  });

  // -----------------------------------------------------------
  // processWebhook
  // -----------------------------------------------------------
  describe('processWebhook', () => {
    const basePayload = {
      MessageSid: 'SM_test_fixture_1',
      From: 'whatsapp:+5511999999999',
      To: 'whatsapp:+15077634719',
      Body: '',
      NumMedia: '0',
      ProfileName: 'Cliente',
    };

    it('returns early when content empty and no media', async () => {
      await service.processWebhook(basePayload);
      expect(mockPrisma.company.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.whatsappChat.findFirst).not.toHaveBeenCalled();
    });

    it('returns early when no company matches recipient number', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      await service.processWebhook({ ...basePayload, Body: 'Olá' });
      expect(mockPrisma.company.findFirst).toHaveBeenCalled();
      expect(mockPrisma.whatsappChat.findFirst).not.toHaveBeenCalled();
    });

    it('strips whatsapp: prefix from From/To phone numbers', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      await service.processWebhook({ ...basePayload, Body: 'Hi' });
      const where = mockPrisma.company.findFirst.mock.calls[0][0]?.where;
      // sandbox number search uses the extracted (stripped) phone
      expect(JSON.stringify(where)).toContain('+15077634719');
      expect(JSON.stringify(where)).not.toContain('whatsapp:+15077634719');
    });

    it('handles media-only message (empty body + NumMedia=1)', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      await service.processWebhook({
        ...basePayload,
        Body: '',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/media/abc',
        MediaContentType0: 'image/jpeg',
      });
      expect(mockPrisma.company.findFirst).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // processStatusCallback
  // -----------------------------------------------------------
  describe('processStatusCallback', () => {
    it.each([
      ['sent', 'SENT'],
      ['delivered', 'DELIVERED'],
      ['read', 'READ'],
      ['failed', 'FAILED'],
      ['undelivered', 'FAILED'],
    ] as const)('maps Twilio status %s to internal %s', async (twilioStatus, internalStatus) => {
      mockPrisma.whatsappMessage.updateMany.mockResolvedValueOnce({ count: 1 });
      await service.processStatusCallback({
        MessageSid: 'SM_test_fixture_2',
        MessageStatus: twilioStatus,
      });
      expect(mockPrisma.whatsappMessage.updateMany).toHaveBeenCalledWith({
        where: { waMessageId: 'SM_test_fixture_2' },
        data: { status: internalStatus },
      });
    });

    it('returns early on unknown status (no DB update)', async () => {
      await service.processStatusCallback({
        MessageSid: 'SM_test_fixture_3',
        MessageStatus: 'queued',
      });
      expect(mockPrisma.whatsappMessage.updateMany).not.toHaveBeenCalled();
    });

    it('swallows prisma update errors (logs only, no throw)', async () => {
      mockPrisma.whatsappMessage.updateMany.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.processStatusCallback({
          MessageSid: 'SM_test_fixture_4',
          MessageStatus: 'delivered',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // resolveChat
  // -----------------------------------------------------------
  describe('resolveChat', () => {
    const mockChat = {
      id: 'chat-1',
      companyId: 'co-1',
      status: 'ACTIVE',
      customerPhone: '+5511999999999',
    };

    it('updates chat status to RESOLVED', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(mockChat);
      mockPrisma.whatsappChat.update.mockResolvedValueOnce({
        ...mockChat,
        status: 'RESOLVED',
      });
      const result = await service.resolveChat('chat-1', 'co-1');
      expect(mockPrisma.whatsappChat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'chat-1' },
          data: expect.objectContaining({ status: 'RESOLVED' }),
        }),
      );
      expect(result.status).toBe('RESOLVED');
    });

    it('throws NotFoundException when chat does not exist', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(null);
      await expect(service.resolveChat('chat-x', 'co-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException on tenant mismatch (queries with companyId filter)', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(null);
      await expect(service.resolveChat('chat-1', 'co-OTHER')).rejects.toThrow(NotFoundException);
      const where = mockPrisma.whatsappChat.findFirst.mock.calls[0][0]?.where;
      expect(where).toMatchObject({ id: 'chat-1', companyId: 'co-OTHER' });
    });
  });
});
