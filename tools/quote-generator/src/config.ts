import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CompanyConfig } from './types.ts';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function defaultConfigPath(): string {
  return join(homedir(), '.forge-oracle', 'config.json');
}

export function loadConfig(path: string = defaultConfigPath()): CompanyConfig {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new ConfigError(
      `Could not read config at ${path}. Copy config.example.json to that path and fill in your company details, or pass --config <path>.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ConfigError(`Invalid JSON in ${path}: ${(e as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigError('Config must be a JSON object');
  }
  const c = parsed as Partial<CompanyConfig>;
  if (!c.company || typeof c.company !== 'object') {
    throw new ConfigError('Config must have a "company" object');
  }
  const co = c.company;
  if (!co.name || typeof co.name !== 'string') {
    throw new ConfigError('company.name is required (string)');
  }
  if (!Array.isArray(co.address) || co.address.length === 0) {
    throw new ConfigError('company.address must be a non-empty array of strings');
  }
  for (const line of co.address) {
    if (typeof line !== 'string') {
      throw new ConfigError('company.address entries must all be strings');
    }
  }
  if (co.phone !== undefined && typeof co.phone !== 'string') {
    throw new ConfigError('company.phone must be a string if present');
  }
  if (co.taxId !== undefined && typeof co.taxId !== 'string') {
    throw new ConfigError('company.taxId must be a string if present');
  }

  return { company: co };
}
