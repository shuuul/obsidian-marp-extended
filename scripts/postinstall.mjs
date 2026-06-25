#!/usr/bin/env node

import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.CI) {
	process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const example = join(root, '.env.local.example');
const target = join(root, '.env.local');

if (existsSync(example) && !existsSync(target)) {
	copyFileSync(example, target);
	console.log('Created .env.local from .env.local.example');
	console.log('Edit it to set OBSIDIAN_VAULT for auto-copy during development.');
}
