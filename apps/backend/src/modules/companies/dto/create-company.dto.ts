// ============================================================
// CREATE COMPANY DTO
// ============================================================

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Plan } from '@prisma/client';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'ACME Sales Corp',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({
    description: 'Company slug (URL-friendly)',
    example: 'acme-sales',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. acme-sales)',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Subscription plan',
    enum: Plan,
    example: 'STARTER',
  })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiPropertyOptional({
    description: 'Stripe customer ID',
    example: 'cus_xxxxxxxxxxxxx',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  stripeCustomerId?: string;
}
