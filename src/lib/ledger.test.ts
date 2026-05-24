import { describe, expect, it } from "vitest";
import {
  buildEqualSplits,
  calculateBalances,
  calculateSettlements,
  getTotalSpent
} from "@/lib/ledger";
import type { Ledger } from "@/lib/types";

const people = [
  { id: "p1", name: "Ari", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "p2", name: "Bea", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "p3", name: "Chen", createdAt: "2026-01-01T00:00:00.000Z" }
];

const baseLedger: Ledger = {
  schemaVersion: 3,
  currency: "USD",
  people,
  updatedAt: "2026-01-01T00:00:00.000Z",
  expenses: [],
  payments: []
};

describe("ledger calculations", () => {
  it("distributes equal split remainders deterministically", () => {
    expect(buildEqualSplits(100, ["p1", "p2", "p3"])).toEqual([
      { personId: "p1", amountMinor: 34 },
      { personId: "p2", amountMinor: 33 },
      { personId: "p3", amountMinor: 33 }
    ]);
  });

  it("calculates balances and settlements from expenses", () => {
    const ledger: Ledger = {
      ...baseLedger,
      expenses: [
        {
          id: "e1",
          description: "Dinner",
          amountMinor: 9000,
          payments: [{ personId: "p1", amountMinor: 9000 }],
          date: "2026-01-01",
          createdAt: "2026-01-01T00:00:00.000Z",
          splitMode: "equal",
          splits: [
            { personId: "p1", amountMinor: 3000 },
            { personId: "p2", amountMinor: 3000 },
            { personId: "p3", amountMinor: 3000 }
          ]
        }
      ]
    };

    const balances = calculateBalances(ledger);
    expect(balances.find((b) => b.personId === "p1")?.netMinor).toBe(6000);
    expect(calculateSettlements(balances)).toEqual([
      { fromPersonId: "p2", toPersonId: "p1", amountMinor: 3000 },
      { fromPersonId: "p3", toPersonId: "p1", amountMinor: 3000 }
    ]);
  });

  it("payments do not increase total spent", () => {
    const ledger: Ledger = {
      ...baseLedger,
      expenses: [
        {
          id: "e1",
          description: "Cake",
          amountMinor: 540000,
          payments: [{ personId: "p1", amountMinor: 540000 }],
          date: "2026-05-24",
          createdAt: "2026-05-24T00:00:00.000Z",
          splitMode: "equal",
          splits: [
            { personId: "p1", amountMinor: 180000 },
            { personId: "p2", amountMinor: 180000 },
            { personId: "p3", amountMinor: 180000 }
          ]
        }
      ],
      payments: [
        {
          id: "pay1",
          fromPersonId: "p3",
          toPersonId: "p1",
          amountMinor: 60000,
          date: "2026-05-24",
          note: "Cash top-up",
          createdAt: "2026-05-24T01:00:00.000Z"
        }
      ]
    };

    expect(getTotalSpent(ledger)).toBe(540000);
  });

  it("payments adjust net balances correctly (cake scenario)", () => {
    // Dilantha (p1) paid 5400 for cake. Equal split among 3 → each owes 1800.
    // Nawishka (p3) pays Dilantha (p1) 600 cash.
    // Expected: p1 net = +3000, p2 net = -1800, p3 net = -1200.
    const ledger: Ledger = {
      ...baseLedger,
      expenses: [
        {
          id: "e1",
          description: "Cake",
          amountMinor: 540000,
          payments: [{ personId: "p1", amountMinor: 540000 }],
          date: "2026-05-24",
          createdAt: "2026-05-24T00:00:00.000Z",
          splitMode: "equal",
          splits: [
            { personId: "p1", amountMinor: 180000 },
            { personId: "p2", amountMinor: 180000 },
            { personId: "p3", amountMinor: 180000 }
          ]
        }
      ],
      payments: [
        {
          id: "pay1",
          fromPersonId: "p3",
          toPersonId: "p1",
          amountMinor: 60000,
          date: "2026-05-24",
          note: "",
          createdAt: "2026-05-24T01:00:00.000Z"
        }
      ]
    };

    const balances = calculateBalances(ledger);
    expect(balances.find((b) => b.personId === "p1")?.netMinor).toBe(300000);
    expect(balances.find((b) => b.personId === "p2")?.netMinor).toBe(-180000);
    expect(balances.find((b) => b.personId === "p3")?.netMinor).toBe(-120000);

    const settlements = calculateSettlements(balances);
    expect(settlements).toEqual([
      { fromPersonId: "p2", toPersonId: "p1", amountMinor: 180000 },
      { fromPersonId: "p3", toPersonId: "p1", amountMinor: 120000 }
    ]);
  });
});
