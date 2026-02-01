// =====================================================
// 🎮 NOTIFICATIONS CONTROLLER - CORRECTED VERSION
// =====================================================
// REST API endpoints for notification management
// Based on: Clean Architecture - Presentation Layer
//
// Key features:
// - RESTful API design
// - Authentication guards (to be implemented)
// - Tenant isolation via user context
// - Pagination support
// - Swagger documentation
// =====================================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService, CreateNotificationDto } from './notifications.service';
import { PaginationDto } from '@common/dto/pagination.dto';

// =====================================================
// CONTROLLER
// =====================================================

@ApiTags('Notifications')
@ApiBearerAuth() // ✅ Requires authentication
// @UseGuards(AuthGuard, TenantGuard) // TODO: Implement after AuthModule
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // =====================================================
  // CREATE NOTIFICATION
  // =====================================================
  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully' })
  async create(@Body() createDto: CreateNotificationDto, @Request() req: any) {
    // ✅ Extract user context from authenticated request
    // TODO: After AuthModule, req.user will have userId and companyId
    const userId = req.user?.id || createDto.userId;
    const companyId = req.user?.companyId || createDto.companyId;

    return this.notificationsService.create({
      ...createDto,
      userId,
      companyId, // ✅ Tenant isolation
    });
  }

  // =====================================================
  // GET ALL NOTIFICATIONS (PAGINATED)
  // =====================================================
  @Get()
  @ApiOperation({ summary: 'Get all notifications for authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns paginated notifications' })
  async findAll(@Query() pagination: PaginationDto, @Request() req: any) {
    // ✅ Extract user context from authenticated request
    // TODO: After AuthModule, req.user will be properly populated
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.findAll(userId, companyId, pagination);
  }

  // =====================================================
  // GET UNREAD COUNT
  // =====================================================
  @Get('unread/count')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  @ApiResponse({ status: 200, description: 'Returns unread count' })
  async getUnreadCount(@Request() req: any) {
    // ✅ Extract user context
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.getUnreadCount(userId, companyId);
  }

  // =====================================================
  // MARK NOTIFICATION AS READ
  // =====================================================
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    // ✅ Extract user context
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.markAsRead(id, userId, companyId);
  }

  // =====================================================
  // MARK ALL AS READ
  // =====================================================
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Request() req: any) {
    // ✅ Extract user context
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.markAllAsRead(userId, companyId);
  }

  // =====================================================
  // DELETE NOTIFICATION
  // =====================================================
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  async delete(@Param('id') id: string, @Request() req: any) {
    // ✅ Extract user context
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.delete(id, userId, companyId);
  }

  // =====================================================
  // DELETE ALL READ NOTIFICATIONS
  // =====================================================
  @Delete('read/all')
  @ApiOperation({ summary: 'Delete all read notifications' })
  @ApiResponse({ status: 200, description: 'Read notifications deleted' })
  async deleteAllRead(@Request() req: any) {
    // ✅ Extract user context
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.deleteAllRead(userId, companyId);
  }

  // =====================================================
  // GET NOTIFICATION BY ID
  // =====================================================
  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiResponse({ status: 200, description: 'Returns the notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findById(@Param('id') id: string, @Request() req: any) {
    // ✅ Extract user context
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new Error('User not authenticated');
    }

    return this.notificationsService.findById(id, userId, companyId);
  }
}
