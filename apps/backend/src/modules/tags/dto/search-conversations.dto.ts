// =============================================
// 📄 SEARCH CONVERSATIONS DTO (Session 47)
// =============================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum SearchScope {
  CALL = 'CALL',
  CHAT = 'CHAT',
  BOTH = 'BOTH',
}

export class SearchConversationsDto {
  @ApiPropertyOptional({ example: 'desconto', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({ enum: SearchScope, default: SearchScope.BOTH })
  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope;

  @ApiPropertyOptional({ type: [String], description: 'Filter by tag ids (AND semantics)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.length > 0) return value.split(',');
    return value;
  })
  tagIds?: string[];

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
