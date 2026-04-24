// =============================================
// 📈 CSAT trends query DTO (Session 59 — Feature A2)
// =============================================
// Validates /csat/trends query params:
//   - since/until: ISO-8601 date strings (max window 180 days)
//   - bucket: 'day' | 'week' | 'month' (default day)
//   - groupBy: 'agent' | 'tag' | 'channel' | null (breakdown axis)
//   - channel: optional filter (WHATSAPP | EMAIL)
//   - trigger: optional filter (CALL_END | CHAT_CLOSE)

import { CsatChannel, CsatTrigger } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export type TrendBucket = 'day' | 'week' | 'month';
export type TrendGroupBy = 'agent' | 'tag' | 'channel';

export class TrendsQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'since must be ISO-8601 date' })
  since?: string;

  @IsOptional()
  @IsDateString({}, { message: 'until must be ISO-8601 date' })
  until?: string;

  @IsOptional()
  @IsEnum(['day', 'week', 'month'], { message: 'bucket must be day|week|month' })
  bucket?: TrendBucket;

  @IsOptional()
  @IsEnum(['agent', 'tag', 'channel'], { message: 'groupBy must be agent|tag|channel' })
  groupBy?: TrendGroupBy;

  @IsOptional()
  @IsEnum(CsatChannel)
  channel?: CsatChannel;

  @IsOptional()
  @IsEnum(CsatTrigger)
  trigger?: CsatTrigger;
}
