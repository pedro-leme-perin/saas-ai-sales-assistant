import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KnowledgeChunkSource } from '@prisma/client';

export class CreateKnowledgeChunkDto {
  @ApiProperty({
    enum: KnowledgeChunkSource,
    description: 'Source type of the knowledge chunk',
    example: KnowledgeChunkSource.DOCUMENT,
  })
  @IsEnum(KnowledgeChunkSource)
  source!: KnowledgeChunkSource;

  @ApiProperty({
    description: 'Human-readable identifier for the source (filename, URL, title)',
    example: 'products-catalog-2026.pdf',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  sourceRef!: string;

  @ApiPropertyOptional({
    description: 'Ordered position within the source document',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  chunkIndex?: number;

  @ApiProperty({
    description: 'Raw text content of the chunk (will be embedded)',
    example: 'Our Enterprise plan includes unlimited AI suggestions and dedicated support.',
  })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: 'Optional metadata JSON (page number, section, language, tags, etc.)',
    example: { page: 3, section: 'Pricing', language: 'pt-BR' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Whether this chunk is active and will be used in RAG retrieval',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
