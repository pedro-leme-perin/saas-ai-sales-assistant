// =============================================
// 🚨 SLA Escalation Controller (Session 57 — Feature A2)
// =============================================

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';

import { SlaEscalationService } from './sla-escalation.service';
import {
  CreateSlaEscalationDto,
  UpdateSlaEscalationDto,
} from './dto/upsert-sla-escalation.dto';

@ApiTags('sla-escalations')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('sla-escalations')
export class SlaEscalationController {
  constructor(private readonly service: SlaEscalationService) {}

  @Get()
  @ApiOperation({ summary: 'List SLA escalation tiers (optionally scoped to a policy)' })
  async list(
    @CompanyId() companyId: string,
    @Query('policyId') policyId?: string,
  ) {
    return { data: await this.service.list(companyId, policyId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a SLA escalation tier' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a SLA escalation tier' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSlaEscalationDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a SLA escalation tier' })
  async update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSlaEscalationDto,
  ) {
    return this.service.update(companyId, user.id, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a SLA escalation tier' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(companyId, user.id, id);
  }
}
