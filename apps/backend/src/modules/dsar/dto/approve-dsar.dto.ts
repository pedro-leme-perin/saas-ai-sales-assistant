// =============================================
// ✅ ApproveDsarDto (S60a)
// =============================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveDsarDto {
  /**
   * Free-form approval note appended to the audit trail (oldValues/newValues).
   * Optional — manager may approve silently for routine LGPD requests.
   */
  @ApiPropertyOptional({ description: 'Approval note for audit trail', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
