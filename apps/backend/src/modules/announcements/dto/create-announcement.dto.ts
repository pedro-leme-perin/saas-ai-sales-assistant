// =============================================
// 📄 Create / Update Announcement DTO (Session 53)
// =============================================

import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AnnouncementLevel, UserRole } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsEnum(AnnouncementLevel)
  level?: AnnouncementLevel;

  @IsOptional()
  @IsISO8601()
  publishAt?: string;

  @IsOptional()
  @IsISO8601()
  expireAt?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  targetRoles?: UserRole[];
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsEnum(AnnouncementLevel)
  level?: AnnouncementLevel;

  @IsOptional()
  @IsISO8601()
  publishAt?: string;

  @IsOptional()
  @IsISO8601()
  expireAt?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  targetRoles?: UserRole[];
}
