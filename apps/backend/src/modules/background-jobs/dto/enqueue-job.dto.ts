// =============================================
// 📄 ENQUEUE JOB DTO (Session 49)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { BackgroundJobType } from '@prisma/client';

export class EnqueueJobDto {
  @ApiProperty({ enum: BackgroundJobType })
  @IsEnum(BackgroundJobType)
  type!: BackgroundJobType;

  @ApiPropertyOptional({ description: 'Opaque payload consumed by the worker', type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;
}
