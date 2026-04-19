import { IsEnum, IsOptional } from 'class-validator';
import { GoalPeriodType } from '@prisma/client';

export class LeaderboardQueryDto {
  @IsOptional()
  @IsEnum(GoalPeriodType)
  period?: GoalPeriodType;
}
