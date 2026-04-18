// =============================================
// 💸 PAYMENT RECOVERY CONTROLLER
// =============================================
// Session 42: Self-service subscription management + dunning status.
// =============================================

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { PaymentRecoveryService } from './payment-recovery.service';
import {
  ExitSurveyDto,
  PauseSubscriptionDto,
  ResumeSubscriptionDto,
} from './dto/payment-recovery.dto';

@ApiTags('billing-recovery')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Throttle({ strict: { ttl: 60000, limit: 20 } })
@Controller('billing/recovery')
export class PaymentRecoveryController {
  constructor(private readonly service: PaymentRecoveryService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get payment recovery / dunning status for the company' })
  @ApiResponse({ status: 200, description: 'Recovery status retrieved' })
  async status(@CompanyId() companyId: string) {
    return this.service.getRecoveryStatus(companyId);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Pause subscription (mark uncollectible — no charges until resume)',
  })
  @ApiResponse({ status: 200, description: 'Subscription paused' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async pause(
    @Body() dto: PauseSubscriptionDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.pauseSubscription(companyId, user, dto.reason);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Resume a paused subscription' })
  @ApiResponse({ status: 200, description: 'Subscription resumed' })
  async resume(
    @Body() _dto: ResumeSubscriptionDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resumeSubscription(companyId, user);
  }

  @Post('exit-survey')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Submit exit survey capturing why the user is leaving',
    description: 'Retention analytics. Does not cancel the subscription — use /billing/cancel for that.',
  })
  @ApiResponse({ status: 200, description: 'Survey recorded' })
  async exitSurvey(
    @Body() dto: ExitSurveyDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submitExitSurvey(companyId, user, dto.reason, dto.comment);
  }
}
