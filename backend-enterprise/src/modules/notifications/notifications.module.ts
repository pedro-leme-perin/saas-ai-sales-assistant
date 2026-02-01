// =====================================================
// 🔔 NOTIFICATIONS MODULE - CORRECTED VERSION
// =====================================================
// Real-time notifications via WebSocket (Socket.io)
// Based on: System Design Interview - Chapter 12 (Chat System)
//
// Key features:
// - WebSocket Gateway for real-time communication
// - Redis Adapter for horizontal scaling
// - Tenant isolation (companyId)
// - Multiple notification channels (IN_APP, EMAIL, SMS, PUSH)
// =====================================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    ConfigModule, // ✅ Import ConfigModule for environment variables
  ],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsGateway, NotificationsService], // ✅ Export for use in other modules
})
export class NotificationsModule {}
