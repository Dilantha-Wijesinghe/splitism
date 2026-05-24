import { z } from "zod";
import type { Ledger } from "@/lib/types";
import { createEmptyLedger } from "@/lib/ledger";

const STORAGE_KEY = "split.ledger.v1";

const splitSchema = z.object({
  personId: z.string().min(1),
  amountMinor: z.number().int().nonnegative()
});

const expenseSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  amountMinor: z.number().int().positive(),
  payerId: z.string().min(1),
  date: z.string().min(1),
  createdAt: z.string().min(1),
  splitMode: z.enum(["equal", "exact"]),
  splits: z.array(splitSchema).min(1)
});

const ledgerSchema = z.object({
  schemaVersion: z.literal(1),
  currency: z.string().min(3).max(3),
  people: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      createdAt: z.string().min(1)
    })
  ),
  expenses: z.array(expenseSchema),
  updatedAt: z.string().min(1)
});

export function loadLedger() {
  if (typeof window === "undefined") {
    return { ledger: createEmptyLedger(), error: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ledger: createEmptyLedger(), error: null };
  }

  try {
    const parsed = ledgerSchema.parse(JSON.parse(raw));
    return { ledger: parsed satisfies Ledger, error: null };
  } catch {
    return {
      ledger: createEmptyLedger(),
      error:
        "Saved browser data could not be read. Export backups are still safe to import."
    };
  }
}

export function saveLedger(ledger: Ledger) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}

export function clearLedgerStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
}
