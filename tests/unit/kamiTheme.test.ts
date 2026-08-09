import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { Marp } from '@marp-team/marp-core';

function renderThemeCss(themeFile: string, themeName: string): string {
	const themeCss = readFileSync(join(process.cwd(), 'assets/themes', themeFile), 'utf8');
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
	const themeCss = readFileSync(join(process.cwd(), 'assets/themes', themeFile), 'utf8');
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

test('kami.css defines blockquote styling in Marp output', () => {
	const css = renderThemeCss('kami.css', 'kami');

	expect(css).toContain('blockquote{margin:0 0 var(--rhythm-section) 0;padding:0 0 0 12pt;border-left:2pt solid var(--brand);color:var(--dark-warm)}');
	expect(css).toContain('blockquote > :last-child{margin-bottom:0}');
});

test('kami.css supports bilingual font stacks and the A4 portrait portfolio size', () => {
	const themeCss = readFileSync(join(process.cwd(), 'assets/themes', 'kami.css'), 'utf8');
	expect(themeCss).toContain('TsangerJinKai02');
	expect(themeCss).toContain('Charter');
	expect(themeCss).toContain('section:lang(en)');
	expect(themeCss).toContain('letter-spacing: 0.3pt');
	expect(themeCss).toContain('letter-spacing: -0.5pt');
	expect(themeCss).not.toContain('@theme kami-en');

	const html = renderThemeHtml('kami.css', 'kami', 'portfolio');
	expect(html).toContain('viewBox="0 0 794 1123"');
});

test('kami.css exposes only namespaced Extended component classes', () => {
	const themeCss = readFileSync(join(process.cwd(), 'assets/themes', 'kami.css'), 'utf8');

	expect(themeCss).not.toMatch(/(^|\n)\.(?:eyebrow|lead|sub|meta|mt|ml|ms|mb|mi|mc|co|c2|t2x2|note)\b/m);
	expect(themeCss).not.toMatch(/table\.(?:data|t2x2)\b/);
	expect(themeCss).toContain('.marp-extended-lead');
	expect(themeCss).toContain('.marp-extended-metadata');
	expect(themeCss).toContain('.marp-extended-callout-note');
	expect(themeCss).toContain('.marp-extended-columns');
	expect(themeCss).toContain('table.marp-extended-cards');
});

test('kami.css applies EN typography when lang is en', () => {
	const themeCss = readFileSync(join(process.cwd(), 'assets/themes', 'kami.css'), 'utf8');
	const marp = new Marp({ minifyCSS: true });
	marp.themeSet.add(themeCss);

	const { html, css } = marp.render(`---
marp: true
theme: kami
lang: en
---

<!-- _class: cover -->

# Title

<div class="marp-extended-metadata">Meta</div>
`);

	expect(html).toContain('lang="en"');
	expect(css).toContain(':lang(en)');
	expect(css).toContain('Charter');
	expect(css).toContain('TsangerJinKai02');
});
