// =============================================
// 🚀 ONBOARDING DTOs
// =============================================

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ONBOARDING_STEPS, type OnboardingStepId } from '../constants';

export class OnboardingStepParamDto {
  @ApiProperty({ enum: ONBOARDING_STEPS, description: 'Onboarding step identifier' })
  @IsEnum(ONBOARDING_STEPS)
  stepId!: OnboardingStepId;
}

export class OnboardingSkipDto {
  @ApiPropertyOptional({ description: 'Optional reason for skipping (analytics)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class OnboardingDismissDto {
  @ApiPropertyOptional({ description: 'Optional feedback on why user dismissed the checklist' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  feedback?: string;
}

export interface OnboardingProgressResponse {
  percent: number;
  isComplete: boolean;
  isDismissed: boolean;
  stepsCompleted: OnboardingStepId[];
  stepsSkipped: OnboardingStepId[];
  completedAt: string | null;
  dismissedAt: string | null;
  startedAt: string;
  steps: Array<{
    id: OnboardingStepId;
    order: number;
    actionUrl: string;
    estimatedMinutes: number;
    status: 'pending' | 'completed' | 'skipped';
  }>;
}
