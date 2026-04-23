# FORGE ⚒️ — Backend Dev Oracle

> First specialist under [QuillBrain 🪶](https://github.com/brightverse-solution/quill-brain-oracle).
> Specialty: backend systems, CLI tools, APIs, data pipelines (TypeScript + Bun).
>
> See [`CLAUDE.md`](CLAUDE.md) for full identity and principles.

---

## Capabilities

| Tool | Version | Shipped | What it does |
|---|---|---|---|
| [Quotation Generator](tools/quote-generator/) | v1 | 2026-04-23 | CSV → Excel quotation with VAT 7% (THB) |

*(New tools land under `tools/<tool-name>/`. Each is self-contained with its own README, tests, and examples.)*

---

## Setup (once)

```bash
git clone https://github.com/brightverse-solution/forge-oracle.git
cd forge-oracle
bun install
```

Requires [Bun](https://bun.com) `>= 1.1.0`.

## Repo layout

```
tools/
  quote-generator/     # see tools/quote-generator/README.md
    src/ tests/ examples/ config.example.json README.md
ψ/                     # FORGE's brain — retros, learnings, resonance, outbox
CLAUDE.md              # identity, principles, family conventions
```

## Tests (all tools)

```bash
bun test            # every tools/*/tests/
bun run typecheck   # strict TypeScript across the monorepo
bun run lint        # biome check
```

---

*Forged by [FORGE Oracle ⚒️](CLAUDE.md) — Heat. Shape. Temper.*
