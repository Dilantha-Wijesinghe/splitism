import { z } from "zod";
import type { Ledger } from "@/lib/types";
import { createEmptyLedger } from "@/lib/ledger";

const STORAGE_KEY = "split.ledger.v1";

const splitSchema = z.object({
  personId: z.string().min(1),
  amountMinor: z.number().int().nonnegative()
});

const expensePaymentSchema = z.object({
  personId: z.string().min(1),
  amountMinor: z.number().int().positive()
});

const expenseSchemaV3 = z.object({
  id: z.string().min(1),
  description: z.string().max(500),
  amountMinor: z.number().int().positive(),
  payments: z.array(expensePaymentSchema).min(1),
  date: z.string().min(1),
  createdAt: z.string().min(1),
  splitMode: z.enum(["equal", "exact"]),
  splits: z.array(splitSchema).min(1)
});

const expenseSchemaV2 = z.object({
  id: z.string().min(1),
  description: z.string().max(500),
  amountMinor: z.number().int().positive(),
  payerId: z.string().min(1),
  date: z.string().min(1),
  createdAt: z.string().min(1),
  splitMode: z.enum(["equal", "exact"]),
  splits: z.array(splitSchema).min(1)
});

const paymentSchema = z.object({
  id: z.string().min(1),
  fromPersonId: z.string().min(1),
  toPersonId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  date: z.string().min(1),
  note: z.string().max(500),
  createdAt: z.string().min(1)
});

const personSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  createdAt: z.string().min(1)
});

const ledgerSchemaV3 = z.object({
  schemaVersion: z.literal(3),
  currency: z.string().min(3).max(3),
  people: z.array(personSchema),
  expenses: z.array(expenseSchemaV3),
  payments: z.array(paymentSchema),
  updatedAt: z.string().min(1)
});

const ledgerSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  currency: z.string().min(3).max(3),
  people: z.array(personSchema),
  expenses: z.array(expenseSchemaV2),
  payments: z.array(paymentSchema),
  updatedAt: z.string().min(1)
});

const ledgerSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  currency: z.string().min(3).max(3),
  people: z.array(personSchema),
  expenses: z.array(expenseSchemaV2),
  updatedAt: z.string().min(1)
});

export function loadLedger(): { ledger: Ledger; error: string | null } {
  if (typeof window === "undefined") {
    return { ledger: createEmptyLedger(), error: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ledger: createEmptyLedger(), error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ledger: createEmptyLedger(),
      error: "Saved browser data could not be read. Export backups are still safe to import."
    };
  }

  const v3Result = ledgerSchemaV3.safeParse(parsed);
  if (v3Result.success) {
    return { ledger: v3Result.data satisfies Ledger, error: null };
  }

  const v2Result = ledgerSchemaV2.safeParse(parsed);
  if (v2Result.success) {
    const migrated: Ledger = {
      ...v2Result.data,
      schemaVersion: 3,
      expenses: v2Result.data.expenses.map(({ payerId, ...rest }) => ({
        ...rest,
        payments: [{ personId: payerId, amountMinor: rest.amountMinor }]
      }))
    };
    return { ledger: migrated, error: null };
  }

  const v1Result = ledgerSchemaV1.safeParse(parsed);
  if (v1Result.success) {
    const migrated: Ledger = {
      ...v1Result.data,
      schemaVersion: 3,
      payments: [],
      expenses: v1Result.data.expenses.map(({ payerId, ...rest }) => ({
        ...rest,
        payments: [{ personId: payerId, amountMinor: rest.amountMinor }]
      }))
    };
    return { ledger: migrated, error: null };
  }

  return {
    ledger: createEmptyLedger(),
    error: "Saved browser data could not be read. Export backups are still safe to import."
  };
}

export function saveLedger(ledger: Ledger) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}

export function clearLedgerStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
}
