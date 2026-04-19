// =============================================
// 📄 CREATE REPLY TEMPLATE DTO (Session 46)
// =============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReplyTemplateChannel } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReplyTemplateDto {
  @ApiProperty({ example: 'Follow-up 24h' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({ enum: ReplyTemplateChannel, example: 'BOTH' })
  @IsEnum(ReplyTemplateChannel)
  channel!: ReplyTemplateChannel;

  @ApiPropertyOptional({ example: 'Follow-up' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiProperty({
    example: 'Olá {{customerName}}, segue nossa proposta com {{discount}}% de desconto.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ type: [String], example: ['customerName', 'discount'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
