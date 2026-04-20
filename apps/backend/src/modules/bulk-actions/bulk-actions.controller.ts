// =============================================
// 📄 BulkActionsController (Session 52)
// =============================================

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CompanyId, Roles, UserId } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { BulkActionsService } from './bulk-actions.service';
import { BulkTagCallsDto } from './dto/bulk-tag-calls.dto';
import { BulkDeleteCallsDto } from './dto/bulk-delete-calls.dto';
import { BulkAssignChatsDto } from './dto/bulk-assign-chats.dto';

@ApiTags('bulk-actions')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('bulk')
export class BulkActionsController {
  constructor(private readonly bulk: BulkActionsService) {}

  @Post('calls/tag')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Enqueue bulk tag attach for calls' })
  async tagCalls(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Body() dto: BulkTagCallsDto,
  ) {
    const job = await this.bulk.enqueueTagCalls(companyId, userId, dto);
    return { jobId: job.id, status: job.status };
  }

  @Post('calls/delete')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enqueue bulk delete of calls' })
  async deleteCalls(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Body() dto: BulkDeleteCallsDto,
  ) {
    const job = await this.bulk.enqueueDeleteCalls(companyId, userId, dto);
    return { jobId: job.id, status: job.status };
  }

  @Post('chats/assign')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Enqueue bulk reassignment of chats' })
  async assignChats(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Body() dto: BulkAssignChatsDto,
  ) {
    const job = await this.bulk.enqueueAssignChats(companyId, userId, dto);
    return { jobId: job.id, status: job.status };
  }
}
