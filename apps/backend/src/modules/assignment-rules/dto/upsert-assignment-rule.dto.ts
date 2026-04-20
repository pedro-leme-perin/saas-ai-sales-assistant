// =============================================
// 🎯 Assignment rule DTOs (Session 54 — Feature A2)
// =============================================

import { AssignmentStrategy, ChatPriority } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Conditions JSON shape (validated structurally in service):
 *   {
 *     priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
 *     tags?: string[],            // any-of match against chat.tags
 *     phonePrefix?: string,       // e.g. '+5511' for SP region
 *     keywordsAny?: string[],     // any token (case-insensitive) appearing in
 *                                 // customerName/preview triggers the rule
 *   }
 */
export class CreateAssignmentRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  priority!: number;

  @IsEnum(['ROUND_ROBIN', 'LEAST_BUSY', 'MANUAL_ONLY'])
  strategy!: AssignmentStrategy;

  @IsObject()
  conditions!: Record<string, unknown>;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  targetUserIds!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAssignmentRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @IsEnum(['ROUND_ROBIN', 'LEAST_BUSY', 'MANUAL_ONLY'])
  strategy?: AssignmentStrategy;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Re-export prisma enums for callers
export { AssignmentStrategy, ChatPriority };
