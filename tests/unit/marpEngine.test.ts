import { expect, test } from '@jest/globals';

import { createMarpEngine } from '@/runtime/marpEngine';
import { MARP_EXTENDED_STRUCTURAL_CSS } from '@/utilities/marpExtendedStructuralCss';

test('creates isolated Core 5 engines with the shared Marpit runtime contract', () => {
	const first = createMarpEngine({ container: [], slideContainer: [] });
	const second = createMarpEngine({ container: [], slideContainer: [] });
	const rendered = first.render([
		'---',
		'marp: true',
		'paginate: true',
		'---',
		'<!-- _class: lead -->',
		'# One',
		'![bg right](https://example.com/background.png)',
		'',
		'* fragment',
		'',
		'<style scoped>h1 { color: red; }</style>',
		'',
		'<!-- presenter note -->',
		'---',
		'# Two',
	].join('\n'));

	expect(first).not.toBe(second);
	expect(rendered.html).toContain('data-marpit-fragment="1"');
	expect(rendered.html).toContain('data-marpit-advanced-background="background"');
	expect(rendered.html).toContain('class="lead"');
	expect(rendered.html).toContain('data-marpit-pagination-total="2"');
	expect(rendered.html).toMatch(/data-marpit-scope-[\w-]+/);
	expect(rendered.comments).toEqual([['presenter note'], []]);
});

test('scopes theme-neutral link colors to exported slides without nesting section selectors', () => {
	const marp = createMarpEngine({ container: [], slideContainer: [] });
	const rendered = marp.render(`<style>${MARP_EXTENDED_STRUCTURAL_CSS}</style>\n\n[Link](https://example.com)`);

	expect(rendered.css).toContain('section :where(a[href])');
	expect(rendered.css).toContain('color:inherit');
	expect(rendered.css).not.toContain('section :where(section)');
});
