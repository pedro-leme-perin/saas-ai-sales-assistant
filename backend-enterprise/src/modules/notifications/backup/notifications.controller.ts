// =============================================
// 🔔 NOTIFICATIONS CONTROLLER
// =============================================

import { Controller, Get, Post, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CompanyId, UserId } from '@common/decorators';
import { PaginationDto } from '@common/dto/pagination.dto';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async findAll(
    @UserId() userId: string,
    @CompanyId() companyId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.notificationsService.findAll(userId, companyId, pagination);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@UserId() userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @UserId() userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@UserId() userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
