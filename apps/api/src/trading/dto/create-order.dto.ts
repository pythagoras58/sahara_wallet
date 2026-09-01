import { IsIn, IsNumber, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  assetId!: string;

  @IsIn(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  /** For BUY: USDC amount to spend. For SELL: quantity of the asset to sell. */
  @IsNumber()
  @Min(0.000001)
  amount!: number;
}
