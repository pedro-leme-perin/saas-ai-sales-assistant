// =============================================
// 📅 SCHEDULED MESSAGES CONTROLLER (Session 56)
// =============================================

import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScheduledMessageStatus, UserRole } from '@prisma/client';

import { CompanyId, Roles, UserId } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { CreateScheduledMessageDto } from './dto/create-scheduled-message.dto';
import { ScheduledMessagesService } from './scheduled-messages.service';

@ApiTags('scheduled-messages')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller()
export class ScheduledMessagesController {
  constructor(private readonly service: ScheduledMessagesService) {}

  @Post('whatsapp/chats/:chatId/schedule')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Schedule a WhatsApp outbound message' })
  async schedule(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Param('chatId') chatId: string,
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.service.schedule(companyId, userId, chatId, dto);
  }

  @Get('scheduled-messages')
  @ApiOperation({ summary: 'List scheduled messages' })
  async list(
    @CompanyId() companyId: string,
    @Query('chatId') chatId?: string,
    @Query('status') status?: ScheduledMessageStatus,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(companyId, {
      chatId,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('scheduled-messages/:id')
  @ApiOperation({ summary: 'Get scheduled message' })
  async findById(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.service.findById(companyId, id);
  }

  @Delete('scheduled-messages/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Cancel a pending scheduled message' })
  async cancel(@CompanyId() companyId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.service.cancel(companyId, userId, id);
  }
}
