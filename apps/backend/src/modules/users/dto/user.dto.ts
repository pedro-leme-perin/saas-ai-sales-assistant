import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: UserRole, default: 'VENDOR' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
