---
title: FORGE ⚒️ — First Task Brief (CSV→xlsx Quotation Generator)
date: 2026-04-23
status: draft · to be handed to FORGE on bud day
author: QuillBrain Oracle 🪶 (written for FORGE)
tags: [forge, task-brief, csv-to-xlsx, quotation, first-pilot, backend]
---

# FORGE ⚒️ — First Task Brief

**Task**: Build a CLI tool that converts a CSV of line items into a customer-ready Excel quotation.

**Trust level**: Partial. Library choice is yours. Output format requires Palm approval before first real customer send.

**Why this task**: Palm generates quotations often. A weekly recurring task = many cycles to learn from.

---

## Requirements (acceptance criteria)

### Input

CSV file, UTF-8 encoded, with header row:

```csv
product,quantity,price
Widget A,10,150.00
Widget B,5,300.00
Consulting (hours),8,2500.00
```

- Columns: `product` (string), `quantity` (number), `price` (number, per-unit, THB)
- Invoice currency: **THB** (Thai Baht) — fixed for v1
- Rows: arbitrary count (reasonable: 1–500)

### Output

Excel `.xlsx` file with:

1. **Header block** (top):
   - Company name + address (Palm provides — plain-text file FORGE reads from `config.json` or similar)
   - Quote number (generated — format: `Q-YYYYMMDD-NNN`, FORGE decides NNN logic)
   - Quote date (today, Asia/Bangkok)
   - Customer placeholder (Palm fills in manually post-generation, OR CLI flag `--customer "Name"`)

2. **Line items table**:
   - Columns: `#`, `Product`, `Qty`, `Unit Price`, `Line Total`
   - One row per CSV row
   - Numeric formatting: thousand separator, 2 decimal places
   - Currency cells formatted as Baht

3. **Totals block** (bottom):
   - Subtotal (sum of line totals)
   - VAT 7% (Subtotal × 0.07)
   - Grand Total (Subtotal + VAT)
   - All three labeled clearly

4. **Styling**:
   - Minimally presentable — Palm should not need to reformat in Excel before sending to customer
   - Exact styling: FORGE's call (good defaults over perfection)

### Command

```bash
bun run gen-quote input.csv                         # basic
bun run gen-quote input.csv -o output.xlsx          # explicit output path
bun run gen-quote input.csv --customer "ACME Co."   # pre-fill customer
```

Default output filename: `quote-Q-YYYYMMDD-NNN.xlsx`

### Tests (required)

Minimum coverage:

- [ ] **Quote math**: subtotal, VAT, grand total calculated correctly for a sample CSV
- [ ] **Edge: empty CSV** — should error gracefully, not produce a malformed xlsx
- [ ] **Edge: single line item** — math still works
- [ ] **Edge: non-integer quantities** — e.g. `1.5` hours of consulting, math still works
- [ ] **File round-trip**: write xlsx → read back → line items match

Framework: your choice (`bun test` is native and fast; `vitest` also fine).

### Non-requirements (v1)

- No PDF output (v2 maybe)
- No multi-currency (v2 if Palm needs)
- No tax exemption / discount rows (v2)
- No e-signature, no email sending — output is local file only
- No web UI — CLI only

---

## Deliverables (for first commit)

1. Working CLI (`bun run gen-quote <csv>` produces valid xlsx)
2. `README.md` — how to install, how to run, example input/output
3. Unit tests passing
4. Sample `input.csv` + generated `quote-sample.xlsx` in `examples/`
5. Retrospective: write `ψ/memory/retrospectives/YYYY-MM/DD/HH.MM_first-task.md` — what you learned from building this

---

## Interaction Protocol

- **Ask before deciding**: company info format, quote number format starting point, default styling direction
- **Don't ask**: library choice, code structure, test framework, file naming within repo
- **Show before shipping**: run CLI on a sample CSV, show Palm the output xlsx, get approval before Palm sends to real customer
- **Retrospective after**: what surprised you, what was harder than expected, what patterns you noticed

---

## What Palm Will Provide on Bud Day

- Company name + address (as plain text or JSON)
- 1–2 real historical quotations in Excel (as reference for styling direction)
- Any specific VAT edge cases (e.g. tax-exempt customers — probably deferred to v2)

---

## Environment (decided 2026-04-23)

- **Repo**: `brightverse-solution/forge-oracle` (public, new)
- **Commit email**: `noppakun.palm@outlook.com` (shared with Palm for now)
- **MCP data dir**: `~/.forge-oracle/` — isolated from QuillBrain's `~/.quill-brain-oracle/`. No shared SQLite, no shared LanceDB. Cross-Oracle awareness via git vaults, not shared runtime.
- **Languages**: English for code/commits/docs/README. Thai allowed in conversational notes with Palm.
- **Bud mechanism**: Manual `ghq get` scaffold + `/awaken --fast`

---

## What QuillBrain 🪶 Will Do

- Read FORGE's retros after the task completes
- Note emerging patterns (e.g. "FORGE discovered X from Y situation")
- Write welcome-message-style recognition when pattern aligns with family principles (without telling FORGE the principle in advance)
- Record surprises for future siblings' bud briefings

---

## Success = FORGE + 1 Customer Quotation

Minimum bar: Palm runs FORGE's CLI on a real weekly-quotation CSV, sends the xlsx to a real customer, no manual post-editing needed.

Stretch: FORGE's retrospective shows independent pattern recognition (e.g. "I kept the test fixtures even after feature changed because I wanted to compare old vs new behavior" → Principle 1 seed).

---

*Written by QuillBrain Oracle 🪶 on 2026-04-23 for FORGE ⚒️ — to be handed over on bud day.*
