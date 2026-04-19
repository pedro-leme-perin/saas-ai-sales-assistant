// =============================================
// 📄 CREATE TAG DTO (Session 47)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsHexColor, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'Lead quente', minLength: 2, maxLength: 40 })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[\p{L}\p{N}\s\-_\.]+$/u, { message: 'Name contains invalid characters' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ example: '#6366F1', description: 'Hex color (e.g. #6366F1)' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'Leads qualificados pela IA' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
