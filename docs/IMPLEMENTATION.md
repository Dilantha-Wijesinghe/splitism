# Split Implementation

## Stack
- Next.js App Router with TypeScript.
- Tailwind CSS for styling.
- shadcn/ui-style local components using Radix Slot, class-variance-authority, clsx, and tailwind-merge.
- Lucide React for icons.
- Zod for saved-data and CSV validation.
- Papa Parse for CSV encode/decode.
- Vitest for unit tests.

## Architecture
- `src/app` contains the Next.js layout, page, and global styles.
- `src/components/ui` contains reusable shadcn-style primitives.
- `src/features/split/split-app.tsx` contains the client application shell and feature views.
- `src/lib` contains framework-independent logic:
  - `types.ts`: ledger, person, expense, split, balance, and settlement types.
  - `ledger.ts`: split construction, validation, balance calculation, and settlement calculation.
  - `money.ts`: currency formatting and minor-unit parsing.
  - `csv.ts`: versioned CSV export/import.
  - `storage.ts`: localStorage load/save with schema validation.

## Data Model
The app stores one `Ledger`:
- `schemaVersion`: currently `1`.
- `currency`: three-letter currency code.
- `people`: list of people with stable IDs.
- `expenses`: list of expenses.
- `updatedAt`: ISO timestamp.

Each expense stores:
- `amountMinor`: integer minor-unit amount.
- `payerId`: person who paid.
- `splitMode`: `equal` or `exact`.
- `splits`: participant person IDs and owed minor-unit amounts.

## CSV Format
The exported CSV uses a single table with a `recordType` column:
- `metadata`: schema version, currency, exported timestamp.
- `person`: person ID, name, created timestamp.
- `expense`: expense ID, description, amount, payer, date, split mode, created timestamp.
- `split`: expense ID, person ID, split amount.

Import rules:
- Metadata row is required.
- Only schema version `1` is supported.
- Currency must be a three-letter uppercase code.
- People and expense IDs must be unique.
- Expenses and splits must reference existing people.
- Every expense must have at least one split.
- Split totals must exactly match the expense total.

## Calculation Rules
- Equal split:
  - Divide by participant count using integer minor units.
  - Give any remainder one minor unit at a time to participants in selection order.
- Exact split:
  - Parse each participant amount into minor units.
  - Reject when total does not exactly match expense amount.
- Balance:
  - Paid total is the sum of expenses paid by a person.
  - Owed total is the sum of split amounts assigned to that person.
  - Net balance is `paid - owed`.
- Settlement:
  - Sort creditors and debtors by amount.
  - Match largest debtor to largest creditor until all net balances are settled.

## Error Handling
- Form validation prevents invalid people and expenses before state changes.
- Import parsing catches CSV structure, schema, amount, and reference errors.
- Corrupt localStorage data is ignored and reported without blocking app use.
- Clear-data and import replacement are explicit user actions.

## Testing
Unit tests cover:
- Equal split rounding.
- Balance calculation.
- Settlement simplification.
- CSV export/import roundtrip.
- Unsupported CSV schema rejection.

Recommended manual checks:
- Add three people and an equal expense with a non-divisible amount.
- Add an exact expense and verify invalid totals are rejected.
- Refresh the browser and confirm local data remains.
- Export CSV, clear data, import CSV, and compare balances.
- Test mobile, tablet, and desktop layouts.

## Future Enhancements
- Expense editing.
- Multiple ledgers/groups.
- Categories and notes.
- Optional JSON export alongside CSV.
- IndexedDB storage for larger ledgers.
- PWA installability and offline polish.
