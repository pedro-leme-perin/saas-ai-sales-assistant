// =============================================
// 📈 CsatTrendsController (Session 59 — Feature A2)
// =============================================
// Mounted at /csat/trends (not under /csat-trends) so the feature surfaces
// as a natural extension of the existing CSAT API. DTO-validated via
// ValidationPipe (global, whitelist=true).

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CompanyId } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { CsatTrendsService } from './csat-trends.service';
import { TrendsQueryDto } from './dto/trends-query.dto';

@ApiTags('csat-trends')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('csat/trends')
export class CsatTrendsController {
  constructor(private readonly service: CsatTrendsService) {}

  @Get()
  @ApiOperation({
    summary: 'CSAT trends over time with optional breakdown (agent/tag/channel)',
  })
  async getTrends(@CompanyId() companyId: string, @Query() query: TrendsQueryDto) {
    return this.service.getTrends(companyId, query);
  }
}
