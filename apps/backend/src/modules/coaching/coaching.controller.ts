// =============================================
// 📄 COACHING CONTROLLER
// =============================================
// Session 44: List + view weekly coaching reports.
// Write path is cron-only — no public POST endpoint.
// =============================================

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { PrismaService } from '@infrastructure/database/prisma.service';

@ApiTags('coaching')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('coaching')
export class CoachingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List my recent coaching reports',
    description:
      'Returns the caller\u2019s coaching reports in reverse-chronological order (latest first). Cap of 12 by default.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Reports returned' })
  async listMine(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '12', 10) || 12, 1), 52);
    const reports = await this.prisma.coachingReport.findMany({
      where: { userId: user.id, companyId },
      orderBy: { weekStart: 'desc' },
      take: limit,
    });
    return { data: reports, meta: { total: reports.length } };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch a single coaching report',
    description: 'Tenant-scoped. Returns 404 if the report does not belong to the caller\u2019s company.',
  })
  @ApiResponse({ status: 200, description: 'Report returned' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const report = await this.prisma.coachingReport.findFirst({
      where: { id, companyId, userId: user.id },
    });
    if (!report) {
      throw new NotFoundException('Coaching report not found');
    }
    return report;
  }
}
