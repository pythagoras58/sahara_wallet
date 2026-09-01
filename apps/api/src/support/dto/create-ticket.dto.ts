import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const TICKET_CATEGORIES = [
  'deposit_issue',
  'withdrawal_issue',
  'kyc_question',
  'funds_missing',
  'account_access',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

const HIGH_PRIORITY_CATEGORIES: readonly TicketCategory[] = ['funds_missing', 'account_access'];

export function priorityForCategory(category: TicketCategory): 'HIGH' | 'NORMAL' {
  return HIGH_PRIORITY_CATEGORIES.includes(category) ? 'HIGH' : 'NORMAL';
}

export class CreateTicketDto {
  @IsIn(TICKET_CATEGORIES)
  category!: TicketCategory;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsOptional()
  @IsString()
  transactionRef?: string;
}
