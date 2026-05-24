export type PersonId = string;
export type ExpenseId = string;
export type PaymentId = string;
export type SplitMode = "equal" | "exact";

export interface Person {
  id: PersonId;
  name: string;
  createdAt: string;
}

export interface ExpenseSplit {
  personId: PersonId;
  amountMinor: number;
}

export interface Expense {
  id: ExpenseId;
  description: string;
  amountMinor: number;
  payerId: PersonId;
  date: string;
  createdAt: string;
  splitMode: SplitMode;
  splits: ExpenseSplit[];
}

export interface Payment {
  id: PaymentId;
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amountMinor: number;
  date: string;
  note: string;
  createdAt: string;
}

export interface Ledger {
  schemaVersion: 2;
  currency: string;
  people: Person[];
  expenses: Expense[];
  payments: Payment[];
  updatedAt: string;
}

export interface PersonBalance {
  personId: PersonId;
  paidMinor: number;
  owedMinor: number;
  netMinor: number;
}

export interface Settlement {
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amountMinor: number;
}

export interface AppError {
  title: string;
  message: string;
}
