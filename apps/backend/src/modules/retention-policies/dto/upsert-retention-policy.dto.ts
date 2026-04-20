// =============================================
// 📄 UpsertRetentionPolicyDto (Session 51)
// =============================================

import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RetentionResource } from '@prisma/client';

export class UpsertRetentionPolicyDto {
  @IsEnum(RetentionResource)
  resource!: RetentionResource;

  // 7..3650 days. Minimum for AUDIT_LOGS enforced at service layer (180d).
  @IsInt()
  @Min(7)
  @Max(3650)
  retentionDays!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
