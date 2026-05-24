import { describe, expect, it } from "vitest";
import { exportLedgerToCsv, parseLedgerCsv } from "@/lib/csv";
import type { Ledger } from "@/lib/types";

const ledger: Ledger = {
  schemaVersion: 3,
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
      payments: [{ personId: "p1", amountMinor: 1200 }],
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      splitMode: "equal",
      splits: [
        { personId: "p1", amountMinor: 600 },
        { personId: "p2", amountMinor: 600 }
      ]
    }
  ],
  payments: []
};

describe("CSV import/export", () => {
  it("roundtrips a ledger without payments", () => {
    const csv = exportLedgerToCsv(ledger);
    const preview = parseLedgerCsv(csv);

    expect(preview.peopleCount).toBe(2);
    expect(preview.expenseCount).toBe(1);
    expect(preview.paymentCount).toBe(0);
    expect(preview.ledger.currency).toBe("USD");
    expect(preview.ledger.expenses[0].splits).toEqual(ledger.expenses[0].splits);
    expect(preview.ledger.payments).toEqual([]);
  });

  it("roundtrips a ledger with payments", () => {
    const ledgerWithPayment: Ledger = {
      ...ledger,
      payments: [
        {
          id: "pay1",
          fromPersonId: "p2",
          toPersonId: "p1",
          amountMinor: 600,
          date: "2026-01-02",
          note: "Cash",
          createdAt: "2026-01-02T00:00:00.000Z"
        }
      ]
    };

    const csv = exportLedgerToCsv(ledgerWithPayment);
    const preview = parseLedgerCsv(csv);

    expect(preview.paymentCount).toBe(1);
    const p = preview.ledger.payments[0];
    expect(p.id).toBe("pay1");
    expect(p.fromPersonId).toBe("p2");
    expect(p.toPersonId).toBe("p1");
    expect(p.amountMinor).toBe(600);
    expect(p.note).toBe("Cash");
  });

  it("imports a v2 CSV with payerId column and converts to payments array", () => {
    // columns: recordType,schemaVersion,currency,exportedAt,id,name,description,amountMinor,payerId,date,createdAt,splitMode,expenseId,personId,fromPersonId,toPersonId,note
    const v2Csv = [
      "recordType,schemaVersion,currency,exportedAt,id,name,description,amountMinor,payerId,date,createdAt,splitMode,expenseId,personId,fromPersonId,toPersonId,note",
      "metadata,2,USD,2026-01-01T00:00:00.000Z,,,,,,,,,,,,,",
      "person,,,,p1,Ari,,,,,2026-01-01T00:00:00.000Z,,,,,,",
      "person,,,,p2,Bea,,,,,2026-01-01T00:00:00.000Z,,,,,,",
      "expense,,,,e1,,Coffee,1200,p1,2026-01-01,2026-01-01T00:00:00.000Z,equal,,,,,",
      "split,,,,,,,600,,,,,e1,p1,,,",
      "split,,,,,,,600,,,,,e1,p2,,,"
    ].join("\n");

    const preview = parseLedgerCsv(v2Csv);
    expect(preview.ledger.payments).toEqual([]);
    expect(preview.paymentCount).toBe(0);
    expect(preview.ledger.expenses[0].payments).toEqual([
      { personId: "p1", amountMinor: 1200 }
    ]);
  });

  it("rejects a payment referencing an unknown person", () => {
    const ledgerWithBadPayment: Ledger = {
      ...ledger,
      payments: [
        {
          id: "pay1",
          fromPersonId: "p_unknown",
          toPersonId: "p1",
          amountMinor: 600,
          date: "2026-01-02",
          note: "",
          createdAt: "2026-01-02T00:00:00.000Z"
        }
      ]
    };

    const csv = exportLedgerToCsv(ledgerWithBadPayment);
    expect(() => parseLedgerCsv(csv)).toThrow("sender that does not exist");
  });

  it("rejects a payment with the same sender and receiver", () => {
    // Build a valid ledger with one person, then export a modified CSV where
    // a payment has fromPersonId === toPersonId
    const singlePersonLedger: Ledger = {
      ...ledger,
      payments: [
        {
          id: "pay1",
          fromPersonId: "p1",
          toPersonId: "p2",
          amountMinor: 600,
          date: "2026-01-02",
          note: "",
          createdAt: "2026-01-02T00:00:00.000Z"
        }
      ]
    };
    const csv = exportLedgerToCsv(singlePersonLedger).replace(
      /p1,p2/,
      "p1,p1"
    );
    expect(() => parseLedgerCsv(csv)).toThrow("same sender and receiver");
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      parseLedgerCsv(
        "recordType,schemaVersion,currency\nmetadata,99,USD\n"
      )
    ).toThrow("CSV schema version is not supported.");
  });
});
