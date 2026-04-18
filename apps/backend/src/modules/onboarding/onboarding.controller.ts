// =============================================
// 🚀 ONBOARDING CONTROLLER
// =============================================
// Session 42: Guided post-signup onboarding endpoints.
// Clean Architecture: Interface Adapter layer (thin HTTP glue).
// =============================================

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { OnboardingService } from './onboarding.service';
import {
  OnboardingDismissDto,
  OnboardingSkipDto,
  OnboardingStepParamDto,
} from './dto/onboarding.dto';

@ApiTags('onboarding')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Throttle({ default: { ttl: 60000, limit: 60 } })
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('progress')
  @ApiOperation({
    summary: 'Get onboarding progress',
    description:
      'Returns checklist state with auto-detected completions (profile, team, channels, first interaction).',
  })
  @ApiResponse({ status: 200, description: 'Progress retrieved' })
  async getProgress(@CompanyId() companyId: string) {
    return this.onboardingService.getProgress(companyId);
  }

  @Post('steps/:stepId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually mark a step as completed' })
  @ApiResponse({ status: 200, description: 'Step marked as completed' })
  async completeStep(
    @Param() params: OnboardingStepParamDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboardingService.completeStep(companyId, user.id, params.stepId);
  }

  @Post('steps/:stepId/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip a step' })
  @ApiResponse({ status: 200, description: 'Step marked as skipped' })
  async skipStep(
    @Param() params: OnboardingStepParamDto,
    @Body() body: OnboardingSkipDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboardingService.skipStep(companyId, user.id, params.stepId, body.reason);
  }

  @Post('dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss the checklist (hides it from dashboard)' })
  @ApiResponse({ status: 200, description: 'Checklist dismissed' })
  async dismiss(
    @Body() body: OnboardingDismissDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboardingService.dismiss(companyId, user.id, body.feedback);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Reset onboarding progress (admin only)' })
  @ApiResponse({ status: 200, description: 'Progress reset to initial state' })
  async reset(@CompanyId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.reset(companyId, user.id);
  }
}
