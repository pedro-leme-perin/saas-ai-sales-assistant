// =============================================
// 📄 BulkAssignChatsDto (Session 52)
// =============================================

import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class BulkAssignChatsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  chatIds!: string[];

  // Null = unassign
  @IsOptional()
  @IsString()
  userId!: string | null;
}
