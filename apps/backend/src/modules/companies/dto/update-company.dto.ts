// =====================================================
// 📝 UPDATE COMPANY DTO
// Supports: name, slug, plan, stripeCustomerId, website,
//           industry, logoUrl, timezone, metadata (JSON)
// =====================================================

import { IsString, IsOptional, IsEnum, IsUrl, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'Company name', example: 'ACME Sales Corp' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Company slug (URL-friendly)', example: 'acme-sales' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ description: 'Subscription plan', enum: Plan, example: 'PROFESSIONAL' })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiPropertyOptional({ description: 'Stripe customer ID', example: 'cus_xxxxxxxxxxxxx' })
  @IsString()
  @IsOptional()
  stripeCustomerId?: string;

  @ApiPropertyOptional({ description: 'Company website URL', example: 'https://acme.com' })
  @IsUrl({}, { message: 'Website must be a valid URL' })
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ description: 'Industry sector', example: 'technology' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({ description: 'Company logo URL', example: 'https://acme.com/logo.png' })
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/Sao_Paulo' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Arbitrary metadata JSON' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
