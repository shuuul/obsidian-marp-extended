import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { Marp } from '@marp-team/marp-core';

function renderThemeCss(themeFile: string, themeName: string): string {
	const themeCss = readFileSync(join(process.cwd(), 'vault/themes', themeFile), 'utf8');
	const marp = new Marp({ minifyCSS: true });

	marp.themeSet.add(themeCss);

	return marp.render(`---
marp: true
theme: ${themeName}
---

> 2026-06-25
> Thursday
`).css;
}

function renderThemeHtml(themeFile: string, themeName: string, size: string): string {
	const themeCss = readFileSync(join(process.cwd(), 'vault/themes', themeFile), 'utf8');
	const marp = new Marp({ minifyCSS: true });

	marp.themeSet.add(themeCss);

	return marp.render(`---
marp: true
theme: ${themeName}
size: ${size}
---

# Portfolio
`).html;
}

test.each([
	['kami.css', 'kami'],
	['kami-en.css', 'kami-en'],
])('%s defines blockquote styling in Marp output', (themeFile, themeName) => {
	const css = renderThemeCss(themeFile, themeName);

	expect(css).toContain('blockquote{margin:0 0 var(--rhythm-section) 0;padding:0 0 0 12pt;border-left:2pt solid var(--brand);color:var(--dark-warm)}');
	expect(css).toContain('blockquote > :last-child{margin-bottom:0}');
});

test.each([
	['kami.css', 'kami'],
	['kami-en.css', 'kami-en'],
])('%s supports the A4 portrait portfolio size', (themeFile, themeName) => {
	const html = renderThemeHtml(themeFile, themeName, 'portfolio');

	expect(html).toContain('viewBox="0 0 793.7007874015749 1122.5196850393702"');
});
