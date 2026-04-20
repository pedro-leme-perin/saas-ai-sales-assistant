// =============================================
// 📄 UPSERT NOTIFICATION PREFERENCE DTO (Session 48)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NotificationChannel, NotificationType } from '@prisma/client';

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertPreferenceItemDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ example: '22:00', pattern: 'HH:MM' })
  @IsOptional()
  @IsString()
  @Matches(HHMM_REGEX, { message: 'quietHoursStart must be HH:MM' })
  quietHoursStart?: string;

  @ApiPropertyOptional({ example: '07:00', pattern: 'HH:MM' })
  @IsOptional()
  @IsString()
  @Matches(HHMM_REGEX, { message: 'quietHoursEnd must be HH:MM' })
  quietHoursEnd?: string;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  digestMode?: boolean;
}

export class UpsertPreferencesDto {
  @ApiProperty({ type: [UpsertPreferenceItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertPreferenceItemDto)
  items!: UpsertPreferenceItemDto[];
}
