// =============================================
// 🎯 CREATE GOAL DTO (Session 45)
// =============================================
// Target can be a count (CALLS_*, WHATSAPP_MESSAGES) or a percentage
// 0-100 (CONVERSION_RATE, AI_ADOPTION_RATE). Backend validates the
// range based on metric type.
// =============================================

import { IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { GoalMetric, GoalPeriodType } from '@prisma/client';

export class CreateGoalDto {
  @IsEnum(GoalMetric)
  metric!: GoalMetric;

  @IsEnum(GoalPeriodType)
  periodType!: GoalPeriodType;

  @IsInt()
  @Min(1)
  @Max(100_000)
  target!: number;

  /** Optional — ISO date (yyyy-mm-dd) inside the desired period. Defaults to now. */
  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  periodAnchor?: string;

  /** Null/omitted = company-wide goal. Otherwise must be a userId inside the tenant. */
  @IsOptional()
  @IsString()
  userId?: string;
}
