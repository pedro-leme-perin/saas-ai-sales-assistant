// =====================================================
// 🌐 NOTIFICATIONS GATEWAY - CORRECTED VERSION
// =====================================================
// WebSocket Gateway with Redis Adapter for horizontal scaling
// Based on: System Design Interview - Chapter 12 (Chat System)
//
// Architecture:
// - Socket.io for WebSocket communication
// - Redis Pub/Sub for multi-instance sync
// - Room-based architecture (user rooms, company rooms)
// - Tenant isolation via handshake authentication
//
// Scaling pattern:
// Instance 1 → Redis Pub/Sub ← Instance 2
//     ↓                           ↓
//  User A                      User B
// =====================================================

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
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// =====================================================
// AUTHENTICATED SOCKET TYPE
// =====================================================
// Extended Socket type with user authentication data
interface AuthenticatedSocket extends Socket {
  userId?: string;
  companyId?: string;
}

// =====================================================
// GATEWAY CONFIGURATION
// =====================================================
@WebSocketGateway({
  // ✅ CORS from environment variable (not hardcoded)
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/ws', // Namespace for organization
  transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  
  // ✅ Track connected users per userId (for disconnect cleanup)
  private connectedUsers = new Map<string, Set<string>>();

  constructor(private readonly configService: ConfigService) {}

  // =====================================================
  // LIFECYCLE: AFTER INIT
  // =====================================================
  // Initialize Redis Adapter for horizontal scaling
  // (System Design Interview - Chapter 12: Scalability)
  async afterInit(server: Server) {
    // ✅ Redis Adapter for multi-instance WebSocket sync
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      try {
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        server.adapter(createAdapter(pubClient, subClient));
        
        this.logger.log('✅ Redis Adapter initialized - WebSocket can scale horizontally');
      } catch (error) {
        this.logger.error('❌ Redis Adapter failed - falling back to memory adapter');
        this.logger.error(error);
        // Continue without Redis (single instance only)
      }
    } else {
      this.logger.warn('⚠️ No REDIS_URL - using memory adapter (single instance only)');
    }

    this.logger.log('🚀 WebSocket Gateway initialized');
  }

  // =====================================================
  // LIFECYCLE: CLIENT CONNECTION
  // =====================================================
  // Handle new client connections with authentication
  // (Release It! - Stability Patterns: Validate inputs)
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // ✅ Extract authentication from handshake
      const userId = client.handshake.auth?.userId;
      const companyId = client.handshake.auth?.companyId;

      // ✅ Validate authentication (tenant isolation)
      if (!userId || !companyId) {
        this.logger.warn(`❌ Unauthorized connection attempt: ${client.id}`);
        client.disconnect();
        return;
      }

      // ✅ Attach user data to socket (for future use)
      client.userId = userId;
      client.companyId = companyId;

      // ✅ Track connected sockets per user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      // ✅ Join user-specific room (for targeted messages)
      await client.join(`user:${userId}`);
      
      // ✅ Join company-wide room (for broadcasts)
      await client.join(`company:${companyId}`);

      this.logger.log(
        `✅ Client connected: ${client.id} (User: ${userId}, Company: ${companyId})`,
      );
    } catch (error) {
      this.logger.error('Error handling connection:', error);
      client.disconnect();
    }
  }

  // =====================================================
  // LIFECYCLE: CLIENT DISCONNECTION
  // =====================================================
  // Clean up when client disconnects
  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;

    if (userId) {
      // ✅ Remove socket from tracked connections
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        
        // ✅ Remove user entry if no more sockets
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
    }

    this.logger.log(`👋 Client disconnected: ${client.id}`);
  }

  // =====================================================
  // EVENT: JOIN CALL ROOM
  // =====================================================
  // Allow user to join a specific call room for call-specific updates
  @SubscribeMessage('join:call')
  handleJoinCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { callId: string },
  ) {
    client.join(`call:${data.callId}`);
    this.logger.log(`User ${client.userId} joined call room: ${data.callId}`);
    return { success: true };
  }

  // =====================================================
  // EVENT: JOIN CHAT ROOM
  // =====================================================
  // Allow user to join a specific WhatsApp chat room
  @SubscribeMessage('join:chat')
  handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    client.join(`chat:${data.chatId}`);
    this.logger.log(`User ${client.userId} joined chat room: ${data.chatId}`);
    return { success: true };
  }

  // =====================================================
  // EVENT: PING (HEALTH CHECK)
  // =====================================================
  // Simple ping/pong for connection health monitoring
  @SubscribeMessage('ping')
  handlePing() {
    return { pong: true, timestamp: new Date() };
  }

  // =====================================================
  // PUBLIC METHODS (CALLED BY SERVICES)
  // =====================================================

  // Send AI suggestion to specific user
  sendAISuggestion(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('ai:suggestion', payload);
  }

  // Send call status update to specific user
  sendCallStatusUpdate(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('call:status', payload);
  }

  // Send WhatsApp message notification to specific user
  sendWhatsAppMessage(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('whatsapp:message', payload);
  }

  // Send generic notification to specific user
  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  // Broadcast to entire company (e.g., system announcements)
  broadcastToCompany(companyId: string, event: string, payload: any) {
    this.server.to(`company:${companyId}`).emit(event, payload);
  }

  // Check if user is currently connected
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get number of connected sockets for a user
  getUserConnectionCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
}
