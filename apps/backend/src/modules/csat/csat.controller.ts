// =============================================
// 📄 CSAT CONTROLLER (Session 50)
// =============================================
// Admin endpoints under /csat (TenantGuard + RolesGuard).
// Public endpoints under /csat/public/:token (no auth) for the
// customer-facing survey page.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CsatResponseStatus, UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Public, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CsatService } from './csat.service';
import { UpsertCsatConfigDto } from './dto/upsert-csat-config.dto';
import { SubmitCsatDto } from './dto/submit-csat.dto';

@ApiTags('csat')
@Controller('csat')
export class CsatController {
  constructor(private readonly service: CsatService) {}

  // ===== ADMIN ==========================================================

  @Get('configs')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'List CSAT trigger configurations' })
  async listConfigs(@CompanyId() companyId: string) {
    return { data: await this.service.listConfigs(companyId) };
  }

  @Put('configs')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Upsert a CSAT configuration (one per trigger)' })
  async upsertConfig(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCsatConfigDto,
  ) {
    return this.service.upsertConfig(companyId, user.id, dto);
  }

  @Delete('configs/:id')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a CSAT configuration' })
  async removeConfig(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.removeConfig(companyId, user.id, id);
  }

  @Get('responses')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'List CSAT responses (paginated, filter by status)' })
  async listResponses(
    @CompanyId() companyId: string,
    @Query('status') status?: CsatResponseStatus,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.service.listResponses(companyId, {
      status,
      limit: Number.isFinite(parsed) ? parsed : undefined,
      cursor,
    });
  }

  @Get('analytics')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Aggregate CSAT analytics for a time window' })
  async analytics(
    @CompanyId() companyId: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    const sinceDate = since ? new Date(since) : undefined;
    const untilDate = until ? new Date(until) : undefined;
    if (sinceDate && Number.isNaN(sinceDate.getTime())) {
      throw new BadRequestException('Invalid since date');
    }
    if (untilDate && Number.isNaN(untilDate.getTime())) {
      throw new BadRequestException('Invalid until date');
    }
    return this.service.analytics(companyId, { since: sinceDate, until: untilDate });
  }

  // ===== PUBLIC (no auth) ==============================================

  @Get('public/:token')
  @Public()
  @ApiOperation({ summary: 'Lookup CSAT survey by public token' })
  async publicLookup(@Param('token') token: string) {
    return this.service.lookupPublicByToken(token);
  }

  @Post('public/:token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit CSAT score + optional comment' })
  async publicSubmit(@Param('token') token: string, @Body() dto: SubmitCsatDto) {
    return this.service.submitPublic(token, dto);
  }
}
