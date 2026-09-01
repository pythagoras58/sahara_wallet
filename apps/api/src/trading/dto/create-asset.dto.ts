import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  issuer!: string;

  @IsString()
  @MinLength(2)
  chain!: string;

  @IsOptional()
  @IsString()
  contractAddress?: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  minOrderUsdc!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  feeBps?: number;

  /** CoinGecko coin id (e.g. "ethereum") for live pricing. Leave unset for mock pricing. */
  @IsOptional()
  @IsString()
  coingeckoId?: string;
}
