// =============================================
// 📄 UPSERT SLA POLICY DTO (Session 49)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChatPriority } from '@prisma/client';

export class UpsertSlaPolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ChatPriority })
  @IsEnum(ChatPriority)
  priority!: ChatPriority;

  @ApiProperty({ description: 'Minutes to first agent reply', minimum: 1, maximum: 10_080 })
  @IsInt()
  @Min(1)
  @Max(10_080)
  responseMins!: number;

  @ApiProperty({ description: 'Minutes to resolution', minimum: 1, maximum: 43_200 })
  @IsInt()
  @Min(1)
  @Max(43_200)
  resolutionMins!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
