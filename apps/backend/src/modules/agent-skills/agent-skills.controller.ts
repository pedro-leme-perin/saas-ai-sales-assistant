// =============================================
// 🎓 AgentSkillsController (Session 59 — Feature A1)
// =============================================
// Endpoints:
//   GET    /agent-skills                 — list (optional ?userId, ?skill, ?isActive)
//   GET    /agent-skills/users/:userId   — list skills for a single user
//   GET    /agent-skills/:id             — get one by id
//   POST   /agent-skills                 — assign skill to user (create/upsert)
//   PATCH  /agent-skills/:id             — update level/notes/isActive
//   DELETE /agent-skills/:id             — remove
//   PUT    /agent-skills/users/:userId   — bulk replace user's skill set

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { AgentSkillsService } from './agent-skills.service';
import {
  AssignSkillToUserDto,
  BulkSetUserSkillsDto,
  UpsertAgentSkillDto,
} from './dto/upsert-agent-skill.dto';

@ApiTags('agent-skills')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('agent-skills')
export class AgentSkillsController {
  constructor(private readonly service: AgentSkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List skills for this tenant (filter by userId/skill/isActive)' })
  async list(
    @CompanyId() companyId: string,
    @Query('userId') userId?: string,
    @Query('skill') skill?: string,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    return { data: await this.service.list(companyId, { userId, skill, isActive }) };
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'List all skills for one user' })
  async listForUser(
    @CompanyId() companyId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return { data: await this.service.listForUser(companyId, userId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one skill row by id' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign (upsert) a skill to a user' })
  async assign(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignSkillToUserDto,
  ) {
    return this.service.assignToUser(companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a skill row (level/notes/isActive only)' })
  async update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertAgentSkillDto,
  ) {
    return this.service.update(companyId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a skill row' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(companyId, user.id, id);
  }

  @Put('users/:userId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Bulk-replace a user\'s full skill set atomically' })
  async bulkReplace(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: BulkSetUserSkillsDto,
  ) {
    // Enforce path/body userId consistency (defence in depth).
    if (dto.userId !== userId) {
      return { error: 'userId mismatch between path and body' };
    }
    return { data: await this.service.bulkSetForUser(companyId, user.id, dto) };
  }
}
