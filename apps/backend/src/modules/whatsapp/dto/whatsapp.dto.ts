import { IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatStatus, ChatPriority, MessageType, MessageDirection } from '@prisma/client';

export class CreateChatDto {
  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
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
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
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
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
