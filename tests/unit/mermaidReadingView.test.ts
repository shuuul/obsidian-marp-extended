/** @jest-environment jsdom */

import { expect, test } from '@jest/globals';

import { getReadingViewMermaidBlocks } from '@/editor/mermaidReadingView';

test('reading view mermaid blocks match mermaid fences including captioned language classes', () => {
	const root = document.createElement('div');
	root.innerHTML = [
		'<pre><code class="language-mermaid">flowchart LR\nA --&gt; B</code></pre>',
		'<pre><code class="language-mermaid[Kami]">flowchart TD\nX</code></pre>',
		'<pre><code class="language-ts">const x = 1;</code></pre>',
	].join('');

	const blocks = getReadingViewMermaidBlocks(root);
	expect(blocks).toHaveLength(2);
	expect(blocks[0]?.source).toContain('flowchart LR');
	expect(blocks[1]?.alt).toBe('Kami');
});
