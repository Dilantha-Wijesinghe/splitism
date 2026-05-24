import { describe, expect, it } from "vitest";
import { exportLedgerToCsv, parseLedgerCsv } from "@/lib/csv";
import type { Ledger } from "@/lib/types";

const ledger: Ledger = {
  schemaVersion: 1,
  currency: "USD",
  updatedAt: "2026-01-01T00:00:00.000Z",
  people: [
    { id: "p1", name: "Ari", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "p2", name: "Bea", createdAt: "2026-01-01T00:00:00.000Z" }
  ],
  expenses: [
    {
      id: "e1",
      description: "Coffee",
      amountMinor: 1200,
      payerId: "p1",
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      splitMode: "equal",
      splits: [
        { personId: "p1", amountMinor: 600 },
        { personId: "p2", amountMinor: 600 }
      ]
    }
  ]
};

describe("CSV import/export", () => {
  it("roundtrips a ledger", () => {
    const csv = exportLedgerToCsv(ledger);
    const preview = parseLedgerCsv(csv);

    expect(preview.peopleCount).toBe(2);
    expect(preview.expenseCount).toBe(1);
    expect(preview.ledger.currency).toBe("USD");
    expect(preview.ledger.expenses[0].splits).toEqual(ledger.expenses[0].splits);
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      parseLedgerCsv(
        "recordType,schemaVersion,currency\nmetadata,99,USD\n"
      )
    ).toThrow("CSV schema version is not supported.");
  });
});
