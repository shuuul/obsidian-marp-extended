#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const themesDir = join(root, 'assets/themes');
const mermaidDir = join(root, 'assets/mermaid-themes');
const outPath = join(root, 'src/utilities/packagedDefaultThemeCss.ts');

const THEME_ORDER = ['kami.css', 'kami-en.css', 'github.css', 'beamer.css', 'olive.css', 'dracula.css'];
const MERMAID_ORDER = ['kami.css', 'kami-en.css', 'github.css', 'beamer.css', 'olive.css', 'dracula.css'];

function listCss(directory) {
	if (!existsSync(directory)) {
		throw new Error(`Missing theme directory: ${directory}`);
	}
	return readdirSync(directory).filter((name) => name.endsWith('.css')).sort();
}

function ordered(names, preferred) {
	const set = new Set(names);
	const orderedNames = preferred.filter((name) => set.has(name));
	for (const name of names) {
		if (!set.has(name) || orderedNames.includes(name)) {
			continue;
		}
		orderedNames.push(name);
	}
	return orderedNames;
}

function record(directory, names) {
	const lines = ['export const PLACEHOLDER: Record<string, string> = {'];
	// filled by caller
	return { directory, names, lines };
}

function emitRecord(exportName, directory, names) {
	const lines = [`export const ${exportName}: Record<string, string> = {`];
	for (const name of names) {
		const css = readFileSync(join(directory, name), 'utf8');
		lines.push(`\t${JSON.stringify(name)}: ${JSON.stringify(css)},`);
	}
	lines.push('};');
	return lines.join('\n');
}

const themeNames = ordered(listCss(themesDir), THEME_ORDER);
const mermaidNames = ordered(listCss(mermaidDir), MERMAID_ORDER);

const body = [
	'// This file packages the default editable theme CSS into main.js.',
	'// Source files live under assets/themes and assets/mermaid-themes.',
	'// Regenerate with: npm run sync:themes',
	'',
	emitRecord('PACKAGED_DEFAULT_THEME_CSS', themesDir, themeNames),
	'',
	emitRecord('PACKAGED_DEFAULT_MERMAID_THEME_CSS', mermaidDir, mermaidNames),
	'',
].join('\n');

writeFileSync(outPath, body);
console.log(`Wrote ${outPath}`);
console.log(`  themes: ${themeNames.join(', ')}`);
console.log(`  mermaid: ${mermaidNames.join(', ')}`);
