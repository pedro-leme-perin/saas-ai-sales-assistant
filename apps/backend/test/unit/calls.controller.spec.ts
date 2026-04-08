import { Test, TestingModule } from '@nestjs/testing';
import { CallsController } from '../../src/modules/calls/calls.controller';
import { CallsService } from '../../src/modules/calls/calls.service';

jest.setTimeout(15000);

describe('CallsController', () => {
  let controller: CallsController;
  let callsService: jest.Mocked<Partial<CallsService>>;

  const mockCall = {
    id: 'call-123',
    userId: 'user-1',
    companyId: 'company-123',
    phoneNumber: '+5511999990000',
    direction: 'OUTBOUND',
    status: 'COMPLETED',
    durationSecs: 120,
    transcript: 'Olá, gostaria de saber mais...',
    sentiment: 0.75,
    aiSuggestions: [],
    createdAt: new Date(),
  };

  const mockStats = {
    totalCalls: 50,
    avgDuration: 180,
    avgSentiment: 0.72,
    callsByStatus: { COMPLETED: 40, FAILED: 5, IN_PROGRESS: 5 },
  };

  const mockReq = {
    user: { id: 'user-1', companyId: 'company-123', role: 'VENDOR' },
  };

  beforeEach(async () => {
    callsService = {
      findAll: jest.fn().mockResolvedValue([mockCall]),
      findOne: jest.fn().mockResolvedValue(mockCall),
      create: jest.fn().mockResolvedValue(mockCall),
      update: jest.fn().mockResolvedValue({ ...mockCall, status: 'IN_PROGRESS' }),
      getCallStats: jest.fn().mockResolvedValue(mockStats),
      initiateCall: jest.fn().mockResolvedValue({ callId: 'call-new', status: 'INITIATED' }),
      endCall: jest.fn().mockResolvedValue({ success: true }),
      findOrCreateByCallSid: jest.fn().mockResolvedValue(mockCall),
      handleRecordingCompleted: jest.fn().mockResolvedValue(undefined),
      handleStatusWebhook: jest.fn().mockResolvedValue(undefined),
      handleStatusWebhookBySid: jest.fn().mockResolvedValue(undefined),
      analyzeCall: jest.fn().mockResolvedValue({ sentiment: 0.8, suggestions: [] }),
      exportCallsAsCsv: jest
        .fn()
        .mockResolvedValue(
          'Date,Phone,Direction,Status,Duration (sec),Sentiment,AI Suggestions Count\n',
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallsController],
      providers: [{ provide: CallsService, useValue: callsService }],
    })
      .overrideGuard('AuthGuard')
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CallsController>(CallsController);
  });

  // ─────────────────────────────────────────
  // GET /calls/:companyId
  // ─────────────────────────────────────────

  describe('findAll', () => {
    it('should return all calls for company', async () => {
      const result = await controller.findAll('company-123');
      expect(result).toEqual([mockCall]);
      expect(callsService.findAll).toHaveBeenCalledWith('company-123');
    });

    it('should return empty array when no calls', async () => {
      (callsService.findAll as jest.Mock).mockResolvedValueOnce([]);
      const result = await controller.findAll('company-new');
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────
  // GET /calls/:companyId/stats
  // ─────────────────────────────────────────

  describe('getStats', () => {
    it('should return call statistics', async () => {
      const result = await controller.getStats('company-123');
      expect(result).toEqual(mockStats);
      expect(callsService.getCallStats).toHaveBeenCalledWith('company-123');
    });
  });

  // ─────────────────────────────────────────
  // GET /calls/:companyId/:id
  // ─────────────────────────────────────────

  describe('findOne', () => {
    it('should return single call by id and companyId', async () => {
      const result = await controller.findOne('company-123', 'call-123');
      expect(result).toEqual(mockCall);
      expect(callsService.findOne).toHaveBeenCalledWith('call-123', 'company-123');
    });
  });

  // ─────────────────────────────────────────
  // POST /calls/:companyId
  // ─────────────────────────────────────────

  describe('create', () => {
    it('should create a call with user context', async () => {
      const data = { phoneNumber: '+5511999990000', direction: 'OUTBOUND' };
      const result = await controller.create('company-123', data, mockReq);
      expect(result).toEqual(mockCall);
      expect(callsService.create).toHaveBeenCalledWith('company-123', 'user-1', data);
    });
  });

  // ─────────────────────────────────────────
  // PUT /calls/:companyId/:id
  // ─────────────────────────────────────────

  describe('update', () => {
    it('should update call data', async () => {
      const data = { status: 'IN_PROGRESS' };
      const result = await controller.update('company-123', 'call-123', data);
      expect(result.status).toBe('IN_PROGRESS');
      expect(callsService.update).toHaveBeenCalledWith('call-123', 'company-123', data);
    });
  });

  // ─────────────────────────────────────────
  // POST /calls/:companyId/initiate
  // ─────────────────────────────────────────

  describe('initiateCall', () => {
    it('should initiate outbound call', async () => {
      const result = await controller.initiateCall(
        'company-123',
        { phoneNumber: '+5511999990000' },
        mockReq,
      );
      expect(result).toEqual({ callId: 'call-new', status: 'INITIATED' });
      expect(callsService.initiateCall).toHaveBeenCalledWith(
        'company-123',
        'user-1',
        '+5511999990000',
        expect.any(String),
      );
    });
  });

  // ─────────────────────────────────────────
  // POST /calls/:companyId/:id/end
  // ─────────────────────────────────────────

  describe('endCall', () => {
    it('should end an active call', async () => {
      const result = await controller.endCall('company-123', 'call-123');
      expect(result).toEqual({ success: true });
      expect(callsService.endCall).toHaveBeenCalledWith('call-123', 'company-123');
    });
  });

  // ─────────────────────────────────────────
  // TWILIO WEBHOOKS
  // ─────────────────────────────────────────

  describe('handleRecordingWebhook', () => {
    it('should process completed recording', async () => {
      const body = {
        RecordingSid: 'rec-123',
        RecordingUrl: 'https://api.twilio.com/recording.wav',
        RecordingStatus: 'completed',
        RecordingDuration: '120',
      };
      const result = await controller.handleRecordingWebhook('call-123', body);
      expect(result).toEqual({ success: true });
      expect(callsService.handleRecordingCompleted).toHaveBeenCalledWith(
        'call-123',
        body.RecordingUrl,
        120,
      );
    });

    it('should ignore non-completed recordings', async () => {
      const body = { RecordingStatus: 'in-progress' };
      const result = await controller.handleRecordingWebhook('call-123', body);
      expect(result).toEqual({ success: true });
      expect(callsService.handleRecordingCompleted).not.toHaveBeenCalled();
    });
  });

  describe('handleStatusWebhook', () => {
    it('should forward status update to service', async () => {
      const body = { CallStatus: 'completed', CallDuration: '180' };
      const result = await controller.handleStatusWebhook('call-123', body);
      expect(result).toEqual({ success: true });
      expect(callsService.handleStatusWebhook).toHaveBeenCalledWith('call-123', 'completed', 180);
    });

    it('should handle missing duration', async () => {
      const body = { CallStatus: 'ringing' };
      await controller.handleStatusWebhook('call-123', body);
      expect(callsService.handleStatusWebhook).toHaveBeenCalledWith(
        'call-123',
        'ringing',
        undefined,
      );
    });
  });

  describe('handleStatusWebhookGlobal', () => {
    it('should route by CallSid', async () => {
      const body = { CallStatus: 'completed', CallDuration: '60', CallSid: 'CA123' };
      const result = await controller.handleStatusWebhookGlobal(body);
      expect(result).toEqual({ success: true });
      expect(callsService.handleStatusWebhookBySid).toHaveBeenCalledWith('CA123', 'completed', 60);
    });
  });

  describe('handleTranscriptionWebhook', () => {
    it('should update transcript when text provided', async () => {
      const body = { TranscriptionText: 'Hello world' };
      const result = await controller.handleTranscriptionWebhook('call-123', body);
      expect(result).toEqual({ success: true });
      expect(callsService.update).toHaveBeenCalledWith('call-123', '', {
        transcript: 'Hello world',
      });
    });

    it('should skip update when no text', async () => {
      const body = {};
      const result = await controller.handleTranscriptionWebhook('call-123', body);
      expect(result).toEqual({ success: true });
      expect(callsService.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // POST /calls/:companyId/:id/analyze
  // ─────────────────────────────────────────

  describe('analyzeCall', () => {
    it('should analyze call transcript', async () => {
      const result = await controller.analyzeCall('company-123', 'call-123', mockReq);
      expect(result).toEqual({ sentiment: 0.8, suggestions: [] });
      expect(callsService.analyzeCall).toHaveBeenCalledWith('call-123', 'company-123', 'user-1');
    });
  });
});
