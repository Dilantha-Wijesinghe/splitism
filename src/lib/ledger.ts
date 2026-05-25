import type {
  Expense,
  ExpensePayment,
  ExpenseSplit,
  Ledger,
  Payment,
  Person,
  PersonBalance,
  Settlement
} from "@/lib/types";

export function createEmptyLedger(currency = "USD"): Ledger {
  return {
    schemaVersion: 3,
    currency,
    people: [],
    expenses: [],
    payments: [],
    updatedAt: new Date().toISOString()
  };
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function validatePersonName(name: string, people: Person[]) {
  const normalized = normalizeName(name);
  if (!normalized) {
    return "Enter a name.";
  }

  const exists = people.some(
    (person) => person.name.toLocaleLowerCase() === normalized.toLocaleLowerCase()
  );
  return exists ? "That person already exists." : null;
}

export function canRemovePerson(personId: string, ledger: Ledger) {
  const inExpenses = ledger.expenses.some(
    (expense) =>
      expense.payments.some((p) => p.personId === personId) ||
      expense.splits.some((split) => split.personId === personId)
  );
  if (inExpenses) return false;

  const inPayments = ledger.payments.some(
    (payment) =>
      payment.fromPersonId === personId || payment.toPersonId === personId
  );
  return !inPayments;
}

export function buildEqualSplits(
  amountMinor: number,
  participantIds: string[]
): ExpenseSplit[] {
  if (participantIds.length === 0) {
    return [];
  }

  const base = Math.floor(amountMinor / participantIds.length);
  let remainder = amountMinor - base * participantIds.length;

  return participantIds.map((personId) => {
    const amount = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return { personId, amountMinor: amount };
  });
}

export function sumSplits(splits: ExpenseSplit[]) {
  return splits.reduce((total, split) => total + split.amountMinor, 0);
}

export function sumPayments(payments: ExpensePayment[]) {
  return payments.reduce((total, payment) => total + payment.amountMinor, 0);
}

export function validateExpense(expense: Expense, people: Person[]) {
  const personIds = new Set(people.map((person) => person.id));
  const errors: string[] = [];

  if (!expense.description.trim()) {
    errors.push("Enter a description.");
  }
  if (!Number.isSafeInteger(expense.amountMinor) || expense.amountMinor <= 0) {
    errors.push("Enter a valid amount.");
  }
  if (!expense.date) {
    errors.push("Choose a date.");
  }
  if (expense.payments.length === 0) {
    errors.push("Choose who paid.");
  }
  for (const payment of expense.payments) {
    if (!personIds.has(payment.personId)) {
      errors.push("Every payer must be an existing person.");
    }
    if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) {
      errors.push("Payer amounts must be valid.");
    }
  }
  if (expense.payments.length > 0 && sumPayments(expense.payments) !== expense.amountMinor) {
    errors.push("Payer amounts must add up to the expense total.");
  }
  if (expense.splits.length === 0) {
    errors.push("Choose at least one participant.");
  }
  for (const split of expense.splits) {
    if (!personIds.has(split.personId)) {
      errors.push("Every split must reference an existing person.");
    }
    if (!Number.isSafeInteger(split.amountMinor) || split.amountMinor < 0) {
      errors.push("Split amounts must be valid.");
    }
  }
  if (sumSplits(expense.splits) !== expense.amountMinor) {
    errors.push("Split amounts must add up to the expense total.");
  }

  return Array.from(new Set(errors));
}

export function validatePayment(payment: Payment, people: Person[]): string[] {
  const personIds = new Set(people.map((person) => person.id));
  const errors: string[] = [];

  if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) {
    errors.push("Enter a valid amount.");
  }
  if (!personIds.has(payment.fromPersonId)) {
    errors.push("Choose who is paying.");
  }
  if (!personIds.has(payment.toPersonId)) {
    errors.push("Choose who receives the payment.");
  }
  if (payment.fromPersonId === payment.toPersonId) {
    errors.push("The payer and receiver must be different people.");
  }
  if (!payment.date) {
    errors.push("Choose a date.");
  }

  return Array.from(new Set(errors));
}

export function calculateBalances(ledger: Ledger): PersonBalance[] {
  const balances = new Map<string, PersonBalance>();

  for (const person of ledger.people) {
    balances.set(person.id, {
      personId: person.id,
      paidMinor: 0,
      owedMinor: 0,
      netMinor: 0
    });
  }

  for (const expense of ledger.expenses) {
    for (const payment of expense.payments) {
      const payer = balances.get(payment.personId);
      if (!payer) throw new Error(`Person ${payment.personId} not found in balances`);
      payer.paidMinor += payment.amountMinor;
    }

    for (const split of expense.splits) {
      const participant = balances.get(split.personId);
      if (!participant) throw new Error(`Person ${split.personId} not found in balances`);
      participant.owedMinor += split.amountMinor;
    }
  }

  for (const payment of ledger.payments) {
    const sender = balances.get(payment.fromPersonId);
    if (!sender) throw new Error(`Person ${payment.fromPersonId} not found in balances`);
    sender.netMinor += payment.amountMinor;
    const receiver = balances.get(payment.toPersonId);
    if (!receiver) throw new Error(`Person ${payment.toPersonId} not found in balances`);
    receiver.netMinor -= payment.amountMinor;
  }

  return Array.from(balances.values()).map((balance) => ({
    ...balance,
    netMinor: balance.paidMinor - balance.owedMinor + balance.netMinor
  }));
}

export function calculateSettlements(balances: PersonBalance[]): Settlement[] {
  const debtors = balances
    .filter((balance) => balance.netMinor < 0)
    .map((balance) => ({
      personId: balance.personId,
      amountMinor: -balance.netMinor
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  const creditors = balances
    .filter((balance) => balance.netMinor > 0)
    .map((balance) => ({
      personId: balance.personId,
      amountMinor: balance.netMinor
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);

    if (amountMinor > 0) {
      settlements.push({
        fromPersonId: debtor.personId,
        toPersonId: creditor.personId,
        amountMinor
      });
    }

    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;

    if (debtor.amountMinor === 0) {
      debtorIndex += 1;
    }
    if (creditor.amountMinor === 0) {
      creditorIndex += 1;
    }
  }

  return settlements;
}

export function getTotalSpent(ledger: Ledger) {
  return ledger.expenses.reduce(
    (total, expense) => total + expense.amountMinor,
    0
  );
}

export function touchLedger(ledger: Ledger): Ledger {
  return {
    ...ledger,
    updatedAt: new Date().toISOString()
  };
}
