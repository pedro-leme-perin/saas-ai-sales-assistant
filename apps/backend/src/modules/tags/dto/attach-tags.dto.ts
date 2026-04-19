// =============================================
// 📄 ATTACH TAGS DTO (Session 47)
// =============================================

import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AttachTagsDto {
  @ApiProperty({ type: [String], example: ['uuid-tag-1', 'uuid-tag-2'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
