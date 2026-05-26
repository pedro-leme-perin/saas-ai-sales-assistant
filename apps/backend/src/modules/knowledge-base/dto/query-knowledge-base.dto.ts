import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { KnowledgeChunkSource } from '@prisma/client';

export class QueryKnowledgeBaseDto {
  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: KnowledgeChunkSource,
  })
  @IsOptional()
  @IsEnum(KnowledgeChunkSource)
  source?: KnowledgeChunkSource;

  @ApiPropertyOptional({
    description: 'Filter by source reference (exact match)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceRef?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Number of results to return (pagination)',
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (last seen chunk ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SemanticSearchDto {
  @ApiPropertyOptional({
    description: 'Text query to embed and search with (cosine similarity)',
    example: 'what is the refund policy',
  })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Number of top-k relevant chunks to return',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  topK?: number;

  @ApiPropertyOptional({
    description: 'Minimum cosine similarity threshold (0–1). Chunks below this are excluded.',
    default: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  minScore?: number;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: KnowledgeChunkSource,
  })
  @IsOptional()
  @IsEnum(KnowledgeChunkSource)
  source?: KnowledgeChunkSource;
}
