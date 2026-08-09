import { expect, test } from '@jest/globals';
import { Marp } from '@marp-team/marp-core';

import {
	BUILTIN_THEME_SCALE_CSS,
	wrapBuiltinThemeScaleCss,
} from '@/utilities/builtinThemeScale';

test('builtin scale CSS targets default, gaia, and uncover', () => {
	expect(BUILTIN_THEME_SCALE_CSS).toContain('data-theme="default"');
	expect(BUILTIN_THEME_SCALE_CSS).toContain('data-theme="gaia"');
	expect(BUILTIN_THEME_SCALE_CSS).toContain('data-theme="uncover"');
	expect(BUILTIN_THEME_SCALE_CSS).toContain('font-size: 13pt');
	expect(BUILTIN_THEME_SCALE_CSS).not.toContain('data-theme="kami"');
});

test('wrapBuiltinThemeScaleCss emits a style tag for export injection', () => {
	const wrapped = wrapBuiltinThemeScaleCss();
	expect(wrapped).toContain('class="marp-extended-builtin-scale"');
	expect(wrapped).toContain('font-size: 13pt');
});

test.each(['default', 'gaia', 'uncover'] as const)(
	'%s slides receive data-theme so the scale selector can match',
	(theme) => {
		const marp = new Marp({ minifyCSS: true });
		const { html } = marp.render(`---
marp: true
theme: ${theme}
---

# Title

Body text.
`);

		expect(html).toContain(`data-theme="${theme}"`);
	},
);
