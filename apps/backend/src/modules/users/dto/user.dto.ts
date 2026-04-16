import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ enum: UserRole, default: 'VENDOR' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: '+5511999999999' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be E.164 format (e.g. +5511999999999)' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class InviteUserDto {
  @ApiProperty({ description: 'Email address of the user to invite' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Role to assign to the invited user', enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateUserRoleDto {
  @ApiProperty({ description: 'New role for the user', enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}
