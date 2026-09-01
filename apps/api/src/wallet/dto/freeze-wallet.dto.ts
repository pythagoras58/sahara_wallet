import { IsOptional, IsString, MinLength } from 'class-validator';

export class FreezeWalletDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
