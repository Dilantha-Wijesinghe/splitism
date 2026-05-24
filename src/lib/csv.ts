import Papa from "papaparse";
import { z } from "zod";
import type { Expense, Ledger, Person } from "@/lib/types";
import { createEmptyLedger } from "@/lib/ledger";

const CSV_COLUMNS = [
  "recordType",
  "schemaVersion",
  "currency",
  "exportedAt",
  "id",
  "name",
  "description",
  "amountMinor",
  "payerId",
  "date",
  "createdAt",
  "splitMode",
  "expenseId",
  "personId"
];

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

const rowSchema = z.object({
  recordType: z.enum(["metadata", "person", "expense", "split"]),
  schemaVersion: z.string().optional().default(""),
  currency: z.string().optional().default(""),
  exportedAt: z.string().optional().default(""),
  id: z.string().optional().default(""),
  name: z.string().optional().default(""),
  description: z.string().optional().default(""),
  amountMinor: z.string().optional().default(""),
  payerId: z.string().optional().default(""),
  date: z.string().optional().default(""),
  createdAt: z.string().optional().default(""),
  splitMode: z.string().optional().default(""),
  expenseId: z.string().optional().default(""),
  personId: z.string().optional().default("")
});

export interface ImportPreview {
  ledger: Ledger;
  peopleCount: number;
  expenseCount: number;
  totalMinor: number;
}

export function exportLedgerToCsv(ledger: Ledger) {
  const rows: CsvRow[] = [
    makeRow({
      recordType: "metadata",
      schemaVersion: String(ledger.schemaVersion),
      currency: ledger.currency,
      exportedAt: new Date().toISOString()
    })
  ];

  for (const person of ledger.people) {
    rows.push(
      makeRow({
        recordType: "person",
        id: person.id,
        name: person.name,
        createdAt: person.createdAt
      })
    );
  }

  for (const expense of ledger.expenses) {
    rows.push(
      makeRow({
        recordType: "expense",
        id: expense.id,
        description: expense.description,
        amountMinor: String(expense.amountMinor),
        payerId: expense.payerId,
        date: expense.date,
        createdAt: expense.createdAt,
        splitMode: expense.splitMode
      })
    );

    for (const split of expense.splits) {
      rows.push(
        makeRow({
          recordType: "split",
          expenseId: expense.id,
          personId: split.personId,
          amountMinor: String(split.amountMinor)
        })
      );
    }
  }

  return Papa.unparse(rows, { columns: CSV_COLUMNS, newline: "\n" });
}

export function parseLedgerCsv(csv: string): ImportPreview {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    throw new Error(
      `CSV parse error on row ${firstError.row ?? "unknown"}: ${firstError.message}`
    );
  }

  const rows = parsed.data.map((row, index) => {
    const result = rowSchema.safeParse(row);
    if (!result.success) {
      throw new Error(`Row ${index + 2} has an invalid record type.`);
    }
    return result.data;
  });

  const metadata = rows.find((row) => row.recordType === "metadata");
  if (!metadata) {
    throw new Error("CSV is missing a metadata row.");
  }
  if (metadata.schemaVersion !== "1") {
    throw new Error("CSV schema version is not supported.");
  }
  if (!/^[A-Z]{3}$/.test(metadata.currency)) {
    throw new Error("CSV metadata must include a three-letter currency code.");
  }

  const people = rows
    .filter((row) => row.recordType === "person")
    .map<Person>((row, index) => {
      if (!row.id || !row.name || !row.createdAt) {
        throw new Error(`Person row ${index + 1} is missing required data.`);
      }

      return {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt
      };
    });

  const personIds = new Set(people.map((person) => person.id));
  if (personIds.size !== people.length) {
    throw new Error("CSV contains duplicate people.");
  }

  const splitRowsByExpense = new Map<string, typeof rows>();
  for (const row of rows.filter((item) => item.recordType === "split")) {
    if (!row.expenseId || !row.personId || !row.amountMinor) {
      throw new Error("A split row is missing expense, person, or amount data.");
    }
    if (!personIds.has(row.personId)) {
      throw new Error("A split row references a person that does not exist.");
    }
    const current = splitRowsByExpense.get(row.expenseId) ?? [];
    current.push(row);
    splitRowsByExpense.set(row.expenseId, current);
  }

  const expenses = rows
    .filter((row) => row.recordType === "expense")
    .map<Expense>((row) => {
      if (
        !row.id ||
        !row.description ||
        !row.amountMinor ||
        !row.payerId ||
        !row.date ||
        !row.createdAt ||
        !row.splitMode
      ) {
        throw new Error("An expense row is missing required data.");
      }
      if (!personIds.has(row.payerId)) {
        throw new Error("An expense row references a payer that does not exist.");
      }
      if (row.splitMode !== "equal" && row.splitMode !== "exact") {
        throw new Error("An expense row has an unsupported split mode.");
      }

      const amountMinor = parseInteger(row.amountMinor, "expense amount");
      const splits = (splitRowsByExpense.get(row.id) ?? []).map((splitRow) => ({
        personId: splitRow.personId,
        amountMinor: parseInteger(splitRow.amountMinor, "split amount")
      }));
      const splitTotal = splits.reduce(
        (total, split) => total + split.amountMinor,
        0
      );

      if (splits.length === 0) {
        throw new Error(`Expense "${row.description}" has no split rows.`);
      }
      if (splitTotal !== amountMinor) {
        throw new Error(
          `Expense "${row.description}" split amounts do not match the total.`
        );
      }

      return {
        id: row.id,
        description: row.description,
        amountMinor,
        payerId: row.payerId,
        date: row.date,
        createdAt: row.createdAt,
        splitMode: row.splitMode,
        splits
      };
    });

  const expenseIds = new Set(expenses.map((expense) => expense.id));
  if (expenseIds.size !== expenses.length) {
    throw new Error("CSV contains duplicate expenses.");
  }

  const ledger: Ledger = {
    ...createEmptyLedger(metadata.currency),
    people,
    expenses,
    updatedAt: new Date().toISOString()
  };

  return {
    ledger,
    peopleCount: people.length,
    expenseCount: expenses.length,
    totalMinor: expenses.reduce((total, expense) => total + expense.amountMinor, 0)
  };
}

function makeRow(row: Partial<CsvRow>): CsvRow {
  return Object.fromEntries(
    CSV_COLUMNS.map((column) => [column, row[column] ?? ""])
  ) as CsvRow;
}

function parseInteger(value: string, label: string) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}.`);
  }
  return parsed;
}
