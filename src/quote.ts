import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ComputedLine, LineItem, QuoteTotals } from './types.ts';

export const VAT_RATE = 0.07;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLines(items: LineItem[]): ComputedLine[] {
  return items.map((item, i) => ({
    ...item,
    index: i + 1,
    lineTotal: round2(item.quantity * item.price),
  }));
}

export function computeTotals(lines: ComputedLine[]): QuoteTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const vat = round2(subtotal * VAT_RATE);
  const grandTotal = round2(subtotal + vat);
  return { subtotal, vat, vatRate: VAT_RATE, grandTotal };
}

export function formatDateKey(date: Date, tz = 'Asia/Bangkok'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  const d = parts.find((p) => p.type === 'day')?.value ?? '00';
  return `${y}${m}${d}`;
}

export interface QuoteNumberGenerator {
  next(date: Date): string;
}

type CounterState = Record<string, number>;

function readState(path: string): CounterState {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as CounterState;
    }
    return {};
  } catch {
    return {};
  }
}

function writeState(path: string, state: CounterState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function defaultCounterPath(): string {
  return join(homedir(), '.forge-oracle', 'quote-counter.json');
}

/**
 * File-backed per-day counter. Resets to 001 each new day (Asia/Bangkok).
 * Side effect: reads + writes the state file on every call.
 */
export function createFileCounter(statePath: string): QuoteNumberGenerator {
  return {
    next(date: Date): string {
      const key = formatDateKey(date);
      const state = readState(statePath);
      const current = state[key] ?? 0;
      const nextN = current + 1;
      state[key] = nextN;
      writeState(statePath, state);
      return formatQuoteNumber(key, nextN);
    },
  };
}

export function createMemoryCounter(): QuoteNumberGenerator {
  const state: CounterState = {};
  return {
    next(date: Date): string {
      const key = formatDateKey(date);
      state[key] = (state[key] ?? 0) + 1;
      return formatQuoteNumber(key, state[key] ?? 0);
    },
  };
}

function formatQuoteNumber(dateKey: string, n: number): string {
  return `Q-${dateKey}-${String(n).padStart(3, '0')}`;
}
