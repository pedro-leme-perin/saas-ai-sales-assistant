// =============================================
// 📄 CreateScheduledMessageDto (Session 56)
// =============================================

import { IsISO8601, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class CreateScheduledMessageDto {
  @IsString()
  @Length(1, 4096)
  content!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  mediaUrl?: string;

  /** ISO-8601 UTC timestamp. Must be strictly in the future. */
  @IsISO8601()
  scheduledAt!: string;
}
