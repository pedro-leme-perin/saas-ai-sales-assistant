// =============================================
// 📄 RETENTION POLICIES CONTROLLER (Session 51)
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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { RetentionPoliciesService } from './retention-policies.service';
import { UpsertRetentionPolicyDto } from './dto/upsert-retention-policy.dto';

@ApiTags('retention-policies')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('retention-policies')
export class RetentionPoliciesController {
  constructor(private readonly service: RetentionPoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'List retention policies' })
  async list(@CompanyId() companyId: string) {
    return this.service.list(companyId);
  }

  @Put()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert retention policy for resource' })
  async upsert(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertRetentionPolicyDto,
  ) {
    return this.service.upsert(companyId, user.id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete retention policy' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(companyId, user.id, id);
  }
}
