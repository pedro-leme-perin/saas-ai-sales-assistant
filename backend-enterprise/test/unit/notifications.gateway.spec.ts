import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway';
import { Server, Socket } from 'socket.io';

jest.setTimeout(15000);

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let server: jest.Mocked<Server>;
  let client: jest.Mocked<Socket>;

  // Mock data
  const mockUserId = 'user-123';
  const mockCompanyId = 'company-456';
  const mockClientId = 'socket-789';
  const mockCallId = 'call-001';
  const mockChatId = 'chat-002';

  const createMockSocket = (): jest.Mocked<Socket> => {
    return {
      id: mockClientId,
      userId: undefined,
      companyId: undefined,
      handshake: {
        auth: {
          userId: mockUserId,
          companyId: mockCompanyId,
        },
        headers: {},
        query: {},
        time: new Date().toISOString(),
        url: '/ws',
        address: '127.0.0.1',
        xdomain: false,
        secure: false,
        issued: Date.now(),
        cookie: [],
      },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;
  };

  const createMockServer = (): jest.Mocked<Server> => {
    return {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
      emit: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    server = createMockServer();
    client = createMockSocket();

    // Assign the mocked server to the gateway
    gateway.server = server;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  // =====================================================
  // AFTER INIT TESTS
  // =====================================================

  describe('afterInit', () => {
    it('should initialize the gateway successfully', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.afterInit();

      expect(logSpy).toHaveBeenCalledWith('🚀 WebSocket Gateway initialized');
    });
  });

  // =====================================================
  // CONNECTION TESTS
  // =====================================================

  describe('handleConnection', () => {
    it('should reject client without userId in auth', async () => {
      const invalidClient = createMockSocket();
      invalidClient.handshake.auth = { companyId: mockCompanyId };

      const warnSpy = jest.spyOn(gateway['logger'], 'warn');

      await gateway.handleConnection(invalidClient);

      expect(warnSpy).toHaveBeenCalled();
      expect(invalidClient.disconnect).toHaveBeenCalled();
      expect(invalidClient.join).not.toHaveBeenCalled();
    });

    it('should reject client without companyId in auth', async () => {
      const invalidClient = createMockSocket();
      invalidClient.handshake.auth = { userId: mockUserId };

      const warnSpy = jest.spyOn(gateway['logger'], 'warn');

      await gateway.handleConnection(invalidClient);

      expect(warnSpy).toHaveBeenCalled();
      expect(invalidClient.disconnect).toHaveBeenCalled();
    });

    it('should accept valid client and join user room', async () => {
      await gateway.handleConnection(client);

      expect(client.userId).toBe(mockUserId);
      expect(client.companyId).toBe(mockCompanyId);
      expect(client.join).toHaveBeenCalledWith(`user:${mockUserId}`);
    });

    it('should accept valid client and join company room', async () => {
      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith(`company:${mockCompanyId}`);
    });

    it('should track connected socket in connectedUsers map', async () => {
      await gateway.handleConnection(client);

      const connectedCount = gateway.getUserConnectionCount(mockUserId);
      expect(connectedCount).toBe(1);
    });

    it('should handle multiple connections from same user', async () => {
      const client2 = createMockSocket();
      client2.id = 'socket-999';

      await gateway.handleConnection(client);
      await gateway.handleConnection(client2);

      const connectedCount = gateway.getUserConnectionCount(mockUserId);
      expect(connectedCount).toBe(2);
    });

    it('should disconnect client on error during connection', async () => {
      const errorClient = createMockSocket();
      errorClient.join = jest.fn().mockRejectedValue(new Error('Join failed'));

      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      await gateway.handleConnection(errorClient);

      expect(errorSpy).toHaveBeenCalled();
      expect(errorClient.disconnect).toHaveBeenCalled();
    });
  });

  // =====================================================
  // DISCONNECTION TESTS
  // =====================================================

  describe('handleDisconnect', () => {
    it('should remove socket from connectedUsers on disconnect', async () => {
      await gateway.handleConnection(client);
      expect(gateway.getUserConnectionCount(mockUserId)).toBe(1);

      gateway.handleDisconnect(client);

      expect(gateway.getUserConnectionCount(mockUserId)).toBe(0);
    });

    it('should delete user entry when no more sockets', async () => {
      await gateway.handleConnection(client);

      gateway.handleDisconnect(client);

      expect(gateway.isUserConnected(mockUserId)).toBe(false);
    });

    it('should handle disconnect of client without userId', () => {
      const invalidClient = createMockSocket();
      invalidClient.userId = undefined;

      expect(() => {
        gateway.handleDisconnect(invalidClient);
      }).not.toThrow();
    });

    it('should log disconnection event', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleDisconnect(client);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('disconnected'));
    });

    it('should keep other sockets when one disconnects', async () => {
      const client2 = createMockSocket();
      client2.id = 'socket-999';

      await gateway.handleConnection(client);
      await gateway.handleConnection(client2);

      gateway.handleDisconnect(client);

      expect(gateway.getUserConnectionCount(mockUserId)).toBe(1);
      expect(gateway.isUserConnected(mockUserId)).toBe(true);
    });
  });

  // =====================================================
  // JOIN CALL TESTS
  // =====================================================

  describe('handleJoinCall', () => {
    it('should join call room successfully', () => {
      const response = gateway.handleJoinCall(client, { callId: mockCallId });

      expect(client.join).toHaveBeenCalledWith(`call:${mockCallId}`);
      expect(response).toEqual({ success: true });
    });

    it('should log join call event', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleJoinCall(client, { callId: mockCallId });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`joined call room: ${mockCallId}`),
      );
    });

    it('should handle multiple call rooms', () => {
      gateway.handleJoinCall(client, { callId: mockCallId });
      gateway.handleJoinCall(client, { callId: 'call-002' });

      expect(client.join).toHaveBeenCalledTimes(2);
      expect(client.join).toHaveBeenCalledWith(`call:${mockCallId}`);
      expect(client.join).toHaveBeenCalledWith(`call:call-002`);
    });
  });

  // =====================================================
  // JOIN CHAT TESTS
  // =====================================================

  describe('handleJoinChat', () => {
    it('should join chat room successfully', () => {
      const response = gateway.handleJoinChat(client, { chatId: mockChatId });

      expect(client.join).toHaveBeenCalledWith(`chat:${mockChatId}`);
      expect(response).toEqual({ success: true });
    });

    it('should log join chat event', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleJoinChat(client, { chatId: mockChatId });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`joined chat room: ${mockChatId}`),
      );
    });

    it('should handle multiple chat rooms', () => {
      gateway.handleJoinChat(client, { chatId: mockChatId });
      gateway.handleJoinChat(client, { chatId: 'chat-003' });

      expect(client.join).toHaveBeenCalledTimes(2);
      expect(client.join).toHaveBeenCalledWith(`chat:${mockChatId}`);
      expect(client.join).toHaveBeenCalledWith(`chat:chat-003`);
    });
  });

  // =====================================================
  // PING TESTS
  // =====================================================

  describe('handlePing', () => {
    it('should return pong response', () => {
      const response = gateway.handlePing();

      expect(response).toHaveProperty('pong', true);
      expect(response).toHaveProperty('timestamp');
    });

    it('should return valid timestamp', () => {
      const response = gateway.handlePing();

      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  // =====================================================
  // SEND AI SUGGESTION TESTS
  // =====================================================

  describe('sendAISuggestion', () => {
    it('should emit ai:suggestion to user room', () => {
      const payload = { suggestion: 'test suggestion', confidence: 0.95 };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendAISuggestion(mockUserId, payload);

      expect(server.to).toHaveBeenCalledWith(`user:${mockUserId}`);
      expect(mockEmit).toHaveBeenCalledWith('ai:suggestion', payload);
    });

    it('should log emission of ai suggestion', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');
      const payload = { suggestion: 'test' };

      gateway.sendAISuggestion(mockUserId, payload);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ai:suggestion'));
    });

    it('should handle complex payload', () => {
      const complexPayload = {
        suggestion: 'Follow up tomorrow',
        confidence: 0.87,
        context: { callId: mockCallId, duration: 300 },
        tags: ['urgent', 'sales'],
      };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendAISuggestion(mockUserId, complexPayload);

      expect(mockEmit).toHaveBeenCalledWith('ai:suggestion', complexPayload);
    });
  });

  // =====================================================
  // SEND CALL STATUS UPDATE TESTS
  // =====================================================

  describe('sendCallStatusUpdate', () => {
    it('should emit call:status to user room', () => {
      const payload = { status: 'COMPLETED', duration: 300 };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendCallStatusUpdate(mockUserId, payload);

      expect(server.to).toHaveBeenCalledWith(`user:${mockUserId}`);
      expect(mockEmit).toHaveBeenCalledWith('call:status', payload);
    });

    it('should handle call ended status', () => {
      const payload = { status: 'COMPLETED', duration: 600 };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendCallStatusUpdate(mockUserId, payload);

      expect(mockEmit).toHaveBeenCalledWith('call:status', payload);
    });
  });

  // =====================================================
  // SEND WHATSAPP MESSAGE TESTS
  // =====================================================

  describe('sendWhatsAppMessage', () => {
    it('should emit whatsapp:message to user room', () => {
      const payload = { chatId: mockChatId, message: 'Hello', timestamp: new Date() };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendWhatsAppMessage(mockUserId, payload);

      expect(server.to).toHaveBeenCalledWith(`user:${mockUserId}`);
      expect(mockEmit).toHaveBeenCalledWith('whatsapp:message', payload);
    });

    it('should handle WhatsApp message with AI suggestion', () => {
      const payload = {
        chatId: mockChatId,
        message: 'How much?',
        aiSuggestion: 'Provide pricing information',
      };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendWhatsAppMessage(mockUserId, payload);

      expect(mockEmit).toHaveBeenCalledWith('whatsapp:message', payload);
    });
  });

  // =====================================================
  // SEND NOTIFICATION TESTS
  // =====================================================

  describe('sendNotification', () => {
    it('should emit notification to user room', () => {
      const notification = { title: 'Test', message: 'Test notification' };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendNotification(mockUserId, notification);

      expect(server.to).toHaveBeenCalledWith(`user:${mockUserId}`);
      expect(mockEmit).toHaveBeenCalledWith('notification', notification);
    });

    it('should handle notification with custom data', () => {
      const notification = {
        title: 'Call Summary',
        message: 'Your call has been analyzed',
        data: { callId: mockCallId, sentiment: 'positive' },
      };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.sendNotification(mockUserId, notification);

      expect(mockEmit).toHaveBeenCalledWith('notification', notification);
    });
  });

  // =====================================================
  // BROADCAST TO COMPANY TESTS
  // =====================================================

  describe('broadcastToCompany', () => {
    it('should emit event to company room', () => {
      const payload = { announcement: 'System maintenance', time: '22:00' };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.broadcastToCompany(mockCompanyId, 'system:announcement', payload);

      expect(server.to).toHaveBeenCalledWith(`company:${mockCompanyId}`);
      expect(mockEmit).toHaveBeenCalledWith('system:announcement', payload);
    });

    it('should handle company-wide alerts', () => {
      const payload = { alert: 'high traffic detected', severity: 'warning' };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      gateway.broadcastToCompany(mockCompanyId, 'company:alert', payload);

      expect(mockEmit).toHaveBeenCalledWith('company:alert', payload);
    });

    it('should isolate broadcasts to correct company', () => {
      const payload = { message: 'test' };
      const mockEmit = jest.fn();
      server.to = jest.fn().mockReturnValue({ emit: mockEmit });

      const company2Id = 'company-789';
      gateway.broadcastToCompany(mockCompanyId, 'event', payload);
      gateway.broadcastToCompany(company2Id, 'event', payload);

      expect(server.to).toHaveBeenNthCalledWith(1, `company:${mockCompanyId}`);
      expect(server.to).toHaveBeenNthCalledWith(2, `company:${company2Id}`);
    });
  });

  // =====================================================
  // IS USER CONNECTED TESTS
  // =====================================================

  describe('isUserConnected', () => {
    it('should return true when user is connected', async () => {
      await gateway.handleConnection(client);

      expect(gateway.isUserConnected(mockUserId)).toBe(true);
    });

    it('should return false when user is not connected', () => {
      expect(gateway.isUserConnected('unknown-user')).toBe(false);
    });

    it('should return false after user disconnects', async () => {
      await gateway.handleConnection(client);
      gateway.handleDisconnect(client);

      expect(gateway.isUserConnected(mockUserId)).toBe(false);
    });

    it('should return true if user has multiple connections', async () => {
      const client2 = createMockSocket();
      client2.id = 'socket-999';

      await gateway.handleConnection(client);
      await gateway.handleConnection(client2);

      expect(gateway.isUserConnected(mockUserId)).toBe(true);
    });
  });

  // =====================================================
  // GET USER CONNECTION COUNT TESTS
  // =====================================================

  describe('getUserConnectionCount', () => {
    it('should return 0 for unconnected user', () => {
      const count = gateway.getUserConnectionCount('unknown-user');

      expect(count).toBe(0);
    });

    it('should return 1 for user with single connection', async () => {
      await gateway.handleConnection(client);

      const count = gateway.getUserConnectionCount(mockUserId);
      expect(count).toBe(1);
    });

    it('should return correct count for multiple connections', async () => {
      const client2 = createMockSocket();
      client2.id = 'socket-999';

      const client3 = createMockSocket();
      client3.id = 'socket-888';

      await gateway.handleConnection(client);
      await gateway.handleConnection(client2);
      await gateway.handleConnection(client3);

      const count = gateway.getUserConnectionCount(mockUserId);
      expect(count).toBe(3);
    });

    it('should decrease count after disconnection', async () => {
      const client2 = createMockSocket();
      client2.id = 'socket-999';

      await gateway.handleConnection(client);
      await gateway.handleConnection(client2);

      expect(gateway.getUserConnectionCount(mockUserId)).toBe(2);

      gateway.handleDisconnect(client);

      expect(gateway.getUserConnectionCount(mockUserId)).toBe(1);
    });

    it('should return 0 after all disconnections', async () => {
      const client2 = createMockSocket();
      client2.id = 'socket-999';

      await gateway.handleConnection(client);
      await gateway.handleConnection(client2);

      gateway.handleDisconnect(client);
      gateway.handleDisconnect(client2);

      expect(gateway.getUserConnectionCount(mockUserId)).toBe(0);
    });
  });

  // =====================================================
  // MULTI-ROOM INTEGRATION TESTS
  // =====================================================

  describe('Multi-room Integration', () => {
    it('should handle user joining call and chat rooms', () => {
      gateway.handleJoinCall(client, { callId: mockCallId });
      gateway.handleJoinChat(client, { chatId: mockChatId });

      expect(client.join).toHaveBeenCalledWith(`call:${mockCallId}`);
      expect(client.join).toHaveBeenCalledWith(`chat:${mockChatId}`);
    });

    it('should track user in multiple rooms independently', async () => {
      await gateway.handleConnection(client);
      gateway.handleJoinCall(client, { callId: mockCallId });
      gateway.handleJoinChat(client, { chatId: mockChatId });

      // User should still be tracked in connectedUsers
      expect(gateway.isUserConnected(mockUserId)).toBe(true);
      expect(gateway.getUserConnectionCount(mockUserId)).toBe(1);
    });
  });
});
