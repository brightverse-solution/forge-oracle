import { describe, expect, test } from 'bun:test';
import { CsvParseError, parseCsv } from '../src/csv.ts';

describe('parseCsv', () => {
  test('parses the brief example', () => {
    const csv = `product,quantity,price
Widget A,10,150.00
Widget B,5,300.00
Consulting (hours),8,2500.00`;
    expect(parseCsv(csv)).toEqual([
      { product: 'Widget A', quantity: 10, price: 150 },
      { product: 'Widget B', quantity: 5, price: 300 },
      { product: 'Consulting (hours)', quantity: 8, price: 2500 },
    ]);
  });

  test('accepts header case variations', () => {
    const csv = `Product,Quantity,Price
X,1,10`;
    expect(parseCsv(csv)).toEqual([{ product: 'X', quantity: 1, price: 10 }]);
  });

  test('handles quoted fields containing commas', () => {
    const csv = `product,quantity,price
"Widget, Deluxe",2,99.50`;
    const parsed = parseCsv(csv);
    expect(parsed[0]?.product).toBe('Widget, Deluxe');
    expect(parsed[0]?.price).toBe(99.5);
  });

  test('skips blank lines in the middle of the file', () => {
    const csv = `product,quantity,price
A,1,10

B,2,20`;
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]?.product).toBe('B');
  });

  test('trims whitespace around product name', () => {
    const csv = `product,quantity,price
  Widget A  ,1,10`;
    expect(parseCsv(csv)[0]?.product).toBe('Widget A');
  });

  test('accepts zero price (free item)', () => {
    const csv = `product,quantity,price
Bonus,1,0`;
    expect(parseCsv(csv)).toEqual([{ product: 'Bonus', quantity: 1, price: 0 }]);
  });

  // --- error paths ---

  test('rejects empty string', () => {
    expect(() => parseCsv('')).toThrow(CsvParseError);
  });

  test('rejects whitespace-only content', () => {
    expect(() => parseCsv('   \n  ')).toThrow(CsvParseError);
  });

  test('rejects missing required columns', () => {
    expect(() => parseCsv('product,qty\nA,1')).toThrow(/Missing required columns/);
  });

  test('rejects header-only file (no data rows)', () => {
    expect(() => parseCsv('product,quantity,price')).toThrow(/no data rows/);
  });

  test('rejects negative quantity', () => {
    expect(() => parseCsv('product,quantity,price\nA,-1,10')).toThrow(
      /quantity must be a positive number/,
    );
  });

  test('rejects zero quantity', () => {
    expect(() => parseCsv('product,quantity,price\nA,0,10')).toThrow(
      /quantity must be a positive number/,
    );
  });

  test('rejects non-numeric price', () => {
    expect(() => parseCsv('product,quantity,price\nA,1,cheap')).toThrow(
      /price must be a non-negative number/,
    );
  });

  test('rejects negative price', () => {
    expect(() => parseCsv('product,quantity,price\nA,1,-5')).toThrow(
      /price must be a non-negative number/,
    );
  });

  test('rejects empty product name', () => {
    expect(() => parseCsv('product,quantity,price\n,1,10')).toThrow(/product is required/);
  });

  test('error references CSV row number (1-indexed, counts header)', () => {
    const csv = `product,quantity,price
A,1,10
B,-1,20`;
    expect(() => parseCsv(csv)).toThrow(/Row 3/);
  });
});
