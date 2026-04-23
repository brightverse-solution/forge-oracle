#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { loadConfig } from './config.ts';
import { parseCsv } from './csv.ts';
import { computeLines, computeTotals, createFileCounter, defaultCounterPath } from './quote.ts';
import { writeQuoteXlsx } from './xlsx.ts';

interface CliOptions {
  output?: string;
  customer?: string;
  config?: string;
  counterPath?: string;
}

const program = new Command();

program
  .name('gen-quote')
  .description('Generate an Excel quotation from a CSV of line items')
  .argument('<csv>', 'Input CSV file')
  .option('-o, --output <path>', 'Output xlsx path (default: quote-<number>.xlsx)')
  .option('-c, --customer <name>', 'Customer name to pre-fill on the quote')
  .option('--config <path>', 'Path to company config JSON (default: ~/.forge-oracle/config.json)')
  .option(
    '--counter-path <path>',
    'Path to quote-counter state (default: ~/.forge-oracle/quote-counter.json)',
  )
  .action(async (csvPath: string, opts: CliOptions) => {
    try {
      const csvContent = readFileSync(csvPath, 'utf8');
      const items = parseCsv(csvContent);
      const config = loadConfig(opts.config);

      const lines = computeLines(items);
      const totals = computeTotals(lines);

      const counter = createFileCounter(opts.counterPath ?? defaultCounterPath());
      const now = new Date();
      const quoteNumber = counter.next(now);
      const outputPath = opts.output ?? `quote-${quoteNumber}.xlsx`;

      await writeQuoteXlsx(
        {
          quoteNumber,
          date: now,
          customer: opts.customer ?? null,
          company: config.company,
          items: lines,
          totals,
        },
        outputPath,
      );

      const grandFmt = totals.grandTotal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      process.stdout.write(`✓ Quote written: ${outputPath}\n`);
      process.stdout.write(
        `  ${quoteNumber} — ${lines.length} line(s) — Grand Total: ${grandFmt} THB\n`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`✗ ${msg}\n`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
