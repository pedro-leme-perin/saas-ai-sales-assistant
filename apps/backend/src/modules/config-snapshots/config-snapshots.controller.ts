// =============================================
// 📸 ConfigSnapshotsController (Session 58 — Feature A2)
// =============================================

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
import { ConfigResource, UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { ConfigSnapshotsService } from './config-snapshots.service';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';

@ApiTags('config-snapshots')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('config-snapshots')
export class ConfigSnapshotsController {
  constructor(private readonly service: ConfigSnapshotsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List config snapshots for this tenant.' })
  async list(
    @CompanyId() companyId: string,
    @Query('resource') resource?: ConfigResource,
    @Query('resourceId') resourceId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(companyId, {
      resource,
      resourceId,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get snapshot by id.' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually capture a config snapshot.' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Get(':id/diff')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Diff snapshot against current live state.' })
  async diff(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.diff(companyId, id);
  }

  @Post(':id/rollback')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Apply rollback. Creates a pre-rollback snapshot (reversible).',
  })
  async rollback(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.rollback(companyId, user.id, id);
  }
}
