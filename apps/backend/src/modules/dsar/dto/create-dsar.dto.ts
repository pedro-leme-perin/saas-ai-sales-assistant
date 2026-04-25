// =============================================
// 📥 CreateDsarDto (S60a)
// =============================================
// Validated by class-validator + ValidationPipe. Note: deeper semantic
// validation (CPF checksum, CORRECTION-only correctionPayload) lives in
// DsarService.create where domain rules belong.

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DsarType } from '@prisma/client';

import { DSAR_CPF_REGEX } from '../constants';

export class DsarCorrectionPayloadDto {
  @ApiPropertyOptional({ description: 'New name; explicit null clears.', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @ApiPropertyOptional({ description: 'New email (RFC 5322 subset)', maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ description: 'New phone (E.164 — service normalises)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiPropertyOptional({ description: 'New IANA timezone', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @ApiPropertyOptional({ description: 'Reason logged in audit trail', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateDsarDto {
  @ApiProperty({ enum: DsarType, description: 'LGPD Art. 18 sub-right requested' })
  @IsEnum(DsarType)
  type!: DsarType;

  @ApiProperty({ description: 'Email of the data subject (titular)', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  requesterEmail!: string;

  @ApiPropertyOptional({ description: 'Display name of the data subject', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  requesterName?: string;

  @ApiPropertyOptional({ description: 'CPF (11 digits, optional dots/dashes)', maxLength: 14 })
  @IsOptional()
  @IsString()
  @Matches(DSAR_CPF_REGEX, { message: 'CPF must match XXX.XXX.XXX-XX or 11 digits' })
  cpf?: string;

  @ApiPropertyOptional({ description: 'Internal note (visible to admins)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Required when type=CORRECTION. Ignored for other types.',
    type: () => DsarCorrectionPayloadDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DsarCorrectionPayloadDto)
  correctionPayload?: DsarCorrectionPayloadDto;
}
