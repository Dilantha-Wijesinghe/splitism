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
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
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
  sumPayments,
  sumSplits,
  touchLedger,
  validateExpense,
  validatePayment,
  validatePersonName
} from "@/lib/ledger";
import { formatMinor, parseMoneyToMinor } from "@/lib/money";
import { clearLedgerStorage, loadLedger, saveLedger } from "@/lib/storage";
import type { Expense, Ledger, Payment, Person, SplitMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "overview" | "activity" | "people" | "data";
type ActivityMode = "expense" | "payment";

const currencies = ["USD", "LKR", "EUR", "GBP", "AUD", "CAD", "INR", "JPY"];

const navItems: Array<{ id: View; label: string; icon: typeof Calculator }> = [
  { id: "overview", label: "Overview", icon: Calculator },
  { id: "activity", label: "Activity", icon: CircleDollarSign },
  { id: "people", label: "People", icon: Users },
  { id: "data", label: "Data", icon: ArrowDownToLine }
];

const AVATAR_COLORS = [
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800"
] as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function SplitismApp() {
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
    anchor.download = `splitism-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CSV exported.");
  }

  async function handleImport(file: File | undefined) {
    setImportPreview(null);
    setError(null);

    if (!file) {
      return;
    }

    if (!file.name.endsWith(".csv") && !file.type.includes("text/csv")) {
      setError("Please select a valid CSV file.");
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
    clearLedgerStorage();
    setLedger(createEmptyLedger(ledger.currency));
    setImportPreview(null);
    setNotice("Ledger cleared.");
    setError(null);
  }

  return (
    <main className="min-h-screen pb-[max(96px,calc(80px+env(safe-area-inset-bottom)))] lg:pb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-[-0.04em]">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, hsl(174 68% 24%), hsl(174 55% 36%))"
              }}
            >
              splitism.
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Currency"
              value={ledger.currency}
              onValueChange={handleCurrencyChange}
              variant="ghost"
              align="right"
            >
              {currencies.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              title="Export CSV"
              className="h-9 w-9"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {(notice || error) && (
          <div
            className={cn(
              "animate-list-item rounded-lg px-4 py-2.5 text-sm font-medium",
              error
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            )}
            aria-live={error ? "assertive" : "polite"}
            role={error ? "alert" : "status"}
          >
            {error ?? notice}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Desktop sidebar nav — frosted glass */}
          <nav className="hidden lg:flex lg:flex-col lg:gap-1 lg:rounded-lg lg:border lg:border-border/60 lg:bg-card/70 lg:backdrop-blur-md lg:p-2 lg:shadow-card lg:h-fit">
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
                onAddActivity={() => setView("activity")}
                onAddPeople={() => setView("people")}
              />
            )}
            {view === "activity" && (
              <ActivityView
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

      {/* Mobile bottom nav — glassmorphism */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 bg-card/80 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
        style={{ boxShadow: "var(--shadow-nav, 0 -1px 0 hsl(36 15% 86%), 0 -8px 24px hsl(222 24% 10% / 0.06))" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
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

  if (compact) {
    return (
      <button
        className={cn(
          "relative flex flex-col items-center gap-1 rounded-xl py-2 px-1 min-h-[56px]",
          "text-[10px] font-semibold tracking-wide uppercase transition-all duration-200 touch-manipulation",
          active ? "text-primary" : "text-muted-foreground"
        )}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        type="button"
      >
        {active && (
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 h-8 w-12 rounded-full bg-primary/12 transition-all duration-300" />
        )}
        <Icon
          className={cn(
            "relative h-5 w-5 transition-transform duration-200",
            active && "scale-110"
          )}
        />
        <span className="relative leading-none">{item.label}</span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/12 text-primary font-semibold shadow-[inset_0_0_0_1px_hsl(174_68%_24%/0.2)]"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      type="button"
    >
      <Icon
        className={cn(
          "shrink-0 h-4 w-4 transition-all duration-200",
          active && "text-primary"
        )}
      />
      {item.label}
    </button>
  );
}

// Merged activity item type for sorted rendering
type ActivityItem =
  | { kind: "expense"; entry: Expense; sortKey: string }
  | { kind: "payment"; entry: Payment; sortKey: string };

function buildActivityItems(ledger: Ledger): ActivityItem[] {
  const items: ActivityItem[] = [
    ...ledger.expenses.map((e) => ({
      kind: "expense" as const,
      entry: e,
      sortKey: `${e.date}_${e.createdAt}`
    })),
    ...ledger.payments.map((p) => ({
      kind: "payment" as const,
      entry: p,
      sortKey: `${p.date}_${p.createdAt}`
    }))
  ];
  return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function WidgetLabel({ color, children }: { color?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color ?? "hsl(var(--primary))" }}
      />
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

function Overview({
  ledger,
  balances,
  settlements,
  peopleById,
  totalSpent,
  onAddActivity,
  onAddPeople
}: {
  ledger: Ledger;
  balances: ReturnType<typeof calculateBalances>;
  settlements: ReturnType<typeof calculateSettlements>;
  peopleById: Map<string, Person>;
  totalSpent: number;
  onAddActivity: () => void;
  onAddPeople: () => void;
}) {
  const recentActivity = useMemo(
    () => buildActivityItems(ledger).slice(0, 4),
    [ledger]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {/* Stats bar — gradient border + ambient glow */}
        <div
          className="rounded-lg p-[1px]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, hsl(174 68% 24% / 0.4), hsl(36 15% 86%), hsl(28 90% 55% / 0.2))"
          }}
        >
          <div className="relative grid grid-cols-[2fr_1fr_1fr] divide-x rounded-[calc(var(--radius)-1px)] overflow-hidden bg-gradient-to-b from-card to-[hsl(36_15%_98%)]">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-primary/15 blur-2xl" />
            </div>
            <div className="relative px-4 py-4 sm:py-5 bg-gradient-to-br from-primary/8 to-primary/3">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Total spent
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight tabular-amount truncate">
                {formatMinor(totalSpent, ledger.currency)}
              </p>
            </div>
            <div className="relative px-4 py-4 sm:py-5">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                People
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-bold">{ledger.people.length}</p>
            </div>
            <div className="relative px-4 py-4 sm:py-5">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Expenses
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-bold">{ledger.expenses.length}</p>
            </div>
          </div>
        </div>

        {/* Onboarding prompt */}
        {(ledger.people.length === 0 || ledger.expenses.length === 0) && (
          <Card className="border-primary/25 bg-gradient-to-br from-primary/6 to-transparent">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="font-semibold">
                  {ledger.people.length === 0
                    ? "Start by adding people"
                    : "Add your first shared expense"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ledger.people.length === 0
                    ? "Create the group before entering expenses."
                    : "Balances and suggested payments will appear here."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={onAddPeople}
                  variant={ledger.people.length === 0 ? "default" : "outline"}
                >
                  <Users className="h-3.5 w-3.5" />
                  Add people
                </Button>
                <Button
                  size="sm"
                  disabled={ledger.people.length === 0}
                  onClick={onAddActivity}
                  variant={ledger.people.length > 0 ? "default" : "outline"}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add expense
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balances */}
        <Card>
          <CardHeader className="pb-3">
            <WidgetLabel>Balances</WidgetLabel>
          </CardHeader>
          <CardContent className="pt-0">
            {balances.length === 0 ? (
              <EmptyState message="Add people to start tracking balances." />
            ) : (
              <div className="divide-y">
                {balances.map((balance, index) => {
                  const name = peopleById.get(balance.personId)?.name ?? "?";
                  return (
                    <div
                      key={balance.personId}
                      className={cn(
                        "flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 animate-list-item",
                        `stagger-${(index % 4) + 1}`
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold leading-none",
                            getAvatarColor(name)
                          )}
                        >
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Paid {formatMinor(balance.paidMinor, ledger.currency)} · Owes{" "}
                            {formatMinor(balance.owedMinor, ledger.currency)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-amount",
                          balance.netMinor > 0 && "bg-primary/10 text-primary",
                          balance.netMinor < 0 && "bg-destructive/10 text-destructive",
                          balance.netMinor === 0 &&
                          "bg-muted text-muted-foreground text-xs font-semibold"
                        )}
                      >
                        <BalanceStatus
                          amountMinor={balance.netMinor}
                          currency={ledger.currency}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <WidgetLabel color="hsl(28 90% 55%)">Recent activity</WidgetLabel>
          </CardHeader>
          <CardContent className="pt-0">
            {recentActivity.length === 0 ? (
              <EmptyState message="Add an expense to see how each split is calculated." />
            ) : (
              <div className="divide-y">
                {recentActivity.map((item, index) =>
                  item.kind === "expense" ? (
                    <div
                      key={item.entry.id}
                      className={cn(
                        "py-3 first:pt-0 last:pb-0 animate-list-item",
                        `stagger-${(index % 4) + 1}`
                      )}
                    >
                      <ExpenseBreakdown
                        expense={item.entry}
                        ledger={ledger}
                        peopleById={peopleById}
                      />
                    </div>
                  ) : (
                    <div
                      key={item.entry.id}
                      className={cn(
                        "py-3 first:pt-0 last:pb-0 animate-list-item",
                        `stagger-${(index % 4) + 1}`
                      )}
                    >
                      <PaymentRow
                        payment={item.entry}
                        ledger={ledger}
                        peopleById={peopleById}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggested settlements — gradient border */}
      <div
        className="rounded-lg p-[1px] xl:h-fit"
        style={{
          backgroundImage:
            "linear-gradient(135deg, hsl(28 90% 55% / 0.35), hsl(36 15% 86%), hsl(174 68% 24% / 0.2))"
        }}
      >
        <Card className="rounded-[calc(var(--radius)-1px)] shadow-none border-0">
          <CardHeader className="pb-3">
            <WidgetLabel color="hsl(28 90% 55%)">Settlements</WidgetLabel>
          </CardHeader>
          <CardContent className="pt-0">
            {settlements.length === 0 ? (
              <EmptyState message="No payments needed yet." />
            ) : (
              <div className="divide-y">
                {settlements.map((settlement, index) => (
                  <div
                    key={`${settlement.fromPersonId}-${settlement.toPersonId}`}
                    className={cn(
                      "flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 animate-list-item",
                      `stagger-${(index % 4) + 1}`
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold truncate max-w-[72px]">
                        {peopleById.get(settlement.fromPersonId)?.name}
                      </span>
                      <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowRight className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-semibold truncate max-w-[72px]">
                        {peopleById.get(settlement.toPersonId)?.name}
                      </span>
                    </div>
                    <div className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-sm font-bold tabular-amount text-accent-foreground">
                      {formatMinor(settlement.amountMinor, ledger.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BalanceStatus({
  amountMinor,
  currency
}: {
  amountMinor: number;
  currency: string;
}) {
  if (amountMinor === 0) {
    return <span>settled</span>;
  }

  return (
    <span>
      {amountMinor > 0 ? "+" : "-"}
      {formatMinor(Math.abs(amountMinor), currency)}
    </span>
  );
}

function ActivityView({
  ledger,
  peopleById,
  updateLedger
}: {
  ledger: Ledger;
  peopleById: Map<string, Person>;
  updateLedger: (updater: (current: Ledger) => Ledger) => void;
}) {
  const [mode, setMode] = useState<ActivityMode>("expense");

  function deleteExpense(expenseId: string) {
    updateLedger((current) => ({
      ...current,
      expenses: current.expenses.filter((e) => e.id !== expenseId)
    }));
  }

  function deletePayment(paymentId: string) {
    updateLedger((current) => ({
      ...current,
      payments: current.payments.filter((p) => p.id !== paymentId)
    }));
  }

  const activityItems = useMemo(() => buildActivityItems(ledger), [ledger]);

  return (
    <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          {/* Expense / Payment segmented control */}
          <div
            className="flex rounded-md border border-border/60 bg-muted/60 p-1 gap-0.5"
            aria-label="Activity type"
          >
            <button
              type="button"
              onClick={() => setMode("expense")}
              className={cn(
                "flex-1 rounded-sm py-2 text-sm font-medium transition-all duration-150 min-h-[40px]",
                mode === "expense"
                  ? "bg-card text-foreground shadow-[0_1px_3px_hsl(222_24%_10%/0.10)] font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setMode("payment")}
              className={cn(
                "flex-1 rounded-sm py-2 text-sm font-medium transition-all duration-150 min-h-[40px]",
                mode === "payment"
                  ? "bg-card text-foreground shadow-[0_1px_3px_hsl(222_24%_10%/0.10)] font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Payment
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {mode === "expense" ? (
            <ExpenseForm ledger={ledger} updateLedger={updateLedger} />
          ) : (
            <PaymentForm ledger={ledger} updateLedger={updateLedger} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <WidgetLabel color="hsl(28 90% 55%)">Activity</WidgetLabel>
        </CardHeader>
        <CardContent className="pt-0">
          {activityItems.length === 0 ? (
            <EmptyState message="No activity yet." />
          ) : (
            <div className="divide-y">
              {activityItems.map((item, index) =>
                item.kind === "expense" ? (
                  <div
                    key={item.entry.id}
                    className={cn(
                      "py-3 first:pt-0 last:pb-0 animate-list-item",
                      `stagger-${(index % 4) + 1}`
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ExpenseBreakdown
                        expense={item.entry}
                        ledger={ledger}
                        peopleById={peopleById}
                      />
                      <Button
                        aria-label={`Delete ${item.entry.description}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteExpense(item.entry.id)}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.entry.id}
                    className={cn(
                      "py-3 first:pt-0 last:pb-0 animate-list-item",
                      `stagger-${(index % 4) + 1}`
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <PaymentRow
                        payment={item.entry}
                        ledger={ledger}
                        peopleById={peopleById}
                      />
                      <Button
                        aria-label="Delete payment"
                        size="icon"
                        variant="ghost"
                        onClick={() => deletePayment(item.entry.id)}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenseForm({
  ledger,
  updateLedger
}: {
  ledger: Ledger;
  updateLedger: (updater: (current: Ledger) => Ledger) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [payerMode, setPayerMode] = useState<"single" | "multiple">("single");
  const [payerId, setPayerId] = useState("");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const amountMinor = useMemo(
    () => parseMoneyToMinor(amount, ledger.currency),
    [amount, ledger.currency]
  );
  const exactSplitTotal = useMemo(
    () =>
      participantIds.reduce(
        (total, personId) =>
          total + (parseMoneyToMinor(exactAmounts[personId] ?? "", ledger.currency) ?? 0),
        0
      ),
    [exactAmounts, ledger.currency, participantIds]
  );
  const exactRemaining =
    splitMode === "exact" && amountMinor ? amountMinor - exactSplitTotal : null;

  const payerTotal = useMemo(
    () =>
      ledger.people.reduce(
        (total, person) =>
          total + (parseMoneyToMinor(payerAmounts[person.id] ?? "", ledger.currency) ?? 0),
        0
      ),
    [payerAmounts, ledger.currency, ledger.people]
  );
  const payerRemaining =
    payerMode === "multiple" && amountMinor ? amountMinor - payerTotal : null;

  useEffect(() => {
    setParticipantIds((current) => {
      if (current.length > 0) {
        return current.filter((id) => ledger.people.some((p) => p.id === id));
      }
      return ledger.people.map((p) => p.id);
    });
    setPayerId((current) => current || ledger.people[0]?.id || "");
  }, [ledger.people]);

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
    setParticipantIds(ledger.people.map((p) => p.id));
    setExactAmounts({});
    setPayerMode("single");
    setPayerId(ledger.people[0]?.id || "");
    setPayerAmounts({});
    setFormError(null);
  }

  function addExpense() {
    if (ledger.people.length < 1) {
      setFormError("Add at least one person first.");
      return;
    }
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
          amountMinor: parseMoneyToMinor(exactAmounts[personId] ?? "", ledger.currency) ?? 0
        }));

    if (splitMode === "exact" && sumSplits(splits) !== amountMinor) {
      setFormError("Exact split amounts must add up to the expense total.");
      return;
    }

    const payments =
      payerMode === "single"
        ? [{ personId: payerId, amountMinor }]
        : ledger.people
          .map((person) => ({
            personId: person.id,
            amountMinor: parseMoneyToMinor(payerAmounts[person.id] ?? "", ledger.currency) ?? 0
          }))
          .filter((p) => p.amountMinor > 0);

    if (payerMode === "multiple" && sumPayments(payments) !== amountMinor) {
      setFormError("Payer amounts must add up to the expense total.");
      return;
    }

    const expense: Expense = {
      id: createId("exp"),
      description: description.trim(),
      amountMinor,
      payments,
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

  return (
    <div className="space-y-4">
      {formError && (
        <p
          aria-live="assertive"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
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
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
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
      {/* Paid by */}
      <div>
        <Label className="mb-2 block">Paid by</Label>
        <div
          className="flex rounded-md border border-border/60 bg-muted/60 p-1 gap-0.5 mb-3"
          aria-label="Payer mode"
        >
          <button
            type="button"
            onClick={() => setPayerMode("single")}
            className={cn(
              "flex-1 rounded-sm py-2 text-sm font-medium transition-all duration-150 min-h-[40px]",
              payerMode === "single"
                ? "bg-card text-foreground shadow-[0_1px_3px_hsl(222_24%_10%/0.10)] font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            One person
          </button>
          <button
            type="button"
            onClick={() => setPayerMode("multiple")}
            className={cn(
              "flex-1 rounded-sm py-2 text-sm font-medium transition-all duration-150 min-h-[40px]",
              payerMode === "multiple"
                ? "bg-card text-foreground shadow-[0_1px_3px_hsl(222_24%_10%/0.10)] font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Multiple people
          </button>
        </div>

        {payerMode === "single" ? (
          <Select value={payerId} onValueChange={setPayerId}>
            {ledger.people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </Select>
        ) : (
          <div className="space-y-2">
            {payerRemaining !== null && (
              <p
                aria-live="polite"
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  payerRemaining === 0
                    ? "bg-primary/10 text-primary"
                    : "bg-accent/15 text-accent-foreground"
                )}
              >
                {payerRemaining === 0
                  ? "Amounts match the total."
                  : payerRemaining > 0
                    ? `${formatMinor(payerRemaining, ledger.currency)} left to assign.`
                    : `${formatMinor(Math.abs(payerRemaining), ledger.currency)} over the total.`}
              </p>
            )}
            {ledger.people.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add people before creating expenses.</p>
            ) : (
              ledger.people.map((person) => (
                <div
                  key={person.id}
                  className="grid grid-cols-[1fr_120px] items-center gap-3"
                >
                  <span className="text-sm font-medium">{person.name}</span>
                  <Input
                    aria-label={`${person.name} paid amount`}
                    inputMode="decimal"
                    value={payerAmounts[person.id] ?? ""}
                    onChange={(event) =>
                      setPayerAmounts((current) => ({
                        ...current,
                        [person.id]: event.target.value
                      }))
                    }
                    placeholder="0.00"
                    className="h-9 text-sm"
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Split mode segmented control */}
      <div>
        <Label className="mb-2 block">Split</Label>
        <div
          className="flex rounded-md border border-border/60 bg-muted/60 p-1 gap-0.5"
          aria-label="Split mode"
        >
          <button
            type="button"
            onClick={() => setSplitMode("equal")}
            className={cn(
              "flex-1 rounded-sm py-2 text-sm font-medium transition-all duration-150 min-h-[40px]",
              splitMode === "equal"
                ? "bg-card text-foreground shadow-[0_1px_3px_hsl(222_24%_10%/0.10)] font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Equal
          </button>
          <button
            type="button"
            onClick={() => setSplitMode("exact")}
            className={cn(
              "flex-1 rounded-sm py-2 text-sm font-medium transition-all duration-150 min-h-[40px]",
              splitMode === "exact"
                ? "bg-card text-foreground shadow-[0_1px_3px_hsl(222_24%_10%/0.10)] font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Exact
          </button>
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>For whom</Label>
          {ledger.people.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setParticipantIds(ledger.people.map((p) => p.id))}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setParticipantIds([])}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {exactRemaining !== null && (
          <p
            aria-live="polite"
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              exactRemaining === 0
                ? "bg-primary/10 text-primary"
                : "bg-accent/15 text-accent-foreground"
            )}
          >
            {exactRemaining === 0
              ? "Amounts match the total."
              : exactRemaining > 0
                ? `${formatMinor(exactRemaining, ledger.currency)} left to assign.`
                : `${formatMinor(Math.abs(exactRemaining), ledger.currency)} over the total.`}
          </p>
        )}

        {ledger.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add people before creating expenses.
          </p>
        ) : splitMode === "equal" ? (
          <div className="flex flex-wrap gap-2">
            {ledger.people.map((person) => {
              const selected = participantIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleParticipant(person.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 border min-h-[40px] active:scale-[0.97] touch-manipulation",
                    selected
                      ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {ledger.people.map((person) => {
              const selected = participantIds.includes(person.id);
              return (
                <div
                  key={person.id}
                  className="grid grid-cols-[auto_1fr_120px] items-center gap-3"
                >
                  <input
                    aria-label={`Include ${person.name}`}
                    checked={selected}
                    className="h-4 w-4 accent-primary"
                    onChange={() => toggleParticipant(person.id)}
                    type="checkbox"
                  />
                  <span className="text-sm font-medium">{person.name}</span>
                  {selected ? (
                    <Input
                      aria-label={`${person.name} exact amount`}
                      inputMode="decimal"
                      value={exactAmounts[person.id] ?? ""}
                      onChange={(event) =>
                        setExactAmounts((current) => ({
                          ...current,
                          [person.id]: event.target.value
                        }))
                      }
                      placeholder="0.00"
                      className="h-9 text-sm"
                    />
                  ) : (
                    <div />
                  )}
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
    </div>
  );
}

function PaymentForm({
  ledger,
  updateLedger
}: {
  ledger: Ledger;
  updateLedger: (updater: (current: Ledger) => Ledger) => void;
}) {
  const [fromPersonId, setFromPersonId] = useState("");
  const [toPersonId, setToPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFromPersonId((current) => current || ledger.people[0]?.id || "");
    setToPersonId((current) => {
      if (current && ledger.people.some((p) => p.id === current)) return current;
      return ledger.people[1]?.id || ledger.people[0]?.id || "";
    });
  }, [ledger.people]);

  // Ensure from ≠ to when from changes
  useEffect(() => {
    if (fromPersonId && fromPersonId === toPersonId) {
      const other = ledger.people.find((p) => p.id !== fromPersonId);
      setToPersonId(other?.id ?? "");
    }
  }, [fromPersonId, toPersonId, ledger.people]);

  function addPayment() {
    const amountMinor = parseMoneyToMinor(amount, ledger.currency);
    if (!amountMinor) {
      setFormError("Enter a valid amount.");
      return;
    }

    const payment: Payment = {
      id: createId("pay"),
      fromPersonId,
      toPersonId,
      amountMinor,
      date,
      note: note.trim(),
      createdAt: new Date().toISOString()
    };

    const errors = validatePayment(payment, ledger.people);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }

    updateLedger((current) => ({
      ...current,
      payments: [payment, ...current.payments]
    }));

    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
  }

  if (ledger.people.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Add at least two people before recording a payment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {formError && (
        <p
          aria-live="assertive"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {formError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <Select value={fromPersonId} onValueChange={setFromPersonId}>
            {ledger.people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </Select>
        </Field>
        <Field label="To">
          <Select value={toPersonId} onValueChange={setToPersonId}>
            {ledger.people
              .filter((p) => p.id !== fromPersonId)
              .map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
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

      <Field label="Note (optional)">
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Cash, bank transfer…"
        />
      </Field>

      <Button className="w-full" onClick={addPayment}>
        <ArrowRight className="h-4 w-4" />
        Record payment
      </Button>
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
    if (!canRemovePerson(personId, ledger)) {
      setFormError("Delete related expenses or payments before removing this person.");
      return;
    }

    updateLedger((current) => ({
      ...current,
      people: current.people.filter((person) => person.id !== personId)
    }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <WidgetLabel>Add person</WidgetLabel>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
        <CardHeader className="pb-3">
          <WidgetLabel>People</WidgetLabel>
        </CardHeader>
        <CardContent className="pt-0">
          {ledger.people.length === 0 ? (
            <EmptyState message="No people added yet." />
          ) : (
            <div className="divide-y">
              {ledger.people.map((person, index) => (
                <div
                  key={person.id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 animate-list-item",
                    `stagger-${(index % 4) + 1}`
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold leading-none",
                        getAvatarColor(person.name)
                      )}
                    >
                      {getInitials(person.name)}
                    </div>
                    <p className="font-semibold text-sm truncate">{person.name}</p>
                  </div>
                  <Button
                    aria-label={`Remove ${person.name}`}
                    size="icon"
                    variant="ghost"
                    onClick={() => removePerson(person.id)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
  const [confirmReset, setConfirmReset] = useState(false);

  function handleReset() {
    onReset();
    setConfirmReset(false);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <WidgetLabel>Export</WidgetLabel>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Download a CSV backup with {ledger.people.length} people,{" "}
            {ledger.expenses.length} expenses, and {ledger.payments.length} payments.
          </p>
          <Button className="w-full" onClick={onExport}>
            <ArrowUpFromLine className="h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <WidgetLabel>Import</WidgetLabel>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
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
            <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/8 p-3">
              <p className="text-sm font-semibold">Preview</p>
              <p className="text-sm text-muted-foreground">
                {importPreview.peopleCount} people · {importPreview.expenseCount} expenses
                {importPreview.paymentCount > 0 && ` · ${importPreview.paymentCount} payments`}
                {" · "}{formatMinor(importPreview.totalMinor, importPreview.ledger.currency)} total
              </p>
              <p className="text-xs text-muted-foreground">
                This will replace your current data.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={onConfirmImport}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/15 bg-gradient-to-br from-destructive/5 to-transparent sm:col-span-2">
        <CardHeader className="pb-3">
          <WidgetLabel color="hsl(var(--destructive))">Reset</WidgetLabel>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Clear all local data. Export a CSV backup first if needed.
          </p>
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-destructive flex-1">
                Clear all people, expenses, and payments?
              </p>
              <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReset}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear data
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmReset(true)}>
              <Trash2 className="h-4 w-4" />
              Clear data
            </Button>
          )}
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
  const payerLabel = (() => {
    const names = expense.payments.map((p) => peopleById.get(p.personId)?.name ?? "Unknown");
    if (names.length === 1) {
      return `${names[0]} paid ${formatMinor(expense.amountMinor, ledger.currency)}`;
    }
    if (names.length === 2) {
      return `${names[0]} & ${names[1]} paid`;
    }
    return `${names[0]} +${names.length - 1} others paid`;
  })();

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{expense.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {payerLabel} · {new Date(`${expense.date}T00:00:00`).toLocaleDateString()}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold shrink-0",
            expense.splitMode === "equal"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {expense.splitMode}
        </span>
      </div>
      {expense.payments.length > 1 && (
        <div className="mt-2 space-y-1 pb-1.5 border-b border-border/40">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Paid by
          </p>
          {expense.payments.map((payment) => (
            <div
              key={`${expense.id}-pay-${payment.personId}`}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-xs text-muted-foreground">
                {peopleById.get(payment.personId)?.name ?? "Unknown"}
              </span>
              <span className="text-xs font-semibold tabular-amount">
                {formatMinor(payment.amountMinor, ledger.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1">
        {expense.splits.map((split) => (
          <div
            key={`${expense.id}-${split.personId}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-xs text-muted-foreground">
              {peopleById.get(split.personId)?.name ?? "Unknown"}
            </span>
            <span className="text-xs font-semibold tabular-amount">
              {formatMinor(split.amountMinor, ledger.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentRow({
  payment,
  ledger,
  peopleById
}: {
  payment: Payment;
  ledger: Ledger;
  peopleById: Map<string, Person>;
}) {
  const fromName = peopleById.get(payment.fromPersonId)?.name ?? "Unknown";
  const toName = peopleById.get(payment.toPersonId)?.name ?? "Unknown";

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate max-w-[80px]">{fromName}</span>
            <div className="shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRight className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="truncate max-w-[80px]">{toName}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(`${payment.date}T00:00:00`).toLocaleDateString()}
            {payment.note && ` · ${payment.note}`}
          </p>
        </div>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-amount bg-accent/15 text-accent-foreground shrink-0">
          {formatMinor(payment.amountMinor, ledger.currency)}
        </span>
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
  const generatedId = useId();
  const child =
    React.isValidElement<{ id?: string }>(children)
      ? React.cloneElement(children, {
        id: children.props.id ?? generatedId
      })
      : children;
  const fieldId =
    React.isValidElement<{ id?: string }>(child) ? child.props.id : generatedId;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      {child}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
