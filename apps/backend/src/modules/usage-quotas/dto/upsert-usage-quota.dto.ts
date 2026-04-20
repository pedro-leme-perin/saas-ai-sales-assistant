// =============================================
// 📊 Usage quotas DTOs (Session 55 — Feature A2)
// =============================================

import { UsageMetric } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpsertUsageQuotaDto {
  @IsEnum(UsageMetric)
  metric!: UsageMetric;

  /**
   * -1 = unlimited (Enterprise). 0 = disabled. Positive = hard cap.
   */
  @IsInt()
  @Min(-1)
  @Max(10_000_000)
  limit!: number;
}

export class RecordUsageDto {
  @IsEnum(UsageMetric)
  metric!: UsageMetric;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  delta?: number;
}

export { UsageMetric };
