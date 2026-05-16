
export type TransactionType = 'deposito' | 'retiro' | 'transferencia' | 'ajuste';

export interface BankAccount {
  id: string;
  accountName: string;
  bank: string;
  initialBalance: number;
  currentBalance: number;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  type: TransactionType;
  date: string;
  documentNumber?: string;
  amount: number;
  concept: string;
  resultingBalance: number;
  createdAt: string;
}
