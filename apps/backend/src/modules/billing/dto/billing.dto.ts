import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateCheckoutDto {
  @ApiProperty({ enum: Plan })
  @IsEnum(Plan)
  plan!: Plan;
}

export class ChangePlanDto {
  @ApiProperty({ enum: Plan })
  @IsEnum(Plan)
  plan!: Plan;
}
