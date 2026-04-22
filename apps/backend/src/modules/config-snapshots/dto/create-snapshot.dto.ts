// =============================================
// 📸 CreateSnapshotDto (Session 58 — Feature A2)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfigResource } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateSnapshotDto {
  @ApiProperty({ enum: ConfigResource })
  @IsEnum(ConfigResource)
  resource!: ConfigResource;

  @ApiPropertyOptional({
    description:
      'Specific resource id (required for FEATURE_FLAG, ASSIGNMENT_RULE; optional for COMPANY_SETTINGS, SLA_POLICY, NOTIFICATION_PREFERENCES)',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  label?: string;
}
