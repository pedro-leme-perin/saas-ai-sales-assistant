import { IsOptional, IsString, IsBoolean, MaxLength, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateKnowledgeChunkDto {
  @ApiPropertyOptional({
    description: 'New text content (triggers re-embedding)',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated source reference',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceRef?: string;

  @ApiPropertyOptional({
    description: 'Updated metadata JSON',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Toggle active status (inactive chunks excluded from RAG retrieval)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
