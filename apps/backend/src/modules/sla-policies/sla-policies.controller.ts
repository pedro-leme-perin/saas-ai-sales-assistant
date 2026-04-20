// =============================================
// 📄 SLA POLICIES CONTROLLER (Session 49)
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
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { SlaPoliciesService } from './sla-policies.service';
import { UpsertSlaPolicyDto } from './dto/upsert-sla-policy.dto';

@ApiTags('sla-policies')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('sla-policies')
export class SlaPoliciesController {
  constructor(private readonly service: SlaPoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'List SLA policies for this tenant' })
  async list(@CompanyId() companyId: string) {
    return { data: await this.service.list(companyId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a SLA policy' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Put()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update a SLA policy for a given priority' })
  async upsert(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertSlaPolicyDto,
  ) {
    return this.service.upsert(companyId, user.id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a SLA policy' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(companyId, user.id, id);
  }
}
