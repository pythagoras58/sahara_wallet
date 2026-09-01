import { IsNumber, Max, Min } from 'class-validator';

export class DepositDto {
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.01)
  @Max(1_000_000)
  amountUsdc!: number;
}
