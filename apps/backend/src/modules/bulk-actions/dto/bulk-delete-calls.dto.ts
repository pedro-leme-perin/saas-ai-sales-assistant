// =============================================
// 📄 BulkDeleteCallsDto (Session 52)
// =============================================

import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkDeleteCallsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  callIds!: string[];
}
