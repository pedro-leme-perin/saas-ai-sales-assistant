// =============================================
// 📄 MERGE CONTACTS DTO (Session 50)
// =============================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class MergeContactsDto {
  @ApiProperty({ description: 'Surviving contact id (keeps phone, merges counters)' })
  @IsString()
  @IsUUID()
  primaryId!: string;

  @ApiProperty({ description: 'Contact to remove (notes + csat rows reassigned to primary)' })
  @IsString()
  @IsUUID()
  secondaryId!: string;
}
