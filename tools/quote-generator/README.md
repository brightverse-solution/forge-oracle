# Quotation Generator

CLI tool: turn a CSV of line items into a customer-ready Excel quotation with VAT 7% (THB).

**Status**: v1 · shipped 2026-04-23
**Entry point**: `bun run gen-quote` (from repo root)

---

## Install

Requires [Bun](https://bun.com) `>= 1.1.0`.

```bash
git clone https://github.com/brightverse-solution/forge-oracle.git
cd forge-oracle
bun install
```

## Configure

Copy the template and fill in your company details:

```bash
mkdir -p ~/.forge-oracle
cp tools/quote-generator/config.example.json ~/.forge-oracle/config.json
$EDITOR ~/.forge-oracle/config.json
```

Shape:

```json
{
  "company": {
    "name": "Your Company Co., Ltd.",
    "address": ["123 Example St", "District, Bangkok 10000", "Thailand"],
    "phone": "+66-2-xxx-xxxx",
    "taxId": "0-0000-00000-00-0"
  }
}
```

`phone` and `taxId` are optional; `name` and `address` (non-empty array) are required.

## Use

```bash
# basic
bun run gen-quote input.csv

# explicit output path
bun run gen-quote input.csv -o quote.xlsx

# pre-fill customer on the quote
bun run gen-quote input.csv --customer "ACME Co., Ltd."

# custom config location
bun run gen-quote input.csv --config /path/to/config.json
```

Default output filename: `quote-Q-YYYYMMDD-NNN.xlsx` — e.g. `quote-Q-20260423-001.xlsx`.

### Input CSV shape

UTF-8, with a header row. Columns: `product`, `quantity`, `price`.

```csv
product,quantity,price
Widget A,10,150.00
Widget B,5,300.00
Consulting (hours),8,2500.00
```

- `product`: non-empty string
- `quantity`: positive number (fractional OK — e.g. `1.5` hours)
- `price`: non-negative number, per-unit, in THB

Headers are case-insensitive. Quoted fields are supported (`"Widget, Deluxe"` stays a single product name).

### Output

An `.xlsx` file with:

- Company header (name, address, phone, tax ID from your config)
- Quote block: quote number, date (Asia/Bangkok), customer
- Line items table: `#`, Product, Qty, Unit Price (THB), Line Total (THB)
- Totals: Subtotal, VAT 7%, Grand Total

Example output: [`examples/quote-sample.xlsx`](examples/quote-sample.xlsx) — generated from [`examples/input.csv`](examples/input.csv).

### Quote numbering

`Q-YYYYMMDD-NNN` — a per-day counter. First quote of each day starts at `001`, counter resets at Bangkok midnight.

State is persisted at `~/.forge-oracle/quote-counter.json`. Override with `--counter-path <path>` (useful for testing).

## Tests

Run from the repo root:

```bash
bun test            # unit + round-trip tests
bun run typecheck   # strict TypeScript check
bun run lint        # biome lint
```

Coverage includes:

- Quote math (subtotal, VAT, grand total, FP rounding, fractional quantities)
- CSV parsing (headers, quoted fields, edge cases, validation errors)
- Config loading (valid/invalid JSON, missing fields)
- XLSX round-trip (write → read → values match)

## Source layout

```
tools/quote-generator/
  src/
    cli.ts       # entry — arg parsing, orchestration
    config.ts    # load + validate company config
    csv.ts       # CSV → LineItem[]
    quote.ts     # math + per-day quote number
    xlsx.ts      # render workbook + round-trip reader
    types.ts     # shared types
  tests/
    *.test.ts
  examples/
    input.csv, sample-config.json, quote-sample.xlsx
  config.example.json
```

## Non-goals (v1)

No PDF output, no multi-currency, no tax-exempt customers, no discount rows, no email sending, no web UI. These are v2 candidates if and when they're needed.

---

*Forged by [FORGE Oracle ⚒️](../../CLAUDE.md) — Heat. Shape. Temper.*
