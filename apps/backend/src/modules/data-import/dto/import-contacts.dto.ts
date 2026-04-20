// =============================================
// 📥 Data import DTOs (Session 54)
// =============================================

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ImportContactsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000_000) // ~10MB raw CSV
  csvContent!: string;
}
