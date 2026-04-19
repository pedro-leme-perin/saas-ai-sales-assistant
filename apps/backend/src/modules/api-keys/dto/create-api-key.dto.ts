// =============================================
// 📄 CREATE API KEY DTO (Session 47)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CRM Production', minLength: 2, maxLength: 60 })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['calls:read', 'whatsapp:write'],
    description: 'Scope strings in {resource}:{action} format',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/, { each: true })
  scopes?: string[];

  @ApiPropertyOptional({ example: 60, minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitPerMin?: number;

  @ApiPropertyOptional({ example: '2027-04-19T00:00:00Z', description: 'ISO 8601' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
