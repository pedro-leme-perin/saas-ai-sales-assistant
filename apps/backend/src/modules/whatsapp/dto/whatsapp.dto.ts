import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsUrl,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ChatStatus, ChatPriority, MessageType, MessageDirection } from '@prisma/client';

export class CreateChatDto {
  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'customerPhone must be E.164 format (e.g. +5511999999999)',
  })
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateChatDto {
  @ApiPropertyOptional({ enum: ChatStatus })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;

  @ApiPropertyOptional({ enum: ChatPriority })
  @IsOptional()
  @IsEnum(ChatPriority)
  priority?: ChatPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4096, { message: 'content exceeds WhatsApp message limit (4096 chars)' })
  content!: string;

  @ApiPropertyOptional({ enum: MessageType, default: 'TEXT' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ enum: MessageDirection, default: 'OUTGOING' })
  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiSuggestionUsed?: boolean;
}

export class ChatFilterDto {
  @ApiPropertyOptional({ enum: ChatStatus })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;

  @ApiPropertyOptional({ enum: ChatPriority })
  @IsOptional()
  @IsEnum(ChatPriority)
  priority?: ChatPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
