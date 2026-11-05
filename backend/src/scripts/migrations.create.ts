import fs from 'node:fs';
import path from 'node:path';

import { ROOT_DIR } from '../config/env.js';

const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function nextPrefix(): string {
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const existing = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .map((name) => Number(name.split('_')[0]))
    .filter((value) => Number.isFinite(value));

  const next = (existing.length ? Math.max(...existing) : 0) + 1;
  return String(next).padStart(3, '0');
}

const rawName = process.argv.slice(2).join(' ').trim();
if (!rawName) {
  console.error('Usage: npm run migrate:create -- <name>');
  console.error('Example: npm run migrate:create -- add_report_notes');
  process.exit(1);
}

const slug = slugify(rawName);
if (!slug) {
  console.error('Invalid migration name');
  process.exit(1);
}

const fileName = `${nextPrefix()}_${slug}.sql`;
const filePath = path.join(MIGRATIONS_DIR, fileName);

fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
fs.writeFileSync(
  filePath,
  `-- ${fileName}\n\n`,
  'utf8',
);

console.log(`Created ${path.relative(ROOT_DIR, filePath)}`);
