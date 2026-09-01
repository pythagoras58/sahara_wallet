import { IsString, MinLength } from 'class-validator';

export class RejectKycDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
