// =============================================
// 📄 BACKGROUND JOBS CONTROLLER (Session 49)
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
import { BackgroundJobStatus, BackgroundJobType, UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { BackgroundJobsService } from './background-jobs.service';
import { EnqueueJobDto } from './dto/enqueue-job.dto';

@ApiTags('background-jobs')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('background-jobs')
export class BackgroundJobsController {
  constructor(private readonly service: BackgroundJobsService) {}

  @Get()
  @ApiOperation({ summary: 'List recent background jobs for this tenant' })
  async list(
    @CompanyId() companyId: string,
    @Query('status') status?: BackgroundJobStatus,
    @Query('type') type?: BackgroundJobType,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;
    return {
      data: await this.service.list(companyId, { status, type, limit: parsedLimit }),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a background job' })
  async findById(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Enqueue a background job' })
  async enqueue(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnqueueJobDto,
  ) {
    return this.service.enqueue(companyId, user.id, {
      type: dto.type,
      payload: dto.payload,
      maxAttempts: dto.maxAttempts,
    });
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Retry a failed or dead-lettered job' })
  async retry(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.retry(companyId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel a pending/running job' })
  async cancel(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancel(companyId, id);
  }
}
