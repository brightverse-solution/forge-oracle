export interface LineItem {
  product: string;
  quantity: number;
  price: number;
}

export interface ComputedLine extends LineItem {
  index: number;
  lineTotal: number;
}

export interface QuoteTotals {
  subtotal: number;
  vat: number;
  vatRate: number;
  grandTotal: number;
}

export interface Company {
  name: string;
  address: string[];
  phone?: string;
  taxId?: string;
}

export interface CompanyConfig {
  company: Company;
}

export interface Quote {
  quoteNumber: string;
  date: Date;
  customer: string | null;
  company: Company;
  items: ComputedLine[];
  totals: QuoteTotals;
}
