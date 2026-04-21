// =============================================
// 💓 HeartbeatDto (Session 57 — Feature A1)
// =============================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgentStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class HeartbeatDto {
  @ApiPropertyOptional({ enum: AgentStatus, default: AgentStatus.ONLINE })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  statusMessage?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxConcurrentChats?: number;
}
