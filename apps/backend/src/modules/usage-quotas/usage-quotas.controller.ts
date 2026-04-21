// =============================================
// 📊 UsageQuotasController (Session 55 — Feature A2)
// =============================================

import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsageMetric, UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { UpsertUsageQuotaDto } from './dto/upsert-usage-quota.dto';
import { UsageQuotasService } from './usage-quotas.service';

@ApiTags('usage-quotas')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('usage-quotas')
export class UsageQuotasController {
  constructor(private readonly service: UsageQuotasService) {}

  @Get()
  @ApiOperation({ summary: 'List current-period quotas for this tenant' })
  async list(@CompanyId() companyId: string) {
    const rows = await this.service.list(companyId);
    return { data: rows.map((r) => ({ ...r })) };
  }

  @Get('check/:metric')
  @ApiOperation({ summary: 'Check a single metric (auto-provisions row)' })
  async check(@CompanyId() companyId: string, @Param('metric') metric: UsageMetric) {
    return this.service.checkQuota(companyId, metric);
  }

  @Put('limit')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Override the quota limit for a metric (admin)' })
  async upsertLimit(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertUsageQuotaDto,
  ) {
    return this.service.upsertLimit(companyId, user.id, dto.metric, dto.limit);
  }
}
