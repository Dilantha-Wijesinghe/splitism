import Papa from "papaparse";
import { z } from "zod";
import type { Expense, ExpensePayment, Ledger, Payment, Person } from "@/lib/types";
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
  "personId",
  "fromPersonId",
  "toPersonId",
  "note"
];

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

const rowSchema = z.object({
  recordType: z.enum(["metadata", "person", "expense", "expensePayment", "split", "payment"]),
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
  personId: z.string().optional().default(""),
  fromPersonId: z.string().optional().default(""),
  toPersonId: z.string().optional().default(""),
  note: z.string().optional().default("")
});

export interface ImportPreview {
  ledger: Ledger;
  peopleCount: number;
  expenseCount: number;
  paymentCount: number;
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
        date: expense.date,
        createdAt: expense.createdAt,
        splitMode: expense.splitMode
      })
    );

    for (const payment of expense.payments) {
      rows.push(
        makeRow({
          recordType: "expensePayment",
          expenseId: expense.id,
          personId: payment.personId,
          amountMinor: String(payment.amountMinor)
        })
      );
    }

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

  for (const payment of ledger.payments) {
    rows.push(
      makeRow({
        recordType: "payment",
        id: payment.id,
        fromPersonId: payment.fromPersonId,
        toPersonId: payment.toPersonId,
        amountMinor: String(payment.amountMinor),
        date: payment.date,
        note: payment.note,
        createdAt: payment.createdAt
      })
    );
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
  const schemaVersion = metadata.schemaVersion;
  if (schemaVersion !== "1" && schemaVersion !== "2" && schemaVersion !== "3") {
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
      return { id: row.id, name: row.name, createdAt: row.createdAt };
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

  const paymentRowsByExpense = new Map<string, typeof rows>();
  for (const row of rows.filter((item) => item.recordType === "expensePayment")) {
    if (!row.expenseId || !row.personId || !row.amountMinor) {
      throw new Error("An expensePayment row is missing expense, person, or amount data.");
    }
    if (!personIds.has(row.personId)) {
      throw new Error("An expensePayment row references a person that does not exist.");
    }
    const current = paymentRowsByExpense.get(row.expenseId) ?? [];
    current.push(row);
    paymentRowsByExpense.set(row.expenseId, current);
  }

  const expenses = rows
    .filter((row) => row.recordType === "expense")
    .map<Expense>((row) => {
      if (
        !row.id ||
        !row.description ||
        !row.amountMinor ||
        !row.date ||
        !row.createdAt ||
        !row.splitMode
      ) {
        throw new Error("An expense row is missing required data.");
      }
      if (row.splitMode !== "equal" && row.splitMode !== "exact") {
        throw new Error("An expense row has an unsupported split mode.");
      }

      const amountMinor = parsePositiveInteger(row.amountMinor, "expense amount");

      // V3: expensePayment rows. V1/V2: payerId column fallback.
      let payments: ExpensePayment[];
      const paymentRows = paymentRowsByExpense.get(row.id);
      if (paymentRows && paymentRows.length > 0) {
        payments = paymentRows.map((pr) => ({
          personId: pr.personId,
          amountMinor: parsePositiveInteger(pr.amountMinor, "payer amount")
        }));
      } else if (row.payerId) {
        if (!personIds.has(row.payerId)) {
          throw new Error("An expense row references a payer that does not exist.");
        }
        payments = [{ personId: row.payerId, amountMinor }];
      } else {
        throw new Error(`Expense "${row.description}" has no payer data.`);
      }

      const payerTotal = payments.reduce((t, p) => t + p.amountMinor, 0);
      if (payerTotal !== amountMinor) {
        throw new Error(`Expense "${row.description}" payer amounts do not match the total.`);
      }

      const splits = (splitRowsByExpense.get(row.id) ?? []).map((splitRow) => ({
        personId: splitRow.personId,
        amountMinor: parseNonnegativeInteger(splitRow.amountMinor, "split amount")
      }));
      const splitTotal = splits.reduce((total, split) => total + split.amountMinor, 0);

      if (splits.length === 0) {
        throw new Error(`Expense "${row.description}" has no split rows.`);
      }
      if (splitTotal !== amountMinor) {
        throw new Error(`Expense "${row.description}" split amounts do not match the total.`);
      }

      return {
        id: row.id,
        description: row.description,
        amountMinor,
        payments,
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

  const payments = rows
    .filter((row) => row.recordType === "payment")
    .map<Payment>((row) => {
      if (!row.id || !row.fromPersonId || !row.toPersonId || !row.amountMinor || !row.date || !row.createdAt) {
        throw new Error("A payment row is missing required data.");
      }
      if (!personIds.has(row.fromPersonId)) {
        throw new Error("A payment row references a sender that does not exist.");
      }
      if (!personIds.has(row.toPersonId)) {
        throw new Error("A payment row references a receiver that does not exist.");
      }
      if (row.fromPersonId === row.toPersonId) {
        throw new Error("A payment row has the same sender and receiver.");
      }

      return {
        id: row.id,
        fromPersonId: row.fromPersonId,
        toPersonId: row.toPersonId,
        amountMinor: parsePositiveInteger(row.amountMinor, "payment amount"),
        date: row.date,
        note: row.note,
        createdAt: row.createdAt
      };
    });

  const paymentIds = new Set(payments.map((p) => p.id));
  if (paymentIds.size !== payments.length) {
    throw new Error("CSV contains duplicate payments.");
  }

  const ledger: Ledger = {
    ...createEmptyLedger(metadata.currency),
    people,
    expenses,
    payments,
    updatedAt: new Date().toISOString()
  };

  return {
    ledger,
    peopleCount: people.length,
    expenseCount: expenses.length,
    paymentCount: payments.length,
    totalMinor: expenses.reduce((total, expense) => total + expense.amountMinor, 0)
  };
}

function makeRow(row: Partial<CsvRow>): CsvRow {
  return Object.fromEntries(
    CSV_COLUMNS.map((column) => [column, row[column] ?? ""])
  ) as CsvRow;
}

function parsePositiveInteger(value: string, label: string) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}.`);
  }
  return parsed;
}

function parseNonnegativeInteger(value: string, label: string) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}.`);
  }
  return parsed;
}
