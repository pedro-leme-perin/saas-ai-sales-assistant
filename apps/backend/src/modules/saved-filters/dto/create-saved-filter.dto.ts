// =============================================
// 📄 CREATE SAVED FILTER DTO (Session 48)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FilterResource } from '@prisma/client';

export class CreateSavedFilterDto {
  @ApiProperty({ example: 'Leads quentes — última semana', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({ enum: FilterResource })
  @IsEnum(FilterResource)
  resource!: FilterResource;

  @ApiProperty({
    description: 'Filter JSON: { tagIds?: string[], sentiment?: string[], q?: string, dateFrom?, dateTo?, status? }',
    example: { tagIds: [], q: 'promoção', dateFrom: '2026-04-12' },
  })
  @IsObject()
  filterJson!: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Share with entire tenant (null userId)' })
  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}
