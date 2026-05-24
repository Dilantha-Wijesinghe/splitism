export type PersonId = string;
export type ExpenseId = string;
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

export interface Ledger {
  schemaVersion: 1;
  currency: string;
  people: Person[];
  expenses: Expense[];
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
