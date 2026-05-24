# Split PRD

## Overview
Split is a private, frontend-only expense splitting web app for small groups who need a simple way to track shared costs and settle up. It is inspired by Splitwise, but v1 is intentionally focused on a single ledger with clear calculations, CSV backup/restore, and a mobile-first experience.

## Goals
- Let users add people, expenses, payers, and participants quickly on mobile.
- Support equal and exact split expenses.
- Show transparent balance calculations and suggested settlements.
- Persist data locally in the browser without a backend.
- Export the full ledger as CSV and import that CSV later to continue from the same state.
- Keep the interface professional, minimal, accessible, and responsive across mobile, tablet, and desktop.

## Non-Goals
- Authentication, accounts, server sync, or cloud storage.
- Multiple groups or trips.
- Multi-currency conversion or exchange rates.
- Comments, recurring expenses, categories, receipt images, or reminders.
- Editing historical CSVs manually as the primary workflow.

## Users And Use Cases
- Friends on a trip tracking meals, taxis, tickets, and groceries.
- Housemates tracking shared recurring purchases manually.
- Couples or small teams who want a lightweight ledger they can back up as CSV.

Primary flows:
- Add people to a ledger.
- Add an expense with payer, amount, date, description, and participants.
- Choose equal split for common shared expenses.
- Choose exact split when people owe different amounts.
- Review balances, per-expense breakdowns, and suggested settlements.
- Export CSV before switching devices or clearing browser data.
- Import CSV later and replace current local state after preview.

## Functional Requirements
- People:
  - Add people with trimmed, normalized names.
  - Reject empty and duplicate names.
  - Allow removal only when the person is not referenced by any expense.

- Expenses:
  - Require description, positive amount, payer, date, and at least one participant.
  - Store amounts as integer minor units to avoid floating-point balance errors.
  - Equal split distributes remainder minor units deterministically.
  - Exact split requires participant amounts to total the expense amount.
  - Payer may or may not be a participant.
  - Expenses can be deleted.

- Balances:
  - Track each person’s paid total, owed total, and net balance.
  - Show suggested payments from debtors to creditors.
  - Show each expense’s calculation breakdown.

- Persistence:
  - Auto-save to `localStorage`.
  - Load saved data on app start.
  - If saved data is corrupt, start with an empty recoverable state and show an error.
  - Provide a confirmed clear-data action.

- CSV:
  - Export a single CSV containing metadata, people, expenses, and split rows.
  - Import validates schema version, currency, references, duplicate IDs, and split totals.
  - Import shows a preview before replacing current local data.
  - Import failure must present a user-readable error.

## UX Requirements
- Mobile is the primary viewport.
- Use compact navigation, readable cards, clear hierarchy, and stable controls.
- Desktop may use a wider navigation/sidebar layout.
- Important actions use icons from Lucide plus concise labels.
- Forms should surface validation errors near the action.
- Empty states should explain the next useful action without marketing copy.
- Color must not be the only signal for positive/negative balances.

## Edge Cases
- Duplicate names with different casing or extra spaces.
- Equal split where cents do not divide evenly.
- Exact split that is short or over by one cent.
- CSV with missing metadata, unsupported schema version, invalid references, or malformed amounts.
- Local storage unavailable or containing invalid data.
- Expenses where payer is not included in the split.
- Users importing a CSV while current data exists.

## Success Criteria
- A user can complete the add-people, add-expense, review-balance, export, clear, import, and continue workflow entirely on the frontend.
- Export/import roundtrip preserves people, expenses, splits, currency, and balances.
- The app works comfortably on mobile and remains usable on tablet and desktop.
- Calculation logic is covered by unit tests.
