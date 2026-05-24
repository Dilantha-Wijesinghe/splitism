"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Calculator,
  CircleDollarSign,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { exportLedgerToCsv, parseLedgerCsv, type ImportPreview } from "@/lib/csv";
import { createId } from "@/lib/ids";
import {
  buildEqualSplits,
  calculateBalances,
  calculateSettlements,
  canRemovePerson,
  createEmptyLedger,
  getTotalSpent,
  normalizeName,
  sumSplits,
  touchLedger,
  validateExpense,
  validatePersonName
} from "@/lib/ledger";
import { formatMinor, parseMoneyToMinor } from "@/lib/money";
import { clearLedgerStorage, loadLedger, saveLedger } from "@/lib/storage";
import type { Expense, Ledger, Person, SplitMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "overview" | "expenses" | "people" | "data";

const currencies = ["USD", "LKR", "EUR", "GBP", "AUD", "CAD", "INR", "JPY"];

const navItems: Array<{ id: View; label: string; icon: typeof Calculator }> = [
  { id: "overview", label: "Overview", icon: Calculator },
  { id: "expenses", label: "Expenses", icon: CircleDollarSign },
  { id: "people", label: "People", icon: Users },
  { id: "data", label: "Data", icon: ArrowDownToLine }
];

export function SplitApp() {
  const [ledger, setLedger] = useState<Ledger>(() => createEmptyLedger());
  const [view, setView] = useState<View>("overview");
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const peopleById = useMemo(
    () => new Map(ledger.people.map((person) => [person.id, person])),
    [ledger.people]
  );
  const balances = useMemo(() => calculateBalances(ledger), [ledger]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const totalSpent = useMemo(() => getTotalSpent(ledger), [ledger]);

  useEffect(() => {
    const result = loadLedger();
    setLedger(result.ledger);
    setError(result.error);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveLedger(ledger);
    }
  }, [hydrated, ledger]);

  function updateLedger(updater: (current: Ledger) => Ledger) {
    setLedger((current) => touchLedger(updater(current)));
    setNotice(null);
    setError(null);
  }

  function handleCurrencyChange(currency: string) {
    updateLedger((current) => ({ ...current, currency }));
  }

  function handleExport() {
    const csv = exportLedgerToCsv(ledger);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `split-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CSV export created.");
  }

  async function handleImport(file: File | undefined) {
    setImportPreview(null);
    setError(null);

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const preview = parseLedgerCsv(text);
      setImportPreview(preview);
      setNotice("Import preview is ready.");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "CSV import failed."
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function confirmImport() {
    if (!importPreview) {
      return;
    }
    setLedger(importPreview.ledger);
    setImportPreview(null);
    setNotice("Imported CSV replaced the current ledger.");
  }

  function resetLedger() {
    const shouldReset = window.confirm(
      "Clear all people, expenses, and saved browser data?"
    );
    if (!shouldReset) {
      return;
    }
    clearLedgerStorage();
    setLedger(createEmptyLedger(ledger.currency));
    setImportPreview(null);
    setNotice("Ledger cleared.");
    setError(null);
  }

  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Private expense splitting
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">Split</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              aria-label="Currency"
              value={ledger.currency}
              onChange={(event) => handleCurrencyChange(event.target.value)}
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </header>

        {(notice || error) && (
          <div
            className={cn(
              "rounded-md border px-4 py-3 text-sm",
              error
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/10 text-primary"
            )}
            role={error ? "alert" : "status"}
          >
            {error ?? notice}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="hidden rounded-lg border bg-card p-2 shadow-sm lg:block">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={view === item.id}
                onClick={() => setView(item.id)}
              />
            ))}
          </nav>

          <section className="min-w-0">
            {view === "overview" && (
              <Overview
                ledger={ledger}
                balances={balances}
                settlements={settlements}
                peopleById={peopleById}
                totalSpent={totalSpent}
                onAddExpense={() => setView("expenses")}
                onAddPeople={() => setView("people")}
              />
            )}
            {view === "expenses" && (
              <ExpensesView
                ledger={ledger}
                peopleById={peopleById}
                updateLedger={updateLedger}
              />
            )}
            {view === "people" && (
              <PeopleView ledger={ledger} updateLedger={updateLedger} />
            )}
            {view === "data" && (
              <DataView
                ledger={ledger}
                importPreview={importPreview}
                fileInputRef={fileInputRef}
                onExport={handleExport}
                onImport={handleImport}
                onConfirmImport={confirmImport}
                onCancelImport={() => setImportPreview(null)}
                onReset={resetLedger}
              />
            )}
          </section>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 px-2 py-2 shadow-lg backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={view === item.id}
              onClick={() => setView(item.id)}
              compact
            />
          ))}
        </div>
      </nav>
    </main>
  );
}

function NavButton({
  item,
  active,
  compact,
  onClick
}: {
  item: (typeof navItems)[number];
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        compact && "flex-col gap-1 px-2 py-2 text-xs"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </button>
  );
}

function Overview({
  ledger,
  balances,
  settlements,
  peopleById,
  totalSpent,
  onAddExpense,
  onAddPeople
}: {
  ledger: Ledger;
  balances: ReturnType<typeof calculateBalances>;
  settlements: ReturnType<typeof calculateSettlements>;
  peopleById: Map<string, Person>;
  totalSpent: number;
  onAddExpense: () => void;
  onAddPeople: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total spent" value={formatMinor(totalSpent, ledger.currency)} />
          <MetricCard label="People" value={String(ledger.people.length)} />
          <MetricCard label="Expenses" value={String(ledger.expenses.length)} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Balances</CardTitle>
            {ledger.people.length === 0 && (
              <Button size="sm" onClick={onAddPeople}>
                <Plus className="h-4 w-4" />
                Add people
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <EmptyState message="Add people to start tracking balances." />
            ) : (
              <div className="space-y-3">
                {balances.map((balance) => (
                  <div
                    key={balance.personId}
                    className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-medium">
                        {peopleById.get(balance.personId)?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Paid {formatMinor(balance.paidMinor, ledger.currency)} ·
                        Owes {formatMinor(balance.owedMinor, ledger.currency)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-left font-semibold sm:text-right",
                        balance.netMinor > 0 && "text-primary",
                        balance.netMinor < 0 && "text-destructive"
                      )}
                    >
                      {balance.netMinor === 0
                        ? "settled"
                        : formatMinor(balance.netMinor, ledger.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Recent breakdown</CardTitle>
            <Button size="sm" onClick={onAddExpense}>
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
          </CardHeader>
          <CardContent>
            {ledger.expenses.length === 0 ? (
              <EmptyState message="Add an expense to see how each split is calculated." />
            ) : (
              <div className="space-y-3">
                {ledger.expenses.slice(0, 4).map((expense) => (
                  <ExpenseBreakdown
                    key={expense.id}
                    expense={expense}
                    ledger={ledger}
                    peopleById={peopleById}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suggested settlements</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <EmptyState message="No payments are needed yet." />
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement) => (
                <div
                  key={`${settlement.fromPersonId}-${settlement.toPersonId}`}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {peopleById.get(settlement.fromPersonId)?.name}
                      <ArrowRight className="mx-2 inline h-4 w-4 text-muted-foreground" />
                      {peopleById.get(settlement.toPersonId)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Suggested payment
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">
                    {formatMinor(settlement.amountMinor, ledger.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      </CardContent>
    </Card>
  );
}

function ExpensesView({
  ledger,
  peopleById,
  updateLedger
}: {
  ledger: Ledger;
  peopleById: Map<string, Person>;
  updateLedger: (updater: (current: Ledger) => Ledger) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setParticipantIds((current) => {
      if (current.length > 0) {
        return current.filter((id) => peopleById.has(id));
      }
      return ledger.people.map((person) => person.id);
    });
    setPayerId((current) => current || ledger.people[0]?.id || "");
  }, [ledger.people, peopleById]);

  function toggleParticipant(personId: string) {
    setParticipantIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

  function resetForm() {
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setSplitMode("equal");
    setParticipantIds(ledger.people.map((person) => person.id));
    setExactAmounts({});
    setFormError(null);
  }

  function addExpense() {
    if (ledger.people.length < 1) {
      setFormError("Add at least one person first.");
      return;
    }

    const amountMinor = parseMoneyToMinor(amount, ledger.currency);
    if (!amountMinor) {
      setFormError("Enter a valid amount.");
      return;
    }

    if (participantIds.length === 0) {
      setFormError("Choose at least one participant.");
      return;
    }

    const splits =
      splitMode === "equal"
        ? buildEqualSplits(amountMinor, participantIds)
        : participantIds.map((personId) => ({
            personId,
            amountMinor:
              parseMoneyToMinor(exactAmounts[personId] ?? "", ledger.currency) ??
              0
          }));

    if (splitMode === "exact" && sumSplits(splits) !== amountMinor) {
      setFormError("Exact split amounts must add up to the expense total.");
      return;
    }

    const expense: Expense = {
      id: createId("exp"),
      description: description.trim(),
      amountMinor,
      payerId,
      date,
      createdAt: new Date().toISOString(),
      splitMode,
      splits
    };

    const validationErrors = validateExpense(expense, ledger.people);
    if (validationErrors.length > 0) {
      setFormError(validationErrors[0]);
      return;
    }

    updateLedger((current) => ({
      ...current,
      expenses: [expense, ...current.expenses]
    }));
    resetForm();
  }

  function deleteExpense(expenseId: string) {
    updateLedger((current) => ({
      ...current,
      expenses: current.expenses.filter((expense) => expense.id !== expenseId)
    }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Add expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Field label="Description">
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Dinner, taxi, groceries"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount (${ledger.currency})`}>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Paid by">
            <Select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
              {ledger.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={splitMode === "equal" ? "default" : "outline"}
              onClick={() => setSplitMode("equal")}
            >
              Equal
            </Button>
            <Button
              type="button"
              variant={splitMode === "exact" ? "default" : "outline"}
              onClick={() => setSplitMode("exact")}
            >
              Exact
            </Button>
          </div>
          <div className="space-y-2">
            <Label>For whom</Label>
            {ledger.people.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add people before creating expenses.
              </p>
            ) : (
              <div className="space-y-2">
                {ledger.people.map((person) => {
                  const selected = participantIds.includes(person.id);
                  return (
                    <div
                      key={person.id}
                      className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border p-3"
                    >
                      <input
                        aria-label={`Include ${person.name}`}
                        checked={selected}
                        className="h-4 w-4 accent-primary"
                        onChange={() => toggleParticipant(person.id)}
                        type="checkbox"
                      />
                      <div className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-center">
                        <span className="font-medium">{person.name}</span>
                        {splitMode === "exact" && selected && (
                          <Input
                            inputMode="decimal"
                            value={exactAmounts[person.id] ?? ""}
                            onChange={(event) =>
                              setExactAmounts((current) => ({
                                ...current,
                                [person.id]: event.target.value
                              }))
                            }
                            placeholder="0.00"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Button className="w-full" onClick={addExpense}>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.expenses.length === 0 ? (
            <EmptyState message="No expenses yet." />
          ) : (
            <div className="space-y-3">
              {ledger.expenses.map((expense) => (
                <div key={expense.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <ExpenseBreakdown
                      expense={expense}
                      ledger={ledger}
                      peopleById={peopleById}
                    />
                    <Button
                      aria-label={`Delete ${expense.description}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteExpense(expense.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PeopleView({
  ledger,
  updateLedger
}: {
  ledger: Ledger;
  updateLedger: (updater: (current: Ledger) => Ledger) => void;
}) {
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function addPerson() {
    const validationError = validatePersonName(name, ledger.people);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    updateLedger((current) => ({
      ...current,
      people: [
        ...current.people,
        {
          id: createId("person"),
          name: normalizeName(name),
          createdAt: new Date().toISOString()
        }
      ]
    }));
    setName("");
    setFormError(null);
  }

  function removePerson(personId: string) {
    if (!canRemovePerson(personId, ledger.expenses)) {
      setFormError("Delete or edit related expenses before removing this person.");
      return;
    }

    updateLedger((current) => ({
      ...current,
      people: current.people.filter((person) => person.id !== personId)
    }));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Add person</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addPerson();
                }
              }}
              placeholder="Alex"
            />
          </Field>
          <Button className="w-full" onClick={addPerson}>
            <Plus className="h-4 w-4" />
            Add person
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.people.length === 0 ? (
            <EmptyState message="No people added yet." />
          ) : (
            <div className="space-y-2">
              {ledger.people.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(person.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    aria-label={`Remove ${person.name}`}
                    size="icon"
                    variant="ghost"
                    onClick={() => removePerson(person.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DataView({
  ledger,
  importPreview,
  fileInputRef,
  onExport,
  onImport,
  onConfirmImport,
  onCancelImport,
  onReset
}: {
  ledger: Ledger;
  importPreview: ImportPreview | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (file: File | undefined) => void;
  onConfirmImport: () => void;
  onCancelImport: () => void;
  onReset: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export a full CSV backup with {ledger.people.length} people and{" "}
            {ledger.expenses.length} expenses.
          </p>
          <Button className="w-full" onClick={onExport}>
            <ArrowUpFromLine className="h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => onImport(event.target.files?.[0])}
            type="file"
          />
          <Button
            className="w-full"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Choose CSV
          </Button>
          {importPreview && (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3">
              <p className="font-medium">Import preview</p>
              <p className="text-sm text-muted-foreground">
                {importPreview.peopleCount} people, {importPreview.expenseCount}{" "}
                expenses, total{" "}
                {formatMinor(
                  importPreview.totalMinor,
                  importPreview.ledger.currency
                )}
                . This will replace the current ledger.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={onConfirmImport}>
                  <RefreshCw className="h-4 w-4" />
                  Replace
                </Button>
                <Button variant="outline" onClick={onCancelImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clear the local browser ledger. Export a CSV first if you need a
            backup.
          </p>
          <Button variant="destructive" onClick={onReset}>
            <Trash2 className="h-4 w-4" />
            Clear data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenseBreakdown({
  expense,
  ledger,
  peopleById
}: {
  expense: Expense;
  ledger: Ledger;
  peopleById: Map<string, Person>;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{expense.description}</p>
          <p className="text-sm text-muted-foreground">
            {peopleById.get(expense.payerId)?.name ?? "Unknown"} paid{" "}
            {formatMinor(expense.amountMinor, ledger.currency)} on{" "}
            {new Date(`${expense.date}T00:00:00`).toLocaleDateString()}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
          {expense.splitMode}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {expense.splits.map((split) => (
          <div
            key={`${expense.id}-${split.personId}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-muted-foreground">
              {peopleById.get(split.personId)?.name ?? "Unknown"} owes
            </span>
            <span className="font-medium">
              {formatMinor(split.amountMinor, ledger.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
