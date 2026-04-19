import { IsInt, Max, Min } from 'class-validator';

export class UpdateGoalDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  target!: number;
}
