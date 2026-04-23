import Papa from 'papaparse';
import type { LineItem } from './types.ts';

export class CsvParseError extends Error {
  override name = 'CsvParseError';
}

const REQUIRED_COLUMNS = ['product', 'quantity', 'price'] as const;

export function parseCsv(content: string): LineItem[] {
  if (!content.trim()) {
    throw new CsvParseError('CSV is empty');
  }

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new CsvParseError(`CSV parse error: ${first?.message ?? 'unknown'}`);
  }

  const headers = result.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    throw new CsvParseError(`Missing required columns: ${missing.join(', ')}`);
  }

  if (result.data.length === 0) {
    throw new CsvParseError('CSV has headers but no data rows');
  }

  return result.data.map((row, i) => {
    const rowNumber = i + 2; // +1 for header, +1 for 1-indexed
    const productRaw = row.product ?? '';
    const product = productRaw.trim();
    if (product === '') {
      throw new CsvParseError(`Row ${rowNumber}: product is required`);
    }

    const qtyStr = (row.quantity ?? '').trim();
    const quantity = Number.parseFloat(qtyStr);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new CsvParseError(
        `Row ${rowNumber}: quantity must be a positive number (got "${qtyStr}")`,
      );
    }

    const priceStr = (row.price ?? '').trim();
    const price = Number.parseFloat(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      throw new CsvParseError(
        `Row ${rowNumber}: price must be a non-negative number (got "${priceStr}")`,
      );
    }

    return { product, quantity, price };
  });
}
