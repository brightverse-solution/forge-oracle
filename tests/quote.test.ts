import { describe, expect, test } from 'bun:test';
import {
  VAT_RATE,
  computeLines,
  computeTotals,
  createMemoryCounter,
  formatDateKey,
} from '../src/quote.ts';

describe('VAT_RATE', () => {
  test('is 7%', () => {
    expect(VAT_RATE).toBe(0.07);
  });
});

describe('computeLines', () => {
  test('computes line total = quantity × price, adds 1-based index', () => {
    const lines = computeLines([
      { product: 'A', quantity: 10, price: 150 },
      { product: 'B', quantity: 5, price: 300 },
    ]);
    expect(lines).toEqual([
      { product: 'A', quantity: 10, price: 150, lineTotal: 1500, index: 1 },
      { product: 'B', quantity: 5, price: 300, lineTotal: 1500, index: 2 },
    ]);
  });

  test('handles non-integer quantities (fractional consulting hours)', () => {
    const lines = computeLines([{ product: 'Consulting', quantity: 1.5, price: 2500 }]);
    expect(lines[0]?.lineTotal).toBe(3750);
  });

  test('rounds floating-point drift to 2 decimals', () => {
    // 3 × 33.333 = 99.999 → should round to 100
    const lines = computeLines([{ product: 'X', quantity: 3, price: 33.333 }]);
    expect(lines[0]?.lineTotal).toBe(100);
  });

  test('handles zero-price line (freebie allowed)', () => {
    const lines = computeLines([{ product: 'Bonus', quantity: 1, price: 0 }]);
    expect(lines[0]?.lineTotal).toBe(0);
  });

  test('preserves original fields', () => {
    const input = [{ product: 'X', quantity: 2, price: 10 }];
    const lines = computeLines(input);
    expect(lines[0]?.product).toBe('X');
    expect(lines[0]?.quantity).toBe(2);
    expect(lines[0]?.price).toBe(10);
  });
});

describe('computeTotals', () => {
  test('matches the brief example exactly (23000 / 1610 / 24610)', () => {
    const lines = computeLines([
      { product: 'Widget A', quantity: 10, price: 150 },
      { product: 'Widget B', quantity: 5, price: 300 },
      { product: 'Consulting (hours)', quantity: 8, price: 2500 },
    ]);
    const totals = computeTotals(lines);
    expect(totals.subtotal).toBe(23000);
    expect(totals.vat).toBe(1610);
    expect(totals.grandTotal).toBe(24610);
    expect(totals.vatRate).toBe(0.07);
  });

  test('single line item', () => {
    const lines = computeLines([{ product: 'Only', quantity: 1, price: 100 }]);
    const totals = computeTotals(lines);
    expect(totals.subtotal).toBe(100);
    expect(totals.vat).toBe(7);
    expect(totals.grandTotal).toBe(107);
  });

  test('empty input produces zero totals', () => {
    const totals = computeTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.vat).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });

  test('VAT rounds correctly on non-clean subtotals (99.99)', () => {
    const lines = computeLines([{ product: 'X', quantity: 1, price: 99.99 }]);
    const totals = computeTotals(lines);
    expect(totals.subtotal).toBe(99.99);
    expect(totals.vat).toBe(7); // 99.99 × 0.07 = 6.9993 → 7.00
    expect(totals.grandTotal).toBe(106.99);
  });
});

describe('formatDateKey', () => {
  test('formats as YYYYMMDD in Asia/Bangkok', () => {
    const d = new Date('2026-04-23T10:00:00+07:00');
    expect(formatDateKey(d)).toBe('20260423');
  });

  test('honors timezone boundary (UTC midnight = next day in Bangkok)', () => {
    // 2025-12-31 23:00 UTC = 2026-01-01 06:00 Bangkok
    const d = new Date('2025-12-31T23:00:00Z');
    expect(formatDateKey(d)).toBe('20260101');
  });
});

describe('quote number generator', () => {
  test('increments within a day, resets at day boundary', () => {
    const counter = createMemoryCounter();
    const day1 = new Date('2026-04-23T10:00:00+07:00');
    const day2 = new Date('2026-04-24T10:00:00+07:00');

    expect(counter.next(day1)).toBe('Q-20260423-001');
    expect(counter.next(day1)).toBe('Q-20260423-002');
    expect(counter.next(day1)).toBe('Q-20260423-003');
    expect(counter.next(day2)).toBe('Q-20260424-001');
    expect(counter.next(day2)).toBe('Q-20260424-002');
  });

  test('pads to 3 digits', () => {
    const counter = createMemoryCounter();
    const day = new Date('2026-04-23T10:00:00+07:00');
    for (let i = 1; i <= 9; i++) counter.next(day);
    expect(counter.next(day)).toBe('Q-20260423-010');
  });

  test('format: Q-YYYYMMDD-NNN', () => {
    const counter = createMemoryCounter();
    const day = new Date('2026-04-23T10:00:00+07:00');
    expect(counter.next(day)).toMatch(/^Q-\d{8}-\d{3}$/);
  });
});
