import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CallsService } from '../../src/modules/calls/calls.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { SummariesService } from '../../src/modules/summaries/summaries.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('CallsService', () => {
  let service: CallsService;

  const mockCall = {
    id: 'call-123',
    companyId: 'company-123',
    userId: 'user-123',
    phoneNumber: '+5511999999999',
    direction: 'OUTBOUND',
    status: 'COMPLETED',
    duration: 120,
    transcript: null,
    twilioCallSid: null,
    recordingUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    call: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      upsert: jest.fn(),
    },
    aISuggestion: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockAiService = {
    generateSuggestion: jest.fn(),
  };

  const mockSummariesService = {
    autoSummarizeCall: jest.fn().mockResolvedValue(true),
  };

  const mockEventEmitter = {
    emit: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: { get: jest.fn(() => null) } },
        { provide: AiService, useValue: mockAiService },
        { provide: SummariesService, useValue: mockSummariesService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // findAll
  // ──────────────────────────────────────────────
  describe('findAll', () => {
    it('should return calls for company', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([mockCall]);

      const result = await service.findAll('company-123');

      expect(result).toEqual([mockCall]);
      expect(mockPrismaService.call.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should return empty array when no calls', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([]);
      const result = await service.findAll('company-123');
      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // findOne
  // ──────────────────────────────────────────────
  describe('findOne', () => {
    it('should return call by id and companyId', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(mockCall);

      const result = await service.findOne('call-123', 'company-123');

      expect(result).toEqual(mockCall);
      expect(mockPrismaService.call.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-123', companyId: 'company-123' },
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid', 'company-123')).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────
  describe('create', () => {
    it('should create a call with correct data', async () => {
      const input = { phoneNumber: '+5511999999999', direction: 'OUTBOUND' };
      mockPrismaService.call.create.mockResolvedValue({ ...mockCall, status: 'INITIATED' });

      const result = await service.create('company-123', 'user-123', input);

      expect(result).toBeDefined();
      expect(mockPrismaService.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNumber: '+5511999999999',
          direction: 'OUTBOUND',
          status: 'INITIATED',
          duration: 0,
        }),
      });
    });

    it('should default direction to OUTBOUND', async () => {
      mockPrismaService.call.create.mockResolvedValue(mockCall);

      await service.create('company-123', 'user-123', { phoneNumber: '+55119' });

      expect(mockPrismaService.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'OUTBOUND',
        }),
      });
    });
  });

  // ──────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────
  describe('update', () => {
    it('should update an existing call', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(mockCall);
      mockPrismaService.call.update.mockResolvedValue({ ...mockCall, duration: 200 });

      const result = await service.update('call-123', 'company-123', { duration: 200 });

      expect(result.duration).toBe(200);
    });

    it('should throw when call not found', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);

      await expect(service.update('invalid', 'company-123', { duration: 200 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // getCallStats
  // ──────────────────────────────────────────────
  describe('getCallStats', () => {
    it('should compute correct stats via SQL aggregations', async () => {
      mockPrismaService.call.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2); // completed
      mockPrismaService.call.aggregate.mockResolvedValue({
        _avg: { duration: 100 },
      });

      const result = await service.getCallStats('company-123');

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.avgDuration).toBe(100);
      expect(result.successRate).toBe(67);
    });

    it('should handle zero calls', async () => {
      mockPrismaService.call.count.mockResolvedValue(0);
      mockPrismaService.call.aggregate.mockResolvedValue({
        _avg: { duration: null },
      });

      const result = await service.getCallStats('company-123');

      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.avgDuration).toBe(0);
      expect(result.successRate).toBe(0);
    });

    it('should handle single completed call', async () => {
      mockPrismaService.call.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // completed
      mockPrismaService.call.aggregate.mockResolvedValue({
        _avg: { duration: 300 },
      });

      const result = await service.getCallStats('company-123');

      expect(result.total).toBe(1);
      expect(result.completed).toBe(1);
      expect(result.avgDuration).toBe(300);
      expect(result.successRate).toBe(100);
    });
  });

  // ──────────────────────────────────────────────
  // handleStatusWebhook
  // ──────────────────────────────────────────────
  describe('handleStatusWebhook', () => {
    it('should map twilio status to internal status', async () => {
      mockPrismaService.call.update.mockResolvedValue(mockCall);

      await service.handleStatusWebhook('call-123', 'completed', 120);

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          duration: 120,
        }),
      });
    });

    it('should handle in-progress status', async () => {
      mockPrismaService.call.update.mockResolvedValue(mockCall);

      await service.handleStatusWebhook('call-123', 'in-progress');

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('should default to INITIATED for unknown status', async () => {
      mockPrismaService.call.update.mockResolvedValue(mockCall);

      await service.handleStatusWebhook('call-123', 'unknown-status');

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: { status: 'INITIATED' },
      });
    });
  });

  // ──────────────────────────────────────────────
  // analyzeCall
  // ──────────────────────────────────────────────
  describe('analyzeCall', () => {
    it('should throw when call has no transcript', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue({ ...mockCall, transcript: null });

      await expect(service.analyzeCall('call-123', 'company-123', 'user-123')).rejects.toThrow(
        'Call has no transcript to analyze',
      );
    });

    it('should generate suggestions from transcript chunks', async () => {
      const longTranscript = Array(10)
        .fill('This is a sentence that is long enough to pass the filter.')
        .join(' ');

      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        transcript: longTranscript,
        aiSuggestions: [],
      });
      mockPrismaService.aISuggestion.deleteMany.mockResolvedValue({ count: 0 });
      mockAiService.generateSuggestion.mockResolvedValue({
        text: 'AI suggestion text',
        confidence: 0.85,
        provider: 'openai',
        latencyMs: 200,
      });
      mockPrismaService.aISuggestion.create.mockResolvedValue({ id: 'sug-1' });

      await service.analyzeCall('call-123', 'company-123', 'user-123');

      expect(mockPrismaService.aISuggestion.deleteMany).toHaveBeenCalledWith({
        where: { callId: 'call-123' },
      });
      expect(mockAiService.generateSuggestion).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // endCall
  // ──────────────────────────────────────────────
  describe('endCall', () => {
    it('should throw when Twilio not configured', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        twilioCallSid: 'CA123',
      });

      await expect(service.endCall('call-123', 'company-123')).rejects.toThrow(
        'Twilio not configured',
      );
    });
  });

  // findCallById
  describe('findCallById', () => {
    it('returns call via findUnique', async () => {
      mockPrismaService.call.findUnique.mockResolvedValue(mockCall);
      const result = await service.findCallById('call-123');
      expect(result).toEqual(mockCall);
      expect(mockPrismaService.call.findUnique).toHaveBeenCalledWith({
        where: { id: 'call-123' },
      });
    });

    it('returns null when not found', async () => {
      mockPrismaService.call.findUnique.mockResolvedValue(null);
      const result = await service.findCallById('missing');
      expect(result).toBeNull();
    });
  });

  // initiateCall
  describe('initiateCall', () => {
    it('throws ServiceUnavailableException when Twilio not configured', async () => {
      await expect(
        service.initiateCall('company-123', 'user-123', '+5511', 'https://hook'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('happy path: creates call, calls Twilio, updates with SID', async () => {
      const twilioCallsCreate = jest.fn().mockResolvedValue({ sid: 'CA-SID' });
      (service as unknown as { twilioClient: unknown }).twilioClient = {
        calls: { create: twilioCallsCreate },
      };
      mockPrismaService.call.create.mockResolvedValue({ ...mockCall, id: 'new-call' });
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        id: 'new-call',
        twilioCallSid: 'CA-SID',
      });

      const result = await service.initiateCall(
        'company-123',
        'user-123',
        '+5511',
        'https://hook.com',
      );

      expect(result.twilioCallSid).toBe('CA-SID');
      expect(twilioCallsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+5511',
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          record: true,
        }),
      );
      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'new-call' },
        data: { twilioCallSid: 'CA-SID', status: 'INITIATED' },
      });
    });

    it('marks call FAILED when Twilio create rejects, then rethrows', async () => {
      const twilioCallsCreate = jest.fn().mockRejectedValue(new Error('twilio-down'));
      (service as unknown as { twilioClient: unknown }).twilioClient = {
        calls: { create: twilioCallsCreate },
      };
      mockPrismaService.call.create.mockResolvedValue({ ...mockCall, id: 'new-call' });
      mockPrismaService.call.update.mockResolvedValue({});

      await expect(
        service.initiateCall('company-123', 'user-123', '+5511', 'https://hook'),
      ).rejects.toThrow('twilio-down');

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'new-call' },
        data: { status: 'FAILED' },
      });
    });

    it('propagates prisma.call.create errors before Twilio is hit', async () => {
      (service as unknown as { twilioClient: unknown }).twilioClient = {
        calls: { create: jest.fn() },
      };
      mockPrismaService.call.create.mockRejectedValue(new Error('db-create-fail'));

      await expect(
        service.initiateCall('company-123', 'user-123', '+5511', 'https://hook'),
      ).rejects.toThrow('db-create-fail');
    });
  });

  // endCall failure modes
  describe('endCall (failure modes)', () => {
    it('throws BadRequestException when call has no twilioCallSid', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        twilioCallSid: null,
      });
      (service as unknown as { twilioClient: unknown }).twilioClient = {
        calls: jest.fn(),
      };

      await expect(service.endCall('call-123', 'company-123')).rejects.toThrow(BadRequestException);
    });

    it('happy path updates Twilio + persists COMPLETED', async () => {
      const updateMock = jest.fn().mockResolvedValue({});
      const twilioCallsFn = jest.fn().mockReturnValue({ update: updateMock });
      (service as unknown as { twilioClient: unknown }).twilioClient = {
        calls: twilioCallsFn,
      };
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        twilioCallSid: 'CA-XYZ',
      });
      mockPrismaService.call.update.mockResolvedValue({ ...mockCall, status: 'COMPLETED' });

      const result = await service.endCall('call-123', 'company-123');

      expect(twilioCallsFn).toHaveBeenCalledWith('CA-XYZ');
      expect(updateMock).toHaveBeenCalledWith({ status: 'completed' });
      expect(result.status).toBe('COMPLETED');
    });

    it('rethrows when Twilio update fails', async () => {
      const updateMock = jest.fn().mockRejectedValue(new Error('twilio-update-fail'));
      const twilioCallsFn = jest.fn().mockReturnValue({ update: updateMock });
      (service as unknown as { twilioClient: unknown }).twilioClient = {
        calls: twilioCallsFn,
      };
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        twilioCallSid: 'CA-XYZ',
      });

      await expect(service.endCall('call-123', 'company-123')).rejects.toThrow(
        'twilio-update-fail',
      );
    });
  });

  // findOrCreateByCallSid
  describe('findOrCreateByCallSid', () => {
    it('returns existing call without upserting when SID already known', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        twilioCallSid: 'CA-EXISTING',
      });

      const result = await service.findOrCreateByCallSid('CA-EXISTING', '+5511');

      expect(result).toBeDefined();
      expect(mockPrismaService.call.upsert).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no active company exists', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);
      mockPrismaService.company.findFirst.mockResolvedValue(null);

      await expect(service.findOrCreateByCallSid('CA-NEW', '+5511')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when company has no users', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);
      mockPrismaService.company.findFirst.mockResolvedValue({ id: 'company-123' });
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOrCreateByCallSid('CA-NEW', '+5511')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('upserts atomic and emits contact.touch event on new call', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);
      mockPrismaService.company.findFirst.mockResolvedValue({ id: 'company-123' });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-123' });
      mockPrismaService.call.upsert.mockResolvedValue({
        ...mockCall,
        twilioCallSid: 'CA-NEW',
        direction: 'INBOUND',
      });

      const result = await service.findOrCreateByCallSid('CA-NEW', '+5511');

      expect(result.direction).toBe('INBOUND');
      expect(mockPrismaService.call.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { twilioCallSid: 'CA-NEW' },
          create: expect.objectContaining({
            direction: 'INBOUND',
            twilioCallSid: 'CA-NEW',
            duration: 0,
          }),
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'contacts.touch',
        expect.objectContaining({ phone: '+5511', channel: 'CALL' }),
      );
    });
  });

  // handleStatusWebhookBySid
  describe('handleStatusWebhookBySid', () => {
    it('no-ops when no call matches the SID', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);
      await service.handleStatusWebhookBySid('CA-MISSING', 'completed', 60);
      expect(mockPrismaService.call.update).not.toHaveBeenCalled();
    });

    it('delegates to handleStatusWebhook when call is found', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        id: 'call-abc',
        twilioCallSid: 'CA-FOUND',
      });
      mockPrismaService.call.update.mockResolvedValue(mockCall);

      await service.handleStatusWebhookBySid('CA-FOUND', 'ringing');

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-abc' },
        data: { status: 'RINGING' },
      });
    });
  });

  // handleStatusWebhook fan-out
  describe('handleStatusWebhook (event fan-out)', () => {
    it.each([
      ['initiated', 'INITIATED'],
      ['ringing', 'RINGING'],
      ['in-progress', 'IN_PROGRESS'],
      ['busy', 'BUSY'],
      ['no-answer', 'NO_ANSWER'],
      ['failed', 'FAILED'],
      ['canceled', 'CANCELED'],
    ])('maps Twilio %s -> internal %s', async (twilioStatus, expected) => {
      mockPrismaService.call.update.mockResolvedValue(mockCall);
      await service.handleStatusWebhook('call-123', twilioStatus);
      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: { status: expected },
      });
    });

    it('does NOT auto-summarize when COMPLETED without transcript', async () => {
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        status: 'COMPLETED',
        transcript: null,
      });
      await service.handleStatusWebhook('call-123', 'completed');
      expect(mockSummariesService.autoSummarizeCall).not.toHaveBeenCalled();
    });

    it('does NOT auto-summarize when COMPLETED with whitespace-only transcript', async () => {
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        status: 'COMPLETED',
        transcript: '   \n\t  ',
      });
      await service.handleStatusWebhook('call-123', 'completed');
      expect(mockSummariesService.autoSummarizeCall).not.toHaveBeenCalled();
    });

    it('triggers auto-summary on COMPLETED with non-empty transcript', async () => {
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        status: 'COMPLETED',
        transcript: 'Some real transcript content',
      });
      await service.handleStatusWebhook('call-123', 'completed');
      await new Promise((r) => setImmediate(r));
      expect(mockSummariesService.autoSummarizeCall).toHaveBeenCalledWith('call-123');
    });

    it('swallows auto-summary rejection silently (never crashes hot path)', async () => {
      mockSummariesService.autoSummarizeCall.mockRejectedValueOnce(new Error('boom'));
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        status: 'COMPLETED',
        transcript: 'transcript',
      });
      await expect(service.handleStatusWebhook('call-123', 'completed')).resolves.toBeDefined();
    });

    it('emits CALL_COMPLETED webhook + CSAT schedule on COMPLETED', async () => {
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        status: 'COMPLETED',
        transcript: null,
      });
      await service.handleStatusWebhook('call-123', 'completed', 90);
      const eventNames = mockEventEmitter.emit.mock.calls.map((c) => c[0]);
      expect(eventNames).toContain('webhooks.emit');
      expect(eventNames).toContain('csat.schedule');
    });

    it('does NOT fire webhook/CSAT on non-COMPLETED status', async () => {
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        status: 'RINGING',
      });
      await service.handleStatusWebhook('call-123', 'ringing');
      const eventNames = mockEventEmitter.emit.mock.calls.map((c) => c[0]);
      expect(eventNames).not.toContain('webhooks.emit');
      expect(eventNames).not.toContain('csat.schedule');
    });
  });

  // handleRecordingCompleted
  describe('handleRecordingCompleted', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('saves recordingUrl + duration to call', async () => {
      mockPrismaService.call.update.mockResolvedValue({});
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        arrayBuffer: jest.fn(),
      }) as unknown as typeof fetch;

      await service.handleRecordingCompleted('call-123', 'https://r.io/abc', 75);

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: { recordingUrl: 'https://r.io/abc.mp3', duration: 75 },
      });
    });

    it('returns early when Twilio fetch returns non-OK status', async () => {
      mockPrismaService.call.update.mockResolvedValue({});
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        arrayBuffer: jest.fn(),
      });
      global.fetch = fetchFn as unknown as typeof fetch;

      await service.handleRecordingCompleted('call-123', 'https://r.io/abc', 75);

      expect(mockPrismaService.call.update).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('returns early when Deepgram fetch returns non-OK', async () => {
      mockPrismaService.call.update.mockResolvedValue({});
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: jest.fn(),
        }) as unknown as typeof fetch;

      await service.handleRecordingCompleted('call-123', 'https://r.io/abc', 75);
      expect(mockPrismaService.call.update).toHaveBeenCalledTimes(1);
    });

    it('persists transcript when Deepgram returns text', async () => {
      mockPrismaService.call.update.mockResolvedValue({});
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: { channels: [{ alternatives: [{ transcript: 'ola mundo' }] }] },
          }),
        }) as unknown as typeof fetch;

      await service.handleRecordingCompleted('call-123', 'https://r.io/abc', 75);

      expect(mockPrismaService.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: { transcript: 'ola mundo' },
      });
    });

    it('does NOT persist transcript when Deepgram returns empty string', async () => {
      mockPrismaService.call.update.mockResolvedValue({});
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: { channels: [{ alternatives: [{ transcript: '' }] }] },
          }),
        }) as unknown as typeof fetch;

      await service.handleRecordingCompleted('call-123', 'https://r.io/abc', 75);
      expect(mockPrismaService.call.update).toHaveBeenCalledTimes(1);
    });

    it('swallows transcription errors silently', async () => {
      mockPrismaService.call.update.mockResolvedValue({});
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('network-fail')) as unknown as typeof fetch;
      await expect(
        service.handleRecordingCompleted('call-123', 'https://r.io/abc', 75),
      ).resolves.toBeUndefined();
    });
  });

  // exportCallsAsCsv
  describe('exportCallsAsCsv', () => {
    it('returns header-only when there are no calls', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([]);
      const csv = await service.exportCallsAsCsv('company-123');
      expect(csv).toBe('Date,Phone,Direction,Status,Duration (sec),Sentiment,AI Suggestions Count');
    });

    it('formats sentiment with 2 decimals + counts aiSuggestions', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([
        {
          ...mockCall,
          createdAt: new Date('2026-05-01T10:00:00Z'),
          sentiment: 0.7314,
          aiSuggestions: [{ id: 'a' }, { id: 'b' }],
        },
      ]);
      const csv = await service.exportCallsAsCsv('company-123');
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('0.73');
      expect(lines[1]).toContain(',2');
    });

    it('escapes fields containing commas with surrounding quotes', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([
        {
          ...mockCall,
          phoneNumber: '+55,foo',
          sentiment: null,
          aiSuggestions: [],
        },
      ]);
      const csv = await service.exportCallsAsCsv('company-123');
      expect(csv).toContain('"+55,foo"');
    });

    it('escapes embedded double quotes per RFC 4180', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([
        {
          ...mockCall,
          phoneNumber: '+55"weird"',
          sentiment: null,
          aiSuggestions: [],
        },
      ]);
      const csv = await service.exportCallsAsCsv('company-123');
      expect(csv).toContain('"+55""weird"""');
    });

    it('escapes fields with embedded newlines', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([
        {
          ...mockCall,
          phoneNumber: 'line1\nline2',
          sentiment: null,
          aiSuggestions: [],
        },
      ]);
      const csv = await service.exportCallsAsCsv('company-123');
      expect(csv).toContain('"line1\nline2"');
    });

    it('caps result set at 10000 rows', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([]);
      await service.exportCallsAsCsv('company-123');
      expect(mockPrismaService.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10000 }),
      );
    });
  });

  // analyzeCall failure modes
  describe('analyzeCall (failure modes)', () => {
    it('throws BadRequestException when transcript missing', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue({ ...mockCall, transcript: null });
      await expect(service.analyzeCall('call-123', 'company-123', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('completes when all AI calls fail', async () => {
      const transcript = Array(10)
        .fill('Sentence longer than twenty characters to pass filter.')
        .join(' ');
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        transcript,
        aiSuggestions: [],
      });
      mockPrismaService.aISuggestion.deleteMany.mockResolvedValue({ count: 0 });
      mockAiService.generateSuggestion.mockRejectedValue(new Error('ai-down'));

      const result = await service.analyzeCall('call-123', 'company-123', 'user-123');

      expect(result).toBeDefined();
      expect(mockPrismaService.aISuggestion.create).not.toHaveBeenCalled();
    });

    it('swallows individual aISuggestion.create errors but completes', async () => {
      const transcript = Array(10)
        .fill('Sentence longer than twenty characters to pass filter.')
        .join(' ');
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        transcript,
        aiSuggestions: [],
      });
      mockPrismaService.aISuggestion.deleteMany.mockResolvedValue({ count: 0 });
      mockAiService.generateSuggestion.mockResolvedValue({
        text: 'suggested reply',
        confidence: 0.9,
        provider: 'openai',
        latencyMs: 150,
      });
      mockPrismaService.aISuggestion.create.mockRejectedValue(new Error('db-fail'));

      const result = await service.analyzeCall('call-123', 'company-123', 'user-123');
      expect(result).toBeDefined();
    });

    it('skips AI results with empty text', async () => {
      const transcript = Array(10)
        .fill('Sentence longer than twenty characters to pass filter.')
        .join(' ');
      mockPrismaService.call.findFirst.mockResolvedValue({
        ...mockCall,
        transcript,
        aiSuggestions: [],
      });
      mockPrismaService.aISuggestion.deleteMany.mockResolvedValue({ count: 0 });
      mockAiService.generateSuggestion.mockResolvedValue({
        text: '',
        confidence: 0,
        provider: 'openai',
        latencyMs: 100,
      });

      await service.analyzeCall('call-123', 'company-123', 'user-123');
      expect(mockPrismaService.aISuggestion.create).not.toHaveBeenCalled();
    });
  });
});
