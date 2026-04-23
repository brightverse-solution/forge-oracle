import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigError, loadConfig } from '../src/config.ts';

const tmp = mkdtempSync(join(tmpdir(), 'forge-config-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function writeConfig(name: string, contents: string): string {
  const p = join(tmp, name);
  writeFileSync(p, contents);
  return p;
}

describe('loadConfig', () => {
  test('loads a valid minimal config', () => {
    const path = writeConfig(
      'valid.json',
      JSON.stringify({
        company: { name: 'Test Co.', address: ['Line 1'] },
      }),
    );
    const c = loadConfig(path);
    expect(c.company.name).toBe('Test Co.');
    expect(c.company.address).toEqual(['Line 1']);
  });

  test('loads a config with optional phone + taxId', () => {
    const path = writeConfig(
      'full.json',
      JSON.stringify({
        company: {
          name: 'Test Co.',
          address: ['Line 1', 'Line 2'],
          phone: '+66-2-000-0000',
          taxId: '0-0000-00000-00-0',
        },
      }),
    );
    const c = loadConfig(path);
    expect(c.company.phone).toBe('+66-2-000-0000');
    expect(c.company.taxId).toBe('0-0000-00000-00-0');
  });

  test('errors with friendly message when file is missing', () => {
    expect(() => loadConfig(join(tmp, 'does-not-exist.json'))).toThrow(ConfigError);
    expect(() => loadConfig(join(tmp, 'does-not-exist.json'))).toThrow(/Could not read config/);
  });

  test('errors on invalid JSON', () => {
    const path = writeConfig('bad.json', '{ not json');
    expect(() => loadConfig(path)).toThrow(/Invalid JSON/);
  });

  test('errors when company object missing', () => {
    const path = writeConfig('no-company.json', JSON.stringify({ other: true }));
    expect(() => loadConfig(path)).toThrow(/must have a "company" object/);
  });

  test('errors when name missing', () => {
    const path = writeConfig('no-name.json', JSON.stringify({ company: { address: ['x'] } }));
    expect(() => loadConfig(path)).toThrow(/company.name is required/);
  });

  test('errors when address missing or empty', () => {
    const path = writeConfig(
      'no-addr.json',
      JSON.stringify({ company: { name: 'X', address: [] } }),
    );
    expect(() => loadConfig(path)).toThrow(/non-empty array/);
  });
});
