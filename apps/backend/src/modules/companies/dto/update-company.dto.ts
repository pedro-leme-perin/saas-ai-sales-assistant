// =====================================================
// UPDATE COMPANY DTO
// Supports: name, slug, plan, stripeCustomerId, website,
//           industry, logoUrl, timezone, metadata (JSON)
// =====================================================

import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  IsObject,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Plan } from '@prisma/client';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'Company name', example: 'ACME Sales Corp' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ description: 'Company slug (URL-friendly)', example: 'acme-sales' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. acme-sales)',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Subscription plan', enum: Plan, example: 'PROFESSIONAL' })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiPropertyOptional({ description: 'Stripe customer ID', example: 'cus_xxxxxxxxxxxxx' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  stripeCustomerId?: string;

  @ApiPropertyOptional({ description: 'Company website URL', example: 'https://acme.com' })
  @IsUrl({}, { message: 'Website must be a valid URL' })
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ description: 'Industry sector', example: 'technology' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  industry?: string;

  @ApiPropertyOptional({
    description: 'Company logo URL',
    example: 'https://acme.com/logo.png',
  })
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Timezone (IANA)', example: 'America/Sao_Paulo' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+/, {
    message: 'timezone must be IANA format (e.g. America/Sao_Paulo)',
  })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Arbitrary metadata JSON' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
