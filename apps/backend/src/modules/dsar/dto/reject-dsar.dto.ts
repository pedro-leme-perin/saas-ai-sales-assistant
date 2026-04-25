// =============================================
// ❌ RejectDsarDto (S60a)
// =============================================
// Reason is REQUIRED — LGPD requires the controller (Anthropic-tenant)
// to communicate the rationale to the data subject (Art. 18 §6).

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectDsarDto {
  @ApiProperty({
    description: 'Justification communicated to the data subject (LGPD Art. 18 §6)',
    minLength: 5,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}
