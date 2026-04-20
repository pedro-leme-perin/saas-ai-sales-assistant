// =============================================
// 🧩 Custom field DTOs (Session 55 — Feature A1)
// =============================================

import { CustomFieldResource, CustomFieldType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Machine-readable key: starts with lowercase letter; letters/digits/underscore.
const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export class CreateCustomFieldDto {
  @IsEnum(CustomFieldResource)
  resource!: CustomFieldResource;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(KEY_REGEX, {
    message: 'key must start with a lowercase letter and contain only a-z, 0-9, _',
  })
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsEnum(CustomFieldType)
  type!: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  displayOrder?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  displayOrder?: number;
}

export { CustomFieldResource, CustomFieldType };
