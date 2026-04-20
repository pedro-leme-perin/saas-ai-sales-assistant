// =============================================
// 📄 ApiRequestLogsController (Session 52)
// =============================================

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyId, Roles } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ApiRequestLogsService } from './api-request-logs.service';
import { ListApiRequestLogsDto } from './dto/list-logs.dto';

@ApiTags('api-request-logs')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('api-request-logs')
export class ApiRequestLogsController {
  constructor(private readonly service: ApiRequestLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List API request logs (cursor paginated)' })
  async list(@CompanyId() companyId: string, @Query() filters: ListApiRequestLogsDto) {
    return this.service.list(companyId, filters);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Aggregated API metrics (24h window)' })
  async metrics(@CompanyId() companyId: string) {
    return this.service.metrics(companyId);
  }
}
