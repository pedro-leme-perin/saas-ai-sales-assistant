import { Logger } from '@nestjs/common';
import { MediaStreamsGateway } from '../../src/modules/calls/media-streams.gateway';
import { DeepgramService, LiveSession } from '../../src/infrastructure/stt/deepgram.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { SuggestionType } from '@prisma/client';

jest.setTimeout(15000);

describe('MediaStreamsGateway', () => {
  let gateway: MediaStreamsGateway;
  let deepgramService: jest.Mocked<DeepgramService>;
  let aiService: jest.Mocked<AiService>;
  let notificationsGateway: jest.Mocked<NotificationsGateway>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockStreamSid = 'stream-123';
  const mockCallSid = 'call-456';
  const mockCallId = 'db-call-789';
  const mockUserId = 'user-001';

  const createMockLiveSession = (): jest.Mocked<LiveSession> => ({
    send: jest.fn(),
    finish: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
  });

  beforeEach(() => {
    // Mock DeepgramService
    deepgramService = {
      isConfigured: jest.fn().mockReturnValue(true),
      createLiveSession: jest.fn(),
    } as any;

    // Mock AiService
    aiService = {
      generateSuggestion: jest.fn(),
    } as any;

    // Mock NotificationsGateway
    notificationsGateway = {
      sendAISuggestion: jest.fn(),
    } as any;

    // Mock PrismaService
    prismaService = {
      call: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      aISuggestion: {
        create: jest.fn(),
      },
    } as any;

    gateway = new MediaStreamsGateway(
      deepgramService,
      aiService,
      notificationsGateway,
      prismaService,
    );

    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(gateway).toBeDefined();
    });

    it('should have empty activeSessions on creation', () => {
      expect(gateway['activeSessions'].size).toBe(0);
    });

    it('should have mediaChunkCount set to 0', () => {
      expect(gateway['mediaChunkCount']).toBe(0);
    });
  });

  describe('initWss', () => {
    it('should initialize WebSocket server in noServer mode', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.initWss();

      expect(gateway['wss']).toBeDefined();
      expect(logSpy).toHaveBeenCalledWith(
        'MediaStreams WebSocket server initialized (noServer mode)',
      );
    });

    it('should setup connection listener on wss', () => {
      gateway.initWss();

      // Verify wss was created with proper event handling
      expect(gateway['wss']).toBeDefined();
      // Verify the wss instance is a WebSocket.Server
      expect(gateway['wss']!.on).toBeDefined();
    });
  });

  describe('handleUpgrade', () => {
    it('should destroy socket if WSS not initialized', () => {
      const mockSocket = {
        destroy: jest.fn(),
      } as any;
      const mockRequest = {} as any;
      const mockHead = Buffer.from('');

      gateway.handleUpgrade(mockRequest, mockSocket, mockHead);

      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should call handleUpgrade on WSS when initialized', () => {
      gateway.initWss();

      const mockSocket = {
        destroy: jest.fn(),
      } as any;
      const mockRequest = { url: '/ws/media' } as any;
      const mockHead = Buffer.from('');

      const wss = gateway['wss']!;
      const handleUpgradeSpy = jest.spyOn(wss, 'handleUpgrade');

      gateway.handleUpgrade(mockRequest, mockSocket, mockHead);

      expect(handleUpgradeSpy).toHaveBeenCalledWith(
        mockRequest,
        mockSocket,
        mockHead,
        expect.any(Function),
      );

      handleUpgradeSpy.mockRestore();
    });
  });

  describe('init', () => {
    it('should call initWss', () => {
      const initWssSpy = jest.spyOn(gateway, 'initWss');

      gateway.init({});

      expect(initWssSpy).toHaveBeenCalled();
    });
  });

  describe('handleTwilioMessage', () => {
    beforeEach(() => {
      gateway.initWss();
    });

    it('should handle connected event', async () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      const message = {
        event: 'connected' as const,
      };

      await gateway['handleTwilioMessage'](message);

      expect(logSpy).toHaveBeenCalledWith('Twilio stream connected event received');
    });

    it('should call handleStreamStart for start event', async () => {
      const startSpy = jest.spyOn(gateway as any, 'handleStreamStart');

      const message = {
        event: 'start' as const,
      };

      await gateway['handleTwilioMessage'](message);

      expect(startSpy).toHaveBeenCalledWith(message);
    });

    it('should call handleMediaChunk for media event', async () => {
      const mediaSpy = jest.spyOn(gateway as any, 'handleMediaChunk');

      const message = {
        event: 'media' as const,
        media: { payload: 'base64data' },
      };

      await gateway['handleTwilioMessage'](message);

      expect(mediaSpy).toHaveBeenCalledWith(message);
    });

    it('should call handleStreamStop for stop event', async () => {
      const stopSpy = jest.spyOn(gateway as any, 'handleStreamStop');

      const message = {
        event: 'stop' as const,
      };

      await gateway['handleTwilioMessage'](message);

      expect(stopSpy).toHaveBeenCalledWith(message);
    });

    it('should ignore unknown event types', async () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      const message = {
        event: 'unknown' as any,
      };

      await expect(gateway['handleTwilioMessage'](message)).resolves.not.toThrow();

      // Should not log any errors for unknown events
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('error'));
    });
  });

  describe('handleStreamStart', () => {
    beforeEach(() => {
      gateway.initWss();
    });

    it('should warn when call not found', async () => {
      prismaService.call.findFirst.mockResolvedValue(null);
      const warnSpy = jest.spyOn(gateway['logger'], 'warn');

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      expect(warnSpy).toHaveBeenCalledWith(`Call not found for SID: ${mockCallSid}`);
    });

    it('should skip deepgram when not configured', async () => {
      deepgramService.isConfigured.mockReturnValue(false);
      prismaService.call.findFirst.mockResolvedValue({
        id: mockCallId,
        userId: mockUserId,
      } as any);

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      expect(gateway['activeSessions'].get(mockStreamSid)).toBeDefined();
      expect(gateway['activeSessions'].get(mockStreamSid)!.deepgramSession).toBeNull();
      expect(deepgramService.createLiveSession).not.toHaveBeenCalled();
    });

    it('should create deepgram session when configured', async () => {
      const mockSession = createMockLiveSession();
      deepgramService.createLiveSession.mockReturnValue(mockSession);
      prismaService.call.findFirst.mockResolvedValue({
        id: mockCallId,
        userId: mockUserId,
      } as any);

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      expect(deepgramService.createLiveSession).toHaveBeenCalled();
      expect(gateway['activeSessions'].get(mockStreamSid)?.deepgramSession).toBe(mockSession);
    });

    it('should handle deepgram session creation error', async () => {
      deepgramService.createLiveSession.mockImplementation(() => {
        throw new Error('Deepgram error');
      });
      prismaService.call.findFirst.mockResolvedValue({
        id: mockCallId,
        userId: mockUserId,
      } as any);
      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      expect(errorSpy).toHaveBeenCalledWith('Error creating Deepgram session:', expect.any(Error));
      // Should still create session entry with null deepgramSession
      expect(gateway['activeSessions'].get(mockStreamSid)?.deepgramSession).toBeNull();
    });

    it('should reset mediaChunkCount on stream start', async () => {
      gateway['mediaChunkCount'] = 999;
      prismaService.call.findFirst.mockResolvedValue({
        id: mockCallId,
        userId: mockUserId,
      } as any);

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      expect(gateway['mediaChunkCount']).toBe(0);
    });

    it('should pass transcript callback to deepgram', async () => {
      let transcriptCallback: any;
      deepgramService.createLiveSession.mockImplementation((onTranscript: any) => {
        transcriptCallback = onTranscript;
        return createMockLiveSession();
      });
      prismaService.call.findFirst.mockResolvedValue({
        id: mockCallId,
        userId: mockUserId,
      } as any);

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      // Test transcript callback
      expect(transcriptCallback).toBeDefined();
      transcriptCallback({ text: 'Hello', isFinal: true });

      expect(notificationsGateway.sendAISuggestion).toHaveBeenCalledWith(mockUserId, {
        callId: mockCallId,
        transcript: 'Hello',
        isFinal: true,
        type: 'transcript',
        timestamp: expect.any(Date),
      });
    });

    it('should not send interim transcripts to client', async () => {
      let transcriptCallback: any;
      deepgramService.createLiveSession.mockImplementation((onTranscript: any) => {
        transcriptCallback = onTranscript;
        return createMockLiveSession();
      });
      prismaService.call.findFirst.mockResolvedValue({
        id: mockCallId,
        userId: mockUserId,
      } as any);

      const message = {
        event: 'start' as const,
        streamSid: mockStreamSid,
        start: { callSid: mockCallSid },
      };

      await gateway['handleStreamStart'](message);

      // Test interim transcript callback
      transcriptCallback({ text: 'Hello', isFinal: false });

      expect(notificationsGateway.sendAISuggestion).not.toHaveBeenCalled();
    });
  });

  describe('generateAndSendSuggestion', () => {
    beforeEach(() => {
      gateway.initWss();
    });

    it('should skip phrases with less than 3 words', async () => {
      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'hi there');

      expect(aiService.generateSuggestion).not.toHaveBeenCalled();
    });

    it('should generate suggestion for phrases with 3+ words', async () => {
      const mockSuggestion = {
        text: 'Suggest product',
        confidence: 0.9,
        provider: 'openai',
        latencyMs: 100,
      };
      aiService.generateSuggestion.mockResolvedValue(mockSuggestion);
      prismaService.aISuggestion.create.mockResolvedValue({} as any);

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'customer asks about price');

      expect(aiService.generateSuggestion).toHaveBeenCalledWith(
        'customer asks about price',
        expect.any(Object),
        'gemini',
      );
    });

    it('should send suggestion to client via notifications', async () => {
      const mockSuggestion = {
        text: 'Suggest discount',
        confidence: 0.85,
        provider: 'openai',
        latencyMs: 150,
      };
      aiService.generateSuggestion.mockResolvedValue(mockSuggestion);
      prismaService.aISuggestion.create.mockResolvedValue({} as any);

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'what are your prices');

      expect(notificationsGateway.sendAISuggestion).toHaveBeenCalledWith(mockUserId, {
        callId: mockCallId,
        suggestion: 'Suggest discount',
        confidence: 0.85,
        type: 'suggestion',
        timestamp: expect.any(Date),
      });
    });

    it('should save suggestion to database', async () => {
      const mockSuggestion = {
        text: 'Suggest discount',
        confidence: 0.85,
        provider: 'openai',
        latencyMs: 150,
      };
      aiService.generateSuggestion.mockResolvedValue(mockSuggestion);
      prismaService.aISuggestion.create.mockResolvedValue({} as any);

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'what are your prices');

      expect(prismaService.aISuggestion.create).toHaveBeenCalledWith({
        data: {
          callId: mockCallId,
          userId: mockUserId,
          type: SuggestionType.GENERAL,
          content: 'Suggest discount',
          confidence: 0.85,
          triggerText: 'what are your prices',
          model: 'openai',
          latencyMs: 150,
        },
      });
    });

    it('should use default confidence when not provided', async () => {
      const mockSuggestion = {
        text: 'Suggest product',
        confidence: undefined,
        provider: 'openai',
        latencyMs: 100,
      };
      aiService.generateSuggestion.mockResolvedValue(mockSuggestion);
      prismaService.aISuggestion.create.mockResolvedValue({} as any);

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'customer asks about price');

      expect(notificationsGateway.sendAISuggestion).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ confidence: 0.8 }),
      );
    });

    it('should include recent transcript in context', async () => {
      aiService.generateSuggestion.mockResolvedValue({
        text: 'test',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      });
      prismaService.aISuggestion.create.mockResolvedValue({} as any);

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: ['phrase 1', 'phrase 2', 'phrase 3', 'phrase 4'],
      };

      await gateway['generateAndSendSuggestion'](session, 'current phrase here');

      expect(aiService.generateSuggestion).toHaveBeenCalledWith(
        'current phrase here',
        expect.objectContaining({
          recentTranscript: 'phrase 2 phrase 3 phrase 4',
          type: 'sales_call',
        }),
        'gemini',
      );
    });

    it('should handle missing suggestion text gracefully', async () => {
      aiService.generateSuggestion.mockResolvedValue({
        text: undefined,
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      });
      prismaService.aISuggestion.create.mockResolvedValue({} as any);

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'customer asks about price');

      expect(notificationsGateway.sendAISuggestion).not.toHaveBeenCalled();
    });

    it('should handle database save errors gracefully', async () => {
      const mockSuggestion = {
        text: 'Suggest product',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      };
      aiService.generateSuggestion.mockResolvedValue(mockSuggestion);
      prismaService.aISuggestion.create.mockRejectedValue(new Error('DB error'));
      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      const session = {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      };

      await gateway['generateAndSendSuggestion'](session, 'customer asks about price');

      // Should still send suggestion to client
      expect(notificationsGateway.sendAISuggestion).toHaveBeenCalled();
      // Error should be caught
      expect(errorSpy).toHaveBeenCalledWith('Save suggestion error:', expect.any(Error));
    });
  });

  describe('handleMediaChunk', () => {
    it('should send audio to deepgram session if ready', () => {
      const mockSession = createMockLiveSession();
      const mockBase64Payload = Buffer.from('audio data').toString('base64');

      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: mockSession,
        fullTranscript: [],
      });

      const message = {
        event: 'media' as const,
        streamSid: mockStreamSid,
        media: { payload: mockBase64Payload },
      };

      gateway['handleMediaChunk'](message);

      expect(mockSession.send).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should skip if session not found', () => {
      const mockSession = createMockLiveSession();

      const message = {
        event: 'media' as const,
        streamSid: 'unknown-stream',
        media: { payload: 'base64data' },
      };

      gateway['handleMediaChunk'](message);

      expect(mockSession.send).not.toHaveBeenCalled();
    });

    it('should skip if deepgram session is null', () => {
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      });

      const message = {
        event: 'media' as const,
        streamSid: mockStreamSid,
        media: { payload: 'base64data' },
      };

      gateway['handleMediaChunk'](message);

      // Should not throw
      expect(gateway['activeSessions'].get(mockStreamSid)).toBeDefined();
    });

    it('should increment media chunk count', () => {
      const mockSession = createMockLiveSession();
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: mockSession,
        fullTranscript: [],
      });

      const initialCount = gateway['mediaChunkCount'];

      const message = {
        event: 'media' as const,
        streamSid: mockStreamSid,
        media: { payload: 'base64data' },
      };

      gateway['handleMediaChunk'](message);

      expect(gateway['mediaChunkCount']).toBe(initialCount + 1);
    });

    it('should log every 100th chunk', () => {
      const mockSession = createMockLiveSession();
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: mockSession,
        fullTranscript: [],
      });
      gateway['mediaChunkCount'] = 99;
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      const message = {
        event: 'media' as const,
        streamSid: mockStreamSid,
        media: { payload: 'base64data' },
      };

      gateway['handleMediaChunk'](message);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Media chunk #100'));
    });
  });

  describe('handleStreamStop', () => {
    it('should ignore if session not found', async () => {
      const message = {
        event: 'stop' as const,
        streamSid: 'unknown-stream',
      };

      await gateway['handleStreamStop'](message);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should call finish on deepgram session', async () => {
      const mockSession = createMockLiveSession();
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: mockSession,
        fullTranscript: ['hello', 'world'],
      });
      prismaService.call.update.mockResolvedValue({} as any);

      const message = {
        event: 'stop' as const,
        streamSid: mockStreamSid,
      };

      await gateway['handleStreamStop'](message);

      expect(mockSession.finish).toHaveBeenCalled();
    });

    it('should save full transcript to database', async () => {
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: ['hello', 'world'],
      });
      prismaService.call.update.mockResolvedValue({} as any);

      const message = {
        event: 'stop' as const,
        streamSid: mockStreamSid,
      };

      await gateway['handleStreamStop'](message);

      expect(prismaService.call.update).toHaveBeenCalledWith({
        where: { id: mockCallId },
        data: { transcript: 'hello world' },
      });
    });

    it('should skip database update if transcript is empty', async () => {
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      });

      const message = {
        event: 'stop' as const,
        streamSid: mockStreamSid,
      };

      await gateway['handleStreamStop'](message);

      expect(prismaService.call.update).not.toHaveBeenCalled();
    });

    it('should remove session from active sessions', async () => {
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: [],
      });

      const message = {
        event: 'stop' as const,
        streamSid: mockStreamSid,
      };

      await gateway['handleStreamStop'](message);

      expect(gateway['activeSessions'].has(mockStreamSid)).toBe(false);
    });

    it('should log when transcript is saved', async () => {
      gateway['activeSessions'].set(mockStreamSid, {
        callId: mockCallId,
        userId: mockUserId,
        deepgramSession: null,
        fullTranscript: ['hello'],
      });
      prismaService.call.update.mockResolvedValue({} as any);
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      const message = {
        event: 'stop' as const,
        streamSid: mockStreamSid,
      };

      await gateway['handleStreamStop'](message);

      expect(logSpy).toHaveBeenCalledWith(`Saved real-time transcript for call: ${mockCallId}`);
    });
  });
});
