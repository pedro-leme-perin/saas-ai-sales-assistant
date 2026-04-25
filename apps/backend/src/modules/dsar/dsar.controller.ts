// =============================================
// 🛡️ DsarController (S60a)
// =============================================
// HTTP entry-points for the LGPD Art. 18 (DSAR) workflow.
// All endpoints tenant-scoped (TenantGuard) + role-gated (RolesGuard).
// Per-endpoint @Roles ensures defense-in-depth — service also enforces.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { ApproveDsarDto } from './dto/approve-dsar.dto';
import { CreateDsarDto } from './dto/create-dsar.dto';
import { ListDsarQueryDto } from './dto/list-dsar-query.dto';
import { RejectDsarDto } from './dto/reject-dsar.dto';
import { DsarService } from './dsar.service';

@ApiTags('dsar')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('dsar')
export class DsarController {
  constructor(private readonly service: DsarService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List DSAR requests (filterable, paginated)' })
  async list(@CompanyId() companyId: string, @Query() query: ListDsarQueryDto): Promise<unknown> {
    return this.service.list(companyId, query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get DSAR request by id' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new DSAR request' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDsarDto,
  ): Promise<unknown> {
    return this.service.create(companyId, { id: user.id, role: user.role }, dto);
  }

  @Post(':id/approve')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a PENDING DSAR request' })
  async approve(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDsarDto,
  ): Promise<unknown> {
    return this.service.approve(companyId, { id: user.id, role: user.role }, id, dto);
  }

  @Post(':id/reject')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a PENDING DSAR request (reason mandatory)' })
  async reject(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDsarDto,
  ): Promise<unknown> {
    return this.service.reject(companyId, { id: user.id, role: user.role }, id, dto);
  }

  @Get(':id/download')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Re-issue a fresh signed download URL for a COMPLETED request' })
  async download(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    return this.service.download(companyId, { id: user.id, role: user.role }, id);
  }
}
