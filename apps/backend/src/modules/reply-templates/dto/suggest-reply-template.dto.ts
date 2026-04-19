// =============================================
// 📄 SUGGEST REPLY TEMPLATE DTO (Session 46)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReplyTemplateChannel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Payload for POST /reply-templates/suggest.
 * Accepts a channel hint + the last customer message/transcript snippet.
 * Service ranks existing templates via LLM and returns top matches.
 */
export class SuggestReplyTemplateDto {
  @ApiProperty({ enum: ReplyTemplateChannel, example: 'WHATSAPP' })
  @IsEnum(ReplyTemplateChannel)
  channel!: ReplyTemplateChannel;

  @ApiProperty({ example: 'Oi, ainda está disponível o plano com 20% de desconto?' })
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  context!: string;

  @ApiPropertyOptional({ example: 'Follow-up' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
