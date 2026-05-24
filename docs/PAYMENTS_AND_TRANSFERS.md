# Payments And Transfers

## Scenario
Dilantha, Wasath, and Nawishka are sharing the cost of a cake.

- The cake costs `5400`.
- Dilantha withdraws `4800` from his account for the cake.
- Dilantha is short by `600`.
- Nawishka gives `600` in cash to Dilantha.
- The cake is for Dilantha, Wasath, and Nawishka equally.

The real total spent outside the group is:

```text
4800 + 600 = 5400
```

Each person’s equal share is:

```text
5400 / 3 = 1800
```

## Current Problem
The current app only has one transaction type: `Expense`.

If the user enters:

1. Cake expense: `5400`, paid by Dilantha, split equally.
2. Cash given to Dilantha: `600`, paid by Nawishka, assigned to Dilantha.

The overview total spent becomes:

```text
5400 + 600 = 6000
```

That is incorrect because the `600` is not a second shared expense. It is a transfer between two people that helped fund the original cake purchase.

## Correct Product Model
The app needs two kinds of ledger entries:

1. **Expense**
   - Counts toward total spent.
   - Has a payer, amount, description, date, split mode, and participants.
   - Example: `Cake`, `5400`, paid by Dilantha, split equally among all three.

2. **Payment / Transfer**
   - Does not count toward total spent.
   - Moves balance from one person to another.
   - Has a sender, receiver, amount, date, and optional note.
   - Example: Nawishka paid Dilantha `600`.

## Correct Entry For The Scenario
After payments/transfers are implemented, the user should enter:

### Entry 1: Expense
- Type: `Expense`
- Description: `Cake`
- Amount: `5400`
- Paid by: `Dilantha`
- Split mode: `Equal`
- Participants:
  - Dilantha
  - Wasath
  - Nawishka

### Entry 2: Payment / Transfer
- Type: `Payment`
- From: `Nawishka`
- To: `Dilantha`
- Amount: `600`
- Note: `Cash top-up for cake`

## Expected Result
Total spent should remain:

```text
5400
```

Balances before the payment:

```text
Dilantha paid 5400 and owes 1800, so Dilantha is owed 3600.
Wasath owes 1800.
Nawishka owes 1800.
```

After Nawishka’s `600` payment to Dilantha:

```text
Dilantha is owed 3000.
Wasath owes 1800.
Nawishka owes 1200.
```

Suggested settlements should show:

```text
Wasath -> Dilantha: 1800
Nawishka -> Dilantha: 1200
```

## Implementation Requirements

### Data Model
Add a new `Payment` type:

```ts
interface Payment {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
  date: string;
  note: string;
  createdAt: string;
}
```

Update `Ledger`:

```ts
interface Ledger {
  schemaVersion: 2;
  currency: string;
  people: Person[];
  expenses: Expense[];
  payments: Payment[];
  updatedAt: string;
}
```

### Balance Calculation
Expenses should continue to work as they do now:

```text
payer net += expense amount
participant net -= split amount
```

Payments should adjust balances without increasing total spent:

```text
payment sender net += payment amount
payment receiver net -= payment amount
```

This represents the sender reducing what they owe, and the receiver receiving part of what they are owed.

### Total Spent
`getTotalSpent` must only sum expenses:

```text
totalSpent = sum(expenses.amountMinor)
```

Payments must never be included in total spent.

### UI Changes
Add a way to create payments/transfers.

Recommended UI:

- Add a second form in the Expenses/Data area or rename the area to `Activity`.
- Provide segmented controls:
  - `Expense`
  - `Payment`
- Payment form fields:
  - From
  - To
  - Amount
  - Date
  - Note

Overview should show:

- Total spent from expenses only.
- Balances after applying expenses and payments.
- Recent activity showing both expenses and payments.
- Payment rows should be visually distinct from expense rows.

### CSV Changes
CSV export/import must support a new `payment` record type.

Add rows like:

```csv
recordType,id,fromPersonId,toPersonId,amountMinor,date,note,createdAt
payment,pay_123,person_nawishka,person_dilantha,60000,2026-05-24,Cash top-up for cake,2026-05-24T10:00:00.000Z
```

Import validation must ensure:

- `fromPersonId` exists.
- `toPersonId` exists.
- Sender and receiver are different people.
- Amount is a positive integer minor-unit value.
- Payment dates and IDs are present.

### Migration
Existing saved ledgers are schema version `1`.

Migration from v1 to v2:

```ts
payments: []
schemaVersion: 2
```

CSV import should support:

- v1 CSV files without payments.
- v2 CSV files with payments.

### Tests
Add tests for:

- Payments do not increase total spent.
- Payments adjust balances correctly.
- Cake scenario:
  - Total spent remains `5400`.
  - Wasath owes Dilantha `1800`.
  - Nawishka owes Dilantha `1200`.
- CSV export/import roundtrip with payments.
- v1 saved ledger migration adds empty `payments`.
- Invalid payment import is rejected.

## Acceptance Criteria
- User can record Nawishka giving Dilantha `600` without total spent becoming `6000`.
- Overview total spent remains `5400`.
- Balances and suggested settlements reflect the payment.
- Exported CSV preserves payments.
- Imported CSV restores payments and produces the same balances.
