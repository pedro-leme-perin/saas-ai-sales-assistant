// =============================================
// 📄 CreateMacroDto (Session 56)
// =============================================
// `actions` is an arbitrary array validated at runtime by the
// service via a strict Zod schema. We intentionally keep it loose
// at the DTO layer so class-validator does not reject unknown
// action shapes before we can produce a precise error message.

import { IsArray, IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateMacroDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  actions!: unknown[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
