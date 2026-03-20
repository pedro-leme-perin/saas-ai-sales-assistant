import { Test, TestingModule } from '@nestjs/testing';
import { TwilioWebhookController } from '../../src/presentation/webhooks/twilio.webhook';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.setTimeout(15000);

describe('TwilioWebhookController', () => {
  let controller: TwilioWebhookController;
  let eventEmitter: EventEmitter2;

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TwilioWebhookController],
      providers: [
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    controller = module.get<TwilioWebhookController>(TwilioWebhookController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // POST /webhooks/twilio/voice
  // ─────────────────────────────────────────

  describe('handleVoiceWebhook', () => {
    const mockVoiceBody = {
      CallSid: 'CA1234567890abcdef1234567890abcde',
      CallStatus: 'ringing',
      From: '+5511999990000',
      To: '+551140000000',
      CallDuration: '45',
      RecordingUrl: 'https://api.twilio.com/recording.mp3',
    };

    it('should emit twilio.call.status event with correct data', async () => {
      const signature = 'test-signature';

      await controller.handleVoiceWebhook(mockVoiceBody, signature);

      expect(eventEmitter.emit).toHaveBeenCalledWith('twilio.call.status', {
        callSid: 'CA1234567890abcdef1234567890abcde',
        status: 'ringing',
        from: '+5511999990000',
        to: '+551140000000',
        duration: '45',
        recordingUrl: 'https://api.twilio.com/recording.mp3',
      });
    });

    it('should return TwiML XML response with Portuguese greeting', async () => {
      const result = await controller.handleVoiceWebhook(mockVoiceBody, 'test-signature');

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<Response>');
      expect(result).toContain('Bem-vindo ao assistente de vendas');
      expect(result).toContain('pt-BR');
      expect(result).toContain('<Record');
    });

    it('should handle missing CallStatus gracefully', async () => {
      const bodyWithoutStatus = { ...mockVoiceBody, CallStatus: undefined };

      await controller.handleVoiceWebhook(bodyWithoutStatus, 'test-signature');

      expect(eventEmitter.emit).toHaveBeenCalledWith('twilio.call.status', {
        callSid: 'CA1234567890abcdef1234567890abcde',
        status: undefined,
        from: '+5511999990000',
        to: '+551140000000',
        duration: '45',
        recordingUrl: 'https://api.twilio.com/recording.mp3',
      });
    });

    it('should handle empty body fields', async () => {
      const bodyWithEmptyFields = {
        CallSid: 'CA1234567890abcdef1234567890abcde',
      };

      const result = await controller.handleVoiceWebhook(bodyWithEmptyFields, 'test-signature');

      expect(result).toContain('<?xml version="1.0"');
      expect(eventEmitter.emit).toHaveBeenCalledWith('twilio.call.status', {
        callSid: 'CA1234567890abcdef1234567890abcde',
        status: undefined,
        from: undefined,
        to: undefined,
        duration: undefined,
        recordingUrl: undefined,
      });
    });

    it('should emit event with RecordingUrl when present', async () => {
      const bodyWithRecording = {
        ...mockVoiceBody,
        RecordingUrl: 'https://api.twilio.com/custom-recording.wav',
      };

      await controller.handleVoiceWebhook(bodyWithRecording, 'test-signature');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'twilio.call.status',
        expect.objectContaining({
          recordingUrl: 'https://api.twilio.com/custom-recording.wav',
        }),
      );
    });
  });

  // ─────────────────────────────────────────
  // POST /webhooks/twilio/status
  // ─────────────────────────────────────────

  describe('handleStatusCallback', () => {
    const mockStatusBody = {
      CallSid: 'CA1234567890abcdef1234567890abcde',
      CallStatus: 'completed',
      CallDuration: '120',
    };

    it('should emit twilio.call.status-update event', async () => {
      await controller.handleStatusCallback(mockStatusBody);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'twilio.call.status-update',
        expect.objectContaining({
          callSid: 'CA1234567890abcdef1234567890abcde',
          status: 'completed',
          duration: '120',
        }),
      );
    });

    it('should include ISO timestamp in status-update event', async () => {
      const beforeCall = new Date();
      await controller.handleStatusCallback(mockStatusBody);
      const afterCall = new Date();

      const emittedCall = (eventEmitter.emit as jest.Mock).mock.calls[0];
      const eventData = emittedCall[1];
      const timestamp = new Date(eventData.timestamp);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should return received: true response', async () => {
      const result = await controller.handleStatusCallback(mockStatusBody);

      expect(result).toEqual({ received: true });
    });

    it('should handle missing CallStatus gracefully', async () => {
      const bodyWithoutStatus = { ...mockStatusBody, CallStatus: undefined };

      await controller.handleStatusCallback(bodyWithoutStatus);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'twilio.call.status-update',
        expect.objectContaining({
          callSid: 'CA1234567890abcdef1234567890abcde',
          status: undefined,
        }),
      );
    });

    it('should emit event with various call statuses', async () => {
      const statuses = ['initiated', 'ringing', 'answered', 'failed'];

      for (const status of statuses) {
        jest.clearAllMocks();
        await controller.handleStatusCallback({ ...mockStatusBody, CallStatus: status });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'twilio.call.status-update',
          expect.objectContaining({ status }),
        );
      }
    });
  });

  // ─────────────────────────────────────────
  // POST /webhooks/twilio/transcription
  // ─────────────────────────────────────────

  describe('handleTranscription', () => {
    const mockTranscriptionBody = {
      CallSid: 'CA1234567890abcdef1234567890abcde',
      TranscriptionText: 'Olá, tudo bem? Eu gostaria de saber mais sobre seu produto.',
      TranscriptionSid: 'TR1234567890abcdef1234567890abcde',
      RecordingSid: 'RE1234567890abcdef1234567890abcde',
    };

    it('should emit twilio.transcription event with correct data', async () => {
      await controller.handleTranscription(mockTranscriptionBody);

      expect(eventEmitter.emit).toHaveBeenCalledWith('twilio.transcription', {
        callSid: 'CA1234567890abcdef1234567890abcde',
        transcriptionText: 'Olá, tudo bem? Eu gostaria de saber mais sobre seu produto.',
        transcriptionSid: 'TR1234567890abcdef1234567890abcde',
        recordingSid: 'RE1234567890abcdef1234567890abcde',
      });
    });

    it('should return received: true response', async () => {
      const result = await controller.handleTranscription(mockTranscriptionBody);

      expect(result).toEqual({ received: true });
    });

    it('should handle missing transcription text', async () => {
      const bodyWithoutText = {
        ...mockTranscriptionBody,
        TranscriptionText: undefined,
      };

      await controller.handleTranscription(bodyWithoutText);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'twilio.transcription',
        expect.objectContaining({
          transcriptionText: undefined,
        }),
      );
    });

    it('should include all transcription fields in event', async () => {
      await controller.handleTranscription(mockTranscriptionBody);

      const emittedCall = (eventEmitter.emit as jest.Mock).mock.calls[0];
      const eventData = emittedCall[1];

      expect(eventData).toHaveProperty('callSid');
      expect(eventData).toHaveProperty('transcriptionText');
      expect(eventData).toHaveProperty('transcriptionSid');
      expect(eventData).toHaveProperty('recordingSid');
    });
  });

  // ─────────────────────────────────────────
  // POST /webhooks/twilio/recording
  // ─────────────────────────────────────────

  describe('handleRecording', () => {
    const mockRecordingBody = {
      CallSid: 'CA1234567890abcdef1234567890abcde',
      RecordingSid: 'RE1234567890abcdef1234567890abcde',
      RecordingUrl: 'https://api.twilio.com/recording.mp3',
      RecordingDuration: '120',
    };

    it('should emit twilio.recording event with correct data', async () => {
      await controller.handleRecording(mockRecordingBody);

      expect(eventEmitter.emit).toHaveBeenCalledWith('twilio.recording', {
        callSid: 'CA1234567890abcdef1234567890abcde',
        recordingSid: 'RE1234567890abcdef1234567890abcde',
        recordingUrl: 'https://api.twilio.com/recording.mp3',
        duration: '120',
      });
    });

    it('should return received: true response', async () => {
      const result = await controller.handleRecording(mockRecordingBody);

      expect(result).toEqual({ received: true });
    });

    it('should handle missing RecordingUrl gracefully', async () => {
      const bodyWithoutUrl = {
        ...mockRecordingBody,
        RecordingUrl: undefined,
      };

      await controller.handleRecording(bodyWithoutUrl);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'twilio.recording',
        expect.objectContaining({
          recordingUrl: undefined,
        }),
      );
    });

    it('should emit event with duration field', async () => {
      await controller.handleRecording(mockRecordingBody);

      const emittedCall = (eventEmitter.emit as jest.Mock).mock.calls[0];
      const eventData = emittedCall[1];

      expect(eventData.duration).toBe('120');
    });

    it('should handle various duration values', async () => {
      const durations = ['30', '3600', '0'];

      for (const duration of durations) {
        jest.clearAllMocks();
        await controller.handleRecording({
          ...mockRecordingBody,
          RecordingDuration: duration,
        });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'twilio.recording',
          expect.objectContaining({ duration }),
        );
      }
    });
  });

  // ─────────────────────────────────────────
  // Cross-endpoint tests
  // ─────────────────────────────────────────

  describe('all endpoints', () => {
    it('should always emit events to EventEmitter2', async () => {
      const voiceBody = { CallSid: 'CA123' };
      const statusBody = { CallSid: 'CA123', CallStatus: 'completed' };
      const transcriptionBody = { CallSid: 'CA123', TranscriptionText: 'test' };
      const recordingBody = { CallSid: 'CA123', RecordingSid: 'RE123' };

      await controller.handleVoiceWebhook(voiceBody, 'sig');
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      await controller.handleStatusCallback(statusBody);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      await controller.handleTranscription(transcriptionBody);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      await controller.handleRecording(recordingBody);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('should not throw errors on undefined bodies', async () => {
      expect(async () => await controller.handleVoiceWebhook({}, 'sig')).not.toThrow();
      expect(async () => await controller.handleStatusCallback({})).not.toThrow();
      expect(async () => await controller.handleTranscription({})).not.toThrow();
      expect(async () => await controller.handleRecording({})).not.toThrow();
    });
  });
});
