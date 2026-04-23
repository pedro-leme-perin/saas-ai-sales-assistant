// =============================================
// 🎓 Agent skill DTOs (Session 59 — Feature A1)
// =============================================
// Skill slug is validated to a narrow format:
//   - lowercase
//   - starts with [a-z0-9]
//   - continues with [a-z0-9_-]
//   - max 80 chars
// Level is an integer in [1..5] (1=novice, 5=expert).

import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SKILL_SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,79}$/;
export const SKILL_SLUG_MESSAGE =
  'skill must be lowercase slug: start with alnum, then alnum/underscore/hyphen, ≤80 chars';

export class UpsertAgentSkillDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(SKILL_SLUG_REGEX, { message: SKILL_SLUG_MESSAGE })
  skill!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Used to assign a skill to a specific user (tenant isolation enforced in service).
 */
export class AssignSkillToUserDto extends UpsertAgentSkillDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}

/**
 * Bulk upsert: replaces the full skill set for a single user.
 * Atomic via $transaction — deleted rows are pruned for this (companyId, userId)
 * scope, then each entry is upserted in order.
 */
export class BulkSetUserSkillsDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertAgentSkillDto)
  skills!: UpsertAgentSkillDto[];
}
