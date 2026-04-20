// =============================================
// 📄 UPSERT CSAT CONFIG DTO (Session 50)
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
  MinLength,
} from 'class-validator';
import { CsatChannel, CsatTrigger } from '@prisma/client';

export class UpsertCsatConfigDto {
  @ApiProperty({ enum: CsatTrigger })
  @IsEnum(CsatTrigger)
  trigger!: CsatTrigger;

  @ApiProperty({ minimum: 0, maximum: 1440, description: 'Minutes after trigger event' })
  @IsInt()
  @Min(0)
  @Max(1440)
  delayMinutes!: number;

  @ApiProperty({ enum: CsatChannel, default: CsatChannel.WHATSAPP })
  @IsEnum(CsatChannel)
  channel!: CsatChannel;

  @ApiProperty({
    description: 'Template with {{link}} placeholder',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  messageTpl!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
