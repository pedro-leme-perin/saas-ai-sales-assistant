// =====================================================
// 📬 NOTIFICATIONS SERVICE - CORRECTED VERSION
// =====================================================
// Business logic for notification management
// Based on: Clean Architecture - Application Layer
//
// Key principles:
// - Strong tenant isolation (ALWAYS filter by companyId)
// - Repository pattern (Prisma)
// - Pagination support
// - Type safety
//
// CRITICAL: Every query MUST include companyId filter!
// (Designing Data-Intensive Applications - Multi-tenancy)
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { PaginationDto, createPaginatedResult } from '@common/dto/pagination.dto';
import { NotificationType, NotificationChannel } from '@prisma/client';

// =====================================================
// DTOs
// =====================================================

export interface CreateNotificationDto {
  userId: string;
  companyId: string; // ✅ REQUIRED for tenant isolation
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  channel?: NotificationChannel;
}

export interface UpdateNotificationDto {
  read?: boolean;
  readAt?: Date;
}

// =====================================================
// SERVICE
// =====================================================

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // CREATE NOTIFICATION
  // =====================================================
  // Creates a new notification with tenant isolation
  async create(data: CreateNotificationDto) {
    // ✅ Validate tenant context exists
    if (!data.companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        companyId: data.companyId, // ✅ Always store tenant context
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        channel: data.channel || NotificationChannel.IN_APP,
        sentAt: new Date(),
      },
    });
  }

  // =====================================================
  // FIND ALL (WITH PAGINATION & TENANT ISOLATION)
  // =====================================================
  // Get all notifications for a user within their company
  // CRITICAL: Both userId AND companyId required for security
  async findAll(
    userId: string,
    companyId: string, // ✅ REQUIRED - tenant isolation
    pagination: PaginationDto,
  ) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    // ✅ Build where clause with BOTH userId and companyId
    // This prevents cross-tenant data leakage
    const where = {
      userId,
      companyId, // ✅ CRITICAL: Tenant isolation filter
    };

    // Execute queries in parallel for performance
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return createPaginatedResult(notifications, total, pagination.page!, pagination.limit!);
  }

  // =====================================================
  // GET UNREAD COUNT
  // =====================================================
  // Count unread notifications for a user (with tenant isolation)
  async getUnreadCount(userId: string, companyId: string) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    const count = await this.prisma.notification.count({
      where: {
        userId,
        companyId, // ✅ Tenant isolation
        read: false,
      },
    });

    return { unread: count };
  }

  // =====================================================
  // MARK AS READ (SINGLE)
  // =====================================================
  // Mark a single notification as read (with tenant validation)
  async markAsRead(id: string, userId: string, companyId: string) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    // ✅ Find notification with tenant isolation
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId, // ✅ User owns this notification
        companyId, // ✅ Notification belongs to user's company
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Update notification
    return this.prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  // =====================================================
  // MARK ALL AS READ
  // =====================================================
  // Mark all notifications as read for a user (with tenant isolation)
  async markAllAsRead(userId: string, companyId: string) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    await this.prisma.notification.updateMany({
      where: {
        userId,
        companyId, // ✅ Tenant isolation
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  // =====================================================
  // DELETE NOTIFICATION
  // =====================================================
  // Delete a notification (with tenant validation)
  async delete(id: string, userId: string, companyId: string) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    // ✅ Find notification with tenant isolation
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId,
        companyId, // ✅ Tenant isolation
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { success: true };
  }

  // =====================================================
  // DELETE ALL READ NOTIFICATIONS
  // =====================================================
  // Bulk delete read notifications (with tenant isolation)
  async deleteAllRead(userId: string, companyId: string) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    const result = await this.prisma.notification.deleteMany({
      where: {
        userId,
        companyId, // ✅ Tenant isolation
        read: true,
      },
    });

    return { deleted: result.count };
  }

  // =====================================================
  // FIND BY ID (WITH TENANT VALIDATION)
  // =====================================================
  // Get a single notification by ID (with tenant validation)
  async findById(id: string, userId: string, companyId: string) {
    // ✅ Validate tenant context
    if (!companyId) {
      throw new Error('companyId is required for tenant isolation');
    }

    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId,
        companyId, // ✅ Tenant isolation
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }
}
