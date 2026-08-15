/**
 * Integration tests against the real beautiful-mermaid renderer (no mock).
 * They guard the assumptions mermaid-autofit makes about parseMermaid,
 * subgraph direction overrides, and the `<g class="subgraph" data-id=...>`
 * chrome structure that gets stripped after rendering.
 */
import { expect, test } from '@jest/globals';

import { renderMermaidSVG } from 'beautiful-mermaid';
import {
	detectLinearFlowchartChain,
	findNodeBox,
	readSvgAspectRatio,
	renderMermaidAutoFitSVG,
} from '@marp-extended/mermaid-autofit';

/** Resolve a node's placed center in a composed SVG, accounting for its translate wrapper. */
function placedCenter(svg: string, id: string, axis: 'x' | 'y'): number {
	const wrapper = svg.match(new RegExp(`<g transform="translate\\(([-\\d.]+),([-\\d.]+)\\)"><g class="node" data-id="${id}"`));
	const box = findNodeBox(svg, id);
	expect(wrapper).not.toBeNull();
	expect(box).not.toBeNull();
	const x = box!.x + Number(wrapper![1]);
	const y = box!.y + Number(wrapper![2]);
	return axis === 'x' ? x + box!.w / 2 : y + box!.h / 2;
}

// Chains taken from slides/朱镕基时代与经济政策.md.
const CHAIN_8 = [
	'flowchart LR',
	'  A[地方分权] --> B[释放发展活力]',
	'  B --> C[重复建设与经济过热]',
	'  C --> D[中央收权：分税制]',
	'  D --> E[宏观调控与集中投资]',
	'  E --> F[土地财政与投资依赖]',
	'  F --> G[土地收入收缩]',
	'  G --> H[下一轮重新校准钱、权、责]',
].join('\n');

const CHAIN_6 = [
	'flowchart LR',
	'  A[税收空间有限] --> B[地方仍要发展、投资、保就业]',
	'  B --> C[土地出让与房地产扩张]',
	'  C --> D[基础设施与城市建设]',
	'  D --> E[继续依赖土地收入]',
	'  E --> F[房地产下行后财政弹性下降]',
].join('\n');

const BRANCHED = [
	'flowchart LR',
	'  L[地方：保留发展动力] --> G[全国经济增长]',
	'  C[中央：取得更多税收] --> M[宏观调控与重大工程]',
	'  G --> M',
].join('\n');

const CHAIN_5_TD = [
	'flowchart TD',
	'  A[土地财政退潮] --> B[传统投资收益下降]',
	'  B --> C[地方自主空间减少]',
	'  C --> D[重配资金、权力与责任]',
	'  D --> E[收入增长、消费与公共服务]',
].join('\n');

test('real renderer: 8-node chain folds into a compact grid with all labels kept', () => {
	const originalAspect = readSvgAspectRatio(renderMermaidSVG(CHAIN_8));
	expect(originalAspect).toBeGreaterThan(2.2);

	const fitted = renderMermaidAutoFitSVG(CHAIN_8);
	const fittedAspect = readSvgAspectRatio(fitted);
	expect(fittedAspect).not.toBeNull();
	// Grid-aligned rows trade aspect target overshoot for column alignment and
	// vertical compactness; the result is still drastically less wide than the
	// original straight chain (14.4 → ~3.7).
	expect(fittedAspect!).toBeLessThan(originalAspect! / 3);

	// Composition keeps every node exactly once and adds band connectors.
	expect(fitted.match(/class="node"/g)).toHaveLength(8);
	expect(fitted.match(/data-autofit-connector/g)).toHaveLength(3);

	// Nodes land on shared columns across bands (4 bands: A,B | C,D | E,F | G,H).
	expect(placedCenter(fitted, 'A', 'x')).toBeCloseTo(placedCenter(fitted, 'D', 'x'), 1);
	expect(placedCenter(fitted, 'A', 'x')).toBeCloseTo(placedCenter(fitted, 'E', 'x'), 1);
	expect(placedCenter(fitted, 'A', 'x')).toBeCloseTo(placedCenter(fitted, 'H', 'x'), 1);
	expect(placedCenter(fitted, 'B', 'x')).toBeCloseTo(placedCenter(fitted, 'C', 'x'), 1);
	expect(placedCenter(fitted, 'B', 'x')).toBeCloseTo(placedCenter(fitted, 'F', 'x'), 1);
	expect(placedCenter(fitted, 'B', 'x')).toBeCloseTo(placedCenter(fitted, 'G', 'x'), 1);

	// All edges are self-drawn: one stroke width, subdued opacity, and the
	// smaller custom arrowhead (library stock head is 8x5; ours is 6x3.5).
	const strokeWidths = new Set(
		[...fitted.matchAll(/class="edge"[^>]*stroke-width="([\d.]+)"/g)].map((match) => match[1]),
	);
	expect([...strokeWidths]).toEqual(['1']);
	const markers = new Set(
		[...fitted.matchAll(/class="edge"[^>]*marker-end="url\(#([^)]+)\)"/g)].map((match) => match[1]),
	);
	expect([...markers]).toEqual(['mwArrowhead']);
	expect(fitted.match(/stroke-opacity="0.6"/g)!.length).toBeGreaterThanOrEqual(7);

	// Wrap chrome is fully stripped; no subgraph groups remain.
	expect(fitted).not.toContain('class="subgraph"');
	expect(fitted).not.toContain('mwWrap');

	for (const label of ['地方分权', '释放发展活力', '重复建设与经济过热', '中央收权：分税制', '宏观调控与集中投资', '土地财政与投资依赖', '土地收入收缩', '下一轮重新校准钱、权、责']) {
		expect(fitted).toContain(label);
	}
});

test('real renderer: 6-node chain wraps well below the original aspect ratio', () => {
	const originalAspect = readSvgAspectRatio(renderMermaidSVG(CHAIN_6));
	const fitted = renderMermaidAutoFitSVG(CHAIN_6);
	const aspect = readSvgAspectRatio(fitted);
	expect(aspect).not.toBeNull();
	// Two grid-aligned rows: ~2.6 vs the original 12.0.
	expect(aspect!).toBeLessThan(originalAspect! / 3);
	expect(fitted).not.toContain('mwWrap');
	expect(fitted).toContain('房地产下行后财政弹性下降');
});

test('real renderer: 5-node TD chain folds into aligned columns inside the aspect band', () => {
	const originalAspect = readSvgAspectRatio(renderMermaidSVG(CHAIN_5_TD));
	expect(originalAspect).not.toBeNull();
	expect(originalAspect!).toBeLessThan(0.8);

	const fitted = renderMermaidAutoFitSVG(CHAIN_5_TD);
	const fittedAspect = readSvgAspectRatio(fitted);
	expect(fittedAspect).not.toBeNull();
	expect(fittedAspect!).toBeGreaterThanOrEqual(0.8);
	// Tolerance beyond the nominal 2.2 target: the compact lane gap trades a
	// small overshoot (~2.4) for narrower columns; the fit loop keeps the best
	// available fold.
	expect(fittedAspect!).toBeLessThanOrEqual(2.6);

	// Two columns share rows: C and D sit on the same grid line.
	expect(placedCenter(fitted, 'C', 'y')).toBeCloseTo(placedCenter(fitted, 'D', 'y'), 1);

	expect(fitted).not.toContain('class="subgraph"');
	expect(fitted).not.toContain('mwWrap');
	expect(fitted.match(/class="node"/g)).toHaveLength(5);
	expect(fitted.match(/data-autofit-connector/g)).toHaveLength(1);
	for (const label of ['土地财政退潮', '传统投资收益下降', '地方自主空间减少', '重配资金、权力与责任', '收入增长、消费与公共服务']) {
		expect(fitted).toContain(label);
	}
});

test('real renderer: branched diagrams render unchanged', () => {
	const plain = renderMermaidSVG(BRANCHED);
	const fitted = renderMermaidAutoFitSVG(BRANCHED);
	expect(detectLinearFlowchartChain(BRANCHED)).toBeNull();
	expect(fitted).toBe(plain);
});

test('real renderer: disabled auto-fit renders the original source', () => {
	const plain = renderMermaidSVG(CHAIN_8);
	const fitted = renderMermaidAutoFitSVG(CHAIN_8, {}, { enabled: false });
	expect(fitted).toBe(plain);
});
