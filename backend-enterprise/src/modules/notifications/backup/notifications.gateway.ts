import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  companyId?: string;
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, Set<string>>();

  afterInit() {
    this.logger.log('🔌 WebSocket Gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket) {
    const userId = client.handshake.auth?.userId;
    const companyId = client.handshake.auth?.companyId;

    if (!userId || !companyId) {
      this.logger.warn(`Unauthorized connection: ${client.id}`);
      client.disconnect();
      return;
    }

    client.userId = userId;
    client.companyId = companyId;

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(client.id);

    client.join(`user:${userId}`);
    client.join(`company:${companyId}`);

    this.logger.log(`✅ Client connected: ${client.id} (User: ${userId})`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    if (userId) {
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
    }
    this.logger.log(`❌ Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:call')
  handleJoinCall(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    client.join(`call:${data.callId}`);
    return { success: true };
  }

  @SubscribeMessage('join:chat')
  handleJoinChat(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: string }) {
    client.join(`chat:${data.chatId}`);
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { pong: true, timestamp: new Date() };
  }

  sendAISuggestion(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('ai:suggestion', payload);
  }

  sendCallStatusUpdate(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('call:status', payload);
  }

  sendWhatsAppMessage(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('whatsapp:message', payload);
  }

  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
