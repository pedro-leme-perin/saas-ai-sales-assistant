// =============================================
// 🚨 SLA Escalation DTOs (Session 57 — Feature A2)
// =============================================

import { ChatPriority, SlaEscalationAction } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateSlaEscalationDto {
  @IsUUID()
  policyId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  level!: number;

  @IsInt()
  @Min(1)
  @Max(10_080) // ≤ 7 days
  triggerAfterMins!: number;

  @IsEnum(SlaEscalationAction)
  action!: SlaEscalationAction;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  @ValidateIf((o: CreateSlaEscalationDto) => o.action === SlaEscalationAction.REASSIGN_TO_USER)
  targetUserIds?: string[];

  @IsOptional()
  @IsEnum(ChatPriority)
  @ValidateIf((o: CreateSlaEscalationDto) => o.action === SlaEscalationAction.CHANGE_PRIORITY)
  targetPriority?: ChatPriority;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSlaEscalationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_080)
  triggerAfterMins?: number;

  @IsOptional()
  @IsEnum(SlaEscalationAction)
  action?: SlaEscalationAction;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsEnum(ChatPriority)
  targetPriority?: ChatPriority;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
