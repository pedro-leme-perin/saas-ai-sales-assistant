// =============================================
// 🎯 AssignmentRulesController (Session 54 — Feature A2)
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
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import {
  CompanyId,
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { AssignmentRulesService } from './assignment-rules.service';
import {
  CreateAssignmentRuleDto,
  UpdateAssignmentRuleDto,
} from './dto/upsert-assignment-rule.dto';

@ApiTags('assignment-rules')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('assignment-rules')
export class AssignmentRulesController {
  constructor(private readonly service: AssignmentRulesService) {}

  @Get()
  @ApiOperation({ summary: 'List assignment rules for this tenant' })
  async list(@CompanyId() companyId: string) {
    return { data: await this.service.list(companyId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one assignment rule' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create assignment rule' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentRuleDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update assignment rule' })
  async update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAssignmentRuleDto,
  ) {
    return this.service.update(companyId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete assignment rule' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(companyId, user.id, id);
  }
}
