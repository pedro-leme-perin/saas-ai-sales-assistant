// =============================================
// 🎯 GOALS CONTROLLER (Session 45)
// =============================================
// - GET  /goals/leaderboard?period=WEEKLY|MONTHLY   → all authenticated users
// - GET  /goals/current?period=WEEKLY|MONTHLY       → list active-period goals
// - POST /goals                                     → OWNER/ADMIN/MANAGER
// - PATCH /goals/:id                                → OWNER/ADMIN/MANAGER
// - DELETE /goals/:id                               → OWNER/ADMIN/MANAGER
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GoalPeriodType, UserRole } from '@prisma/client';
import {
  CompanyId,
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@ApiTags('goals')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Team leaderboard for the active period',
    description:
      'Ranks vendors by composite goal progress. When no goals are set, rows still list raw activity metrics (rank = callsCompleted DESC).',
  })
  @ApiResponse({ status: 200, description: 'Leaderboard returned' })
  async leaderboard(
    @CompanyId() companyId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    const period = query.period ?? GoalPeriodType.WEEKLY;
    return this.goals.leaderboard(companyId, period);
  }

  @Get('current')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List goals for the active period' })
  async current(
    @CompanyId() companyId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    const period = query.period ?? GoalPeriodType.WEEKLY;
    return { data: await this.goals.listCurrent(companyId, period) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a team goal' })
  @ApiResponse({ status: 201, description: 'Goal created' })
  @ApiResponse({ status: 400, description: 'Validation / duplicate period' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goals.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update the target of an existing goal' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goals.updateTarget(companyId, id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a team goal' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.goals.remove(companyId, id, user.id);
  }
}
