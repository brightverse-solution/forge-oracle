import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeLines, computeTotals } from '../src/quote.ts';
import { readQuoteXlsx, writeQuoteXlsx } from '../src/xlsx.ts';

const tmp = mkdtempSync(join(tmpdir(), 'forge-xlsx-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const company = {
  name: 'Brightverse Solution',
  address: ['123 Example Street', 'Bangkok 10110', 'Thailand'],
  phone: '+66-2-000-0000',
  taxId: '0-0000-00000-00-0',
};

describe('xlsx round-trip', () => {
  test('write then read restores line items and totals exactly', async () => {
    const items = [
      { product: 'Widget A', quantity: 10, price: 150 },
      { product: 'Widget B', quantity: 5, price: 300 },
      { product: 'Consulting (hours)', quantity: 8, price: 2500 },
    ];
    const lines = computeLines(items);
    const totals = computeTotals(lines);
    const outPath = join(tmp, 'round-trip.xlsx');

    await writeQuoteXlsx(
      {
        quoteNumber: 'Q-20260423-001',
        date: new Date('2026-04-23T10:00:00+07:00'),
        customer: 'ACME Co.',
        company,
        items: lines,
        totals,
      },
      outPath,
    );

    const read = await readQuoteXlsx(outPath);
    expect(read.quoteNumber).toBe('Q-20260423-001');
    expect(read.customer).toBe('ACME Co.');
    expect(read.items).toHaveLength(3);
    expect(read.items[0]).toEqual({
      product: 'Widget A',
      quantity: 10,
      price: 150,
      lineTotal: 1500,
    });
    expect(read.items[2]?.product).toBe('Consulting (hours)');
    expect(read.totals).toEqual({ subtotal: 23000, vat: 1610, grandTotal: 24610 });
  });

  test('handles single line item', async () => {
    const lines = computeLines([{ product: 'Only', quantity: 1, price: 100 }]);
    const totals = computeTotals(lines);
    const outPath = join(tmp, 'single.xlsx');
    await writeQuoteXlsx(
      {
        quoteNumber: 'Q-20260423-099',
        date: new Date('2026-04-23T10:00:00+07:00'),
        customer: null,
        company,
        items: lines,
        totals,
      },
      outPath,
    );

    const read = await readQuoteXlsx(outPath);
    expect(read.items).toHaveLength(1);
    expect(read.customer).toBeNull(); // placeholder treated as null
    expect(read.totals).toEqual({ subtotal: 100, vat: 7, grandTotal: 107 });
  });

  test('handles fractional quantity (consulting hours)', async () => {
    const lines = computeLines([{ product: 'Consulting', quantity: 1.5, price: 2500 }]);
    const totals = computeTotals(lines);
    const outPath = join(tmp, 'fractional.xlsx');
    await writeQuoteXlsx(
      {
        quoteNumber: 'Q-20260423-100',
        date: new Date('2026-04-23T10:00:00+07:00'),
        customer: 'Test',
        company,
        items: lines,
        totals,
      },
      outPath,
    );

    const read = await readQuoteXlsx(outPath);
    expect(read.items[0]?.quantity).toBe(1.5);
    expect(read.items[0]?.lineTotal).toBe(3750);
    expect(read.totals.grandTotal).toBe(4012.5); // 3750 + 262.5 VAT
  });
});
