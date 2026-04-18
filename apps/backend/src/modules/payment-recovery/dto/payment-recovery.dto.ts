// =============================================
// 💸 PAYMENT RECOVERY DTOs
// =============================================

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EXIT_SURVEY_REASONS, type ExitSurveyReason } from '../constants';

export class PauseSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Optional reason for pausing (analytics, retention)',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class ResumeSubscriptionDto {}

export class ExitSurveyDto {
  @ApiProperty({ enum: EXIT_SURVEY_REASONS })
  @IsEnum(EXIT_SURVEY_REASONS)
  reason!: ExitSurveyReason;

  @ApiPropertyOptional({ description: 'Free-form comment', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}
