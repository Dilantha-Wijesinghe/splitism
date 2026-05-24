import { describe, expect, it } from "vitest";
import {
  buildEqualSplits,
  calculateBalances,
  calculateSettlements
} from "@/lib/ledger";
import type { Ledger } from "@/lib/types";

const people = [
  { id: "p1", name: "Ari", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "p2", name: "Bea", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "p3", name: "Chen", createdAt: "2026-01-01T00:00:00.000Z" }
];

describe("ledger calculations", () => {
  it("distributes equal split remainders deterministically", () => {
    expect(buildEqualSplits(100, ["p1", "p2", "p3"])).toEqual([
      { personId: "p1", amountMinor: 34 },
      { personId: "p2", amountMinor: 33 },
      { personId: "p3", amountMinor: 33 }
    ]);
  });

  it("calculates balances and settlements", () => {
    const ledger: Ledger = {
      schemaVersion: 1,
      currency: "USD",
      people,
      updatedAt: "2026-01-01T00:00:00.000Z",
      expenses: [
        {
          id: "e1",
          description: "Dinner",
          amountMinor: 9000,
          payerId: "p1",
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
    expect(balances.find((item) => item.personId === "p1")?.netMinor).toBe(6000);
    expect(calculateSettlements(balances)).toEqual([
      { fromPersonId: "p2", toPersonId: "p1", amountMinor: 3000 },
      { fromPersonId: "p3", toPersonId: "p1", amountMinor: 3000 }
    ]);
  });
});
