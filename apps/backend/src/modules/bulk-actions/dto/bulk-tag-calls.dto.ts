// =============================================
// 📄 BulkTagCallsDto (Session 52)
// =============================================

import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class BulkTagCallsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  callIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  tagIds!: string[];
}
