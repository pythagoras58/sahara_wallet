import { IsIn, IsString, MinLength } from 'class-validator';

export const ID_TYPES = ['passport', 'national_id', 'drivers_license'] as const;
export type IdType = (typeof ID_TYPES)[number];

export class SubmitKycDto {
  @IsIn(ID_TYPES)
  idType!: IdType;

  @IsString()
  @MinLength(2)
  idNumber!: string;

  @IsString()
  @MinLength(2)
  country!: string;
}
