// =============================================
// 🔎 ListDsarQueryDto (S60a)
// =============================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DsarStatus, DsarType } from '@prisma/client';

export class ListDsarQueryDto {
  @ApiPropertyOptional({ enum: DsarStatus })
  @IsOptional()
  @IsEnum(DsarStatus)
  status?: DsarStatus;

  @ApiPropertyOptional({ enum: DsarType })
  @IsOptional()
  @IsEnum(DsarType)
  type?: DsarType;

  @ApiPropertyOptional({ description: 'Filter by requester email substring', maxLength: 254 })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  requesterEmail?: string;

  @ApiPropertyOptional({ description: 'requestedAt >= this ISO date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'requestedAt < this ISO date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Page size', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
