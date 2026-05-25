# Splitism

[![CI](https://github.com/Dilantha-Wijesinghe/splitism/actions/workflows/ci.yml/badge.svg)](https://github.com/Dilantha-Wijesinghe/splitism/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A private, frontend-only expense splitting app for small groups — friends on trips, housemates, couples, or small teams.

No account. No backend. No ads. Your data lives in your browser.

---

## Features

- **Add people** to a shared ledger
- **Record expenses** with payer, amount, date, and description
- **Multiple payers** — split the payment responsibility across several people
- **Equal or exact splits** — divide evenly or specify each person's share
- **Balance overview** — see who owes what at a glance
- **Settlement suggestions** — minimal set of payments to settle all debts
- **Multi-currency** — USD, EUR, GBP, LKR, AUD, CAD, INR, JPY
- **CSV export/import** — back up and restore your full ledger
- **Offline-first** — everything runs in the browser, no internet required after load
- **Mobile-first** — designed for on-the-go use, works on desktop too

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| UI Primitives | [Radix UI](https://www.radix-ui.com/) |
| Validation | [Zod](https://zod.dev/) |
| CSV Parsing | [Papa Parse](https://www.papaparse.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Testing | [Vitest](https://vitest.dev/) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/Dilantha-Wijesinghe/splitism.git
cd splitism
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm run start
```

## Running Tests

```bash
npm test                # run all tests
npm run typecheck       # TypeScript type checking
npm run lint            # ESLint
```

## Project Structure

```
src/
├── app/                  # Next.js App Router (layout, page, global styles)
├── components/ui/        # Reusable UI primitives (Button, Card, Input, etc.)
├── features/splitism/    # Main application shell and views
└── lib/
    ├── types.ts          # Core data types (Ledger, Expense, Person, ...)
    ├── ledger.ts         # Balance and settlement calculations
    ├── csv.ts            # CSV export and import
    ├── storage.ts        # localStorage persistence with schema migration
    ├── money.ts          # Currency formatting and parsing
    └── ids.ts            # Stable ID generation
```

## Data & Privacy

All data is stored exclusively in your browser's `localStorage`. Nothing is sent to any server. Exporting a CSV is the only way to back up or transfer your data.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

MIT — see [LICENSE](LICENSE) for details.
