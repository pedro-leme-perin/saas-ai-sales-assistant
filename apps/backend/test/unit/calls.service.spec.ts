import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { CallsService } from '../../src/modules/calls/calls.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { AiService } from '../../src/modules/ai/ai.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: { get: jest.fn(() => null) } },
        { provide: AiService, useValue: mockAiService },
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
        'Cannot end call - Twilio not configured or no SID',
      );
    });
  });
});
