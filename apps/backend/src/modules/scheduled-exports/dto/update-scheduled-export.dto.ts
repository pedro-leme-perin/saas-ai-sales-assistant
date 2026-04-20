// =============================================
// 📄 UpdateScheduledExportDto (Session 51)
// =============================================

import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ScheduledExportFormat } from '@prisma/client';

export class UpdateScheduledExportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsEnum(ScheduledExportFormat)
  @IsOptional()
  format?: ScheduledExportFormat;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(64)
  cronExpression?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  timezone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  @IsOptional()
  recipients?: string[];

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
