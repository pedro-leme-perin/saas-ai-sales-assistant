// =====================================================
// COMPLETE ONBOARDING DTO
// Dedicated DTO for onboarding completion endpoint
// =====================================================

import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteOnboardingDto {
  @ApiProperty({ description: 'Company name', example: 'ACME Sales Corp' })
  @IsString()
  companyName!: string;

  @ApiPropertyOptional({ description: 'Team size range', example: '6-20' })
  @IsString()
  @IsOptional()
  teamSize?: string;

  @ApiPropertyOptional({ description: 'Industry sector', example: 'saas' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Communication channels',
    example: ['phone', 'whatsapp'],
  })
  @IsArray()
  @IsOptional()
  channels?: string[];

  @ApiPropertyOptional({
    description: 'Selected plan',
    example: 'STARTER',
    enum: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
  })
  @IsString()
  @IsOptional()
  selectedPlan?: string;
}
