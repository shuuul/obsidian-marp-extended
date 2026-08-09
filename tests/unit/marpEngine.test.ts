import { expect, test } from '@jest/globals';

import { createMarpEngine } from '@/runtime/marpEngine';

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
