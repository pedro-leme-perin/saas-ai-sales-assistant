import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappWebhookController } from '../../src/presentation/webhooks/whatsapp.webhook';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookIdempotencyService } from '../../src/common/resilience/webhook-idempotency.service';

jest.setTimeout(15000);

describe('WhatsappWebhookController', () => {
  let controller: WhatsappWebhookController;
  let configService: ConfigService;
  let eventEmitter: EventEmitter2;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('verify-token-123'),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockWebhookIdempotency = {
    checkAndMark: jest
      .fn()
      .mockResolvedValue({ isDuplicate: false, correlationId: 'wh_whatsapp_test' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappWebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: WebhookIdempotencyService,
          useValue: mockWebhookIdempotency,
        },
      ],
    }).compile();

    controller = module.get<WhatsappWebhookController>(WhatsappWebhookController);
    configService = module.get<ConfigService>(ConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // GET /webhooks/whatsapp (Verification)
  // ─────────────────────────────────────────

  describe('verifyWebhook', () => {
    it('should return challenge when token matches and mode is subscribe', () => {
      const result = controller.verifyWebhook(
        'subscribe',
        'verify-token-123',
        'challenge-string-123',
      );

      expect(result).toBe('challenge-string-123');
      expect(configService.get).toHaveBeenCalledWith('whatsapp.verifyToken');
    });

    it('should return failure message when token does not match', () => {
      const result = controller.verifyWebhook('subscribe', 'wrong-token', 'challenge-string-123');

      expect(result).toBe('Verification failed');
    });

    it('should return failure message when mode is not subscribe', () => {
      const result = controller.verifyWebhook(
        'unsubscribe',
        'verify-token-123',
        'challenge-string-123',
      );

      expect(result).toBe('Verification failed');
    });

    it('should fetch verify token from config service', () => {
      controller.verifyWebhook('subscribe', 'verify-token-123', 'challenge-123');

      expect(configService.get).toHaveBeenCalledWith('whatsapp.verifyToken');
    });

    it('should handle undefined token from config gracefully', () => {
      (configService.get as jest.Mock).mockReturnValueOnce(undefined);

      const result = controller.verifyWebhook('subscribe', 'any-token', 'challenge');

      expect(result).toBe('Verification failed');
    });

    it('should be case-sensitive for token comparison', () => {
      (configService.get as jest.Mock).mockReturnValueOnce('Verify-Token-123');

      const result = controller.verifyWebhook('subscribe', 'verify-token-123', 'challenge');

      expect(result).toBe('Verification failed');
    });
  });

  // ─────────────────────────────────────────
  // POST /webhooks/whatsapp (Message Handler)
  // ─────────────────────────────────────────

  describe('handleWebhook', () => {
    const mockMessageEntry = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    id: 'wamid.abc123',
                    from: '5511999990000',
                    timestamp: '1679000000',
                    type: 'text',
                    text: { body: 'Olá, tudo bem?' },
                  },
                ],
                contacts: [
                  {
                    wa_id: '5511999990000',
                    profile: { name: 'João Silva' },
                  },
                ],
                metadata: { phone_number_id: '120123123' },
              },
            },
          ],
        },
      ],
    };

    it('should emit whatsapp.message.received event for each message', async () => {
      await controller.handleWebhook(mockMessageEntry);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({
          waMessageId: 'wamid.abc123',
          from: '5511999990000',
          type: 'text',
          content: 'Olá, tudo bem?',
          contactName: 'João Silva',
          phoneNumberId: '120123123',
        }),
      );
    });

    it('should convert timestamp from Unix to Date', async () => {
      await controller.handleWebhook(mockMessageEntry);

      const emittedCall = (eventEmitter.emit as jest.Mock).mock.calls[0];
      const eventData = emittedCall[1];
      const timestamp = eventData.timestamp;

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBe(1679000000 * 1000);
    });

    it('should return received: true regardless of processing result', async () => {
      const result = await controller.handleWebhook(mockMessageEntry);

      expect(result).toEqual({ received: true });
    });

    it('should handle multiple messages in single webhook', async () => {
      const bodyWithMultipleMessages = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      id: 'msg1',
                      from: '5511999990000',
                      timestamp: '1679000000',
                      type: 'text',
                      text: { body: 'First message' },
                    },
                    {
                      id: 'msg2',
                      from: '5511999990000',
                      timestamp: '1679000001',
                      type: 'text',
                      text: { body: 'Second message' },
                    },
                  ],
                  contacts: [{ wa_id: '5511999990000', profile: { name: 'User' } }],
                  metadata: { phone_number_id: '120123123' },
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(bodyWithMultipleMessages);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        1,
        'whatsapp.message.received',
        expect.objectContaining({ content: 'First message' }),
      );
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        2,
        'whatsapp.message.received',
        expect.objectContaining({ content: 'Second message' }),
      );
    });

    it('should handle status updates', async () => {
      const bodyWithStatus = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  statuses: [
                    {
                      id: 'wamid.xyz789',
                      status: 'delivered',
                      timestamp: '1679000005',
                      recipient_id: '5511999990000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(bodyWithStatus);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.status',
        expect.objectContaining({
          waMessageId: 'wamid.xyz789',
          status: 'delivered',
          recipientId: '5511999990000',
        }),
      );
    });

    it('should handle empty entries gracefully', async () => {
      const emptyBody = { entry: [] };

      const result = await controller.handleWebhook(emptyBody);

      expect(result).toEqual({ received: true });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle empty changes gracefully', async () => {
      const bodyWithEmptyChanges = {
        entry: [
          {
            changes: [],
          },
        ],
      };

      const result = await controller.handleWebhook(bodyWithEmptyChanges);

      expect(result).toEqual({ received: true });
    });

    it('should handle missing messages array', async () => {
      const bodyWithoutMessages = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      const result = await controller.handleWebhook(bodyWithoutMessages);

      expect(result).toEqual({ received: true });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should skip non-message field changes', async () => {
      const bodyWithDifferentField = {
        entry: [
          {
            changes: [
              {
                field: 'account_alerts',
                value: {},
              },
            ],
          },
        ],
      };

      const result = await controller.handleWebhook(bodyWithDifferentField);

      expect(result).toEqual({ received: true });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should continue processing after error', async () => {
      (eventEmitter.emit as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Emit failed');
      });

      const result = await controller.handleWebhook(mockMessageEntry);

      expect(result).toEqual({ received: true });
    });

    it('should always return 200 on error', async () => {
      const malformedBody = null;

      const result = await controller.handleWebhook(malformedBody);

      expect(result).toEqual({ received: true });
    });
  });

  // ─────────────────────────────────────────
  // Content Extraction Tests
  // ─────────────────────────────────────────

  describe('extractContent (private method)', () => {
    const createMessage = (type: string, content: unknown) => ({
      id: 'msg-123',
      from: '5511999990000',
      timestamp: '1679000000',
      type,
      ...content,
    });

    it('should extract text message content', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('text', { text: { body: 'Hello world' } })],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: 'Hello world' }),
      );
    });

    it('should extract image message with caption', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('image', { image: { caption: 'My photo' } })],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Image: My photo]' }),
      );
    });

    it('should extract image message without caption', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('image', { image: {} })],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Image: No caption]' }),
      );
    });

    it('should extract audio message', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('audio', { audio: {} })],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Audio message]' }),
      );
    });

    it('should extract video message with caption', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('video', { video: { caption: 'My video' } })],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Video: My video]' }),
      );
    });

    it('should extract document message with filename', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    createMessage('document', {
                      document: { filename: 'report.pdf' },
                    }),
                  ],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Document: report.pdf]' }),
      );
    });

    it('should extract location message', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    createMessage('location', {
                      location: { latitude: -23.5505, longitude: -46.6333 },
                    }),
                  ],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({
          content: '[Location: -23.5505, -46.6333]',
        }),
      );
    });

    it('should extract sticker message', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('sticker', {})],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Sticker]' }),
      );
    });

    it('should extract contacts message', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('contacts', {})],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[Contact shared]' }),
      );
    });

    it('should extract unknown message type', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [createMessage('unknown_type', {})],
                  contacts: [],
                  metadata: {},
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'whatsapp.message.received',
        expect.objectContaining({ content: '[unknown_type]' }),
      );
    });
  });

  // ─────────────────────────────────────────
  // Integration Tests
  // ─────────────────────────────────────────

  describe('complete flow', () => {
    it('should handle webhook with messages and status updates together', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      id: 'msg123',
                      from: '5511999990000',
                      timestamp: '1679000000',
                      type: 'text',
                      text: { body: 'Test message' },
                    },
                  ],
                  contacts: [
                    {
                      wa_id: '5511999990000',
                      profile: { name: 'Test User' },
                    },
                  ],
                  statuses: [
                    {
                      id: 'msg456',
                      status: 'read',
                      timestamp: '1679000001',
                      recipient_id: '5511999990000',
                    },
                  ],
                  metadata: { phone_number_id: '120123123' },
                },
              },
            ],
          },
        ],
      };

      await controller.handleWebhook(body);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        1,
        'whatsapp.message.received',
        expect.any(Object),
      );
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        2,
        'whatsapp.message.status',
        expect.any(Object),
      );
    });
  });
});
