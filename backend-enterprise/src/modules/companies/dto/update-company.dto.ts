// =====================================================
// 📝 UPDATE COMPANY DTO
// =====================================================

import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class UpdateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'ACME Sales Corp',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Company slug (URL-friendly)',
    example: 'acme-sales',
    required: false,
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({
    description: 'Subscription plan',
    enum: Plan,
    example: 'PROFESSIONAL',
    required: false,
  })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiProperty({
    description: 'Stripe customer ID',
    example: 'cus_xxxxxxxxxxxxx',
    required: false,
  })
  @IsString()
  @IsOptional()
  stripeCustomerId?: string;
}
