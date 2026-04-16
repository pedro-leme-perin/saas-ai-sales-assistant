// =====================================================
// COMPLETE ONBOARDING DTO
// Dedicated DTO for onboarding completion endpoint
// =====================================================

import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Plan } from '@prisma/client';

export class CompleteOnboardingDto {
  @ApiProperty({ description: 'Company name', example: 'ACME Sales Corp' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  companyName!: string;

  @ApiPropertyOptional({ description: 'Team size range', example: '6-20' })
  @IsString()
  @IsOptional()
  @IsIn(['1-5', '6-20', '21-50', '51-200', '200+'])
  teamSize?: string;

  @ApiPropertyOptional({ description: 'Industry sector', example: 'saas' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  industry?: string;

  @ApiPropertyOptional({
    description: 'Communication channels',
    example: ['phone', 'whatsapp'],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsIn(['phone', 'whatsapp', 'email', 'chat'], { each: true })
  @ArrayMaxSize(10)
  channels?: string[];

  @ApiPropertyOptional({
    description: 'Selected plan',
    example: 'STARTER',
    enum: Plan,
  })
  @IsOptional()
  @IsEnum(Plan)
  selectedPlan?: Plan;
}
