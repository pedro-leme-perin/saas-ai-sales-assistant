// ============================================================
// 🏢 CREATE COMPANY DTO
// ============================================================

import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'ACME Sales Corp',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Company slug (URL-friendly)',
    example: 'acme-sales',
  })
  @IsString()
  @IsOptional()
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
  stripeCustomerId?: string;
}