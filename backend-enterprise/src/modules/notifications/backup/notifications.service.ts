// =============================================
// 🔔 NOTIFICATIONS SERVICE
// =============================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { PaginationDto, createPaginatedResult } from '@common/dto/pagination.dto';
import { NotificationType, NotificationChannel } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, companyId: string, pagination: PaginationDto) {
    const where = { userId, companyId };
    
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

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unread: count };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { success: true };
  }

  async create(data: {
    userId: string;
    companyId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    channel?: NotificationChannel;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        companyId: data.companyId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        channel: data.channel || NotificationChannel.IN_APP,
        sentAt: new Date(),
      },
    });
  }
}
