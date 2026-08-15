import { beforeEach, expect, jest, test } from '@jest/globals';

import { renderMermaidSVG } from 'beautiful-mermaid';
import {
	buildZigzagSource,
	detectLinearFlowchartChain,
	extractBandParts,
	findNodeBox,
	readSvgAspectRatio,
	renderComposedZigzag,
	renderMermaidAutoFitSVG,
	stripWrapGroupChrome,
} from '@marp-extended/mermaid-autofit';

const EIGHT_NODE_CHAIN = [
	'flowchart LR',
	'  A[地方分权] --> B[释放发展活力]',
	'  B --> C[重复建设与经济过热]',
	'  C --> D[中央收权：分税制]',
	'  D --> E[宏观调控与集中投资]',
	'  E --> F[土地财政与投资依赖]',
	'  F --> G[土地收入收缩]',
	'  G --> H[下一轮重新校准钱、权、责]',
].join('\n');

const FIVE_NODE_TD_CHAIN = [
	'flowchart TD',
	'  A[土地财政退潮] --> B[传统投资收益下降]',
	'  B --> C[地方自主空间减少]',
	'  C --> D[重配资金、权力与责任]',
	'  D --> E[收入增长、消费与公共服务]',
].join('\n');

const renderMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;

beforeEach(() => {
	renderMock.mockClear();
});

// --- detectLinearFlowchartChain ---

test('detects a multi-statement linear LR chain', () => {
	const chain = detectLinearFlowchartChain(EIGHT_NODE_CHAIN);
	expect(chain?.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
	expect(chain?.nodes[0]?.label).toBe('地方分权');
	expect(chain?.nodes[0]?.shape).toBe('rectangle');
});

test('detects a single-line chained LR chain', () => {
	const chain = detectLinearFlowchartChain('flowchart LR\n  A[one] --> B[two] --> C[three] --> D[four] --> E[five]');
	expect(chain?.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
});

test('detects a linear TD chain with its direction', () => {
	const chain = detectLinearFlowchartChain(FIVE_NODE_TD_CHAIN);
	expect(chain?.direction).toBe('TD');
	expect(chain?.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
});

test('rejects raw RL/BT directions (normalized by the parser but mirrored visually)', () => {
	expect(detectLinearFlowchartChain(EIGHT_NODE_CHAIN.replace('flowchart LR', 'flowchart RL'))).toBeNull();
	expect(detectLinearFlowchartChain(FIVE_NODE_TD_CHAIN.replace('flowchart TD', 'flowchart BT'))).toBeNull();
});

test('rejects branched graphs', () => {
	const branched = [
		'flowchart LR',
		'  L[地方] --> G[增长]',
		'  C[中央] --> M[调控]',
		'  G --> M',
		'  M --> X',
		'  X --> Y',
	].join('\n');
	expect(detectLinearFlowchartChain(branched)).toBeNull();
});

test('rejects chains with edge labels, dotted edges, subgraphs, or style statements', () => {
	const base = 'flowchart LR\n  A --> B --> C --> D --> E';
	expect(detectLinearFlowchartChain(base.replace('B --> C', 'B -->|标签| C'))).toBeNull();
	expect(detectLinearFlowchartChain(base.replace('C --> D', 'C -.-> D'))).toBeNull();
	expect(detectLinearFlowchartChain(`${base}\n  subgraph s\n  end`)).toBeNull();
	expect(detectLinearFlowchartChain(`${base}\n  style A fill:#fff`)).toBeNull();
});

test('rejects chains shorter than the threshold', () => {
	const short = 'flowchart LR\n  A --> B --> C --> D';
	expect(detectLinearFlowchartChain(short)).toBeNull();
	expect(detectLinearFlowchartChain(short, 4)?.nodes).toHaveLength(4);
});

test('rejects non-flowchart diagrams', () => {
	expect(detectLinearFlowchartChain('sequenceDiagram\n  A->>B: hi')).toBeNull();
});

// --- buildZigzagSource ---

test('zigzag alternates row directions and adds connectors and hidden styles', () => {
	const chain = detectLinearFlowchartChain(EIGHT_NODE_CHAIN)!;
	const source = buildZigzagSource(chain, 2);

	expect(source).toContain('flowchart TD');
	expect(source.match(/subgraph mwWrap\d\[" "\]/g)).toHaveLength(2);
	expect(source).toContain('direction LR');
	expect(source).toContain('direction RL');
	expect(source).toContain('D --> E');
	expect(source).toContain('style mwWrap0 fill:none,stroke:none');
	expect(source).toContain('style mwWrap1 fill:none,stroke:none');
	expect(source).toContain('A["地方分权"]');
});

test('zigzag rejects out-of-range band counts', () => {
	const chain = detectLinearFlowchartChain(EIGHT_NODE_CHAIN)!;
	expect(() => buildZigzagSource(chain, 1)).toThrow();
	expect(() => buildZigzagSource(chain, 8)).toThrow();
});

test('zigzag folds TD chains into vertical columns with BT alternation', () => {
	const chain = detectLinearFlowchartChain(FIVE_NODE_TD_CHAIN)!;
	const source = buildZigzagSource(chain, 2);

	expect(source).toContain('flowchart LR');
	expect(source.match(/subgraph mwWrap\d\[" "\]/g)).toHaveLength(2);
	expect(source).toContain('direction TD');
	expect(source).toContain('direction BT');
	expect(source).toContain('C --> D');
	expect(source).toContain('style mwWrap1 fill:none,stroke:none');
});

// --- svg utilities ---

test('readSvgAspectRatio prefers width/height and falls back to viewBox', () => {
	expect(readSvgAspectRatio('<svg width="800" height="200"></svg>')).toBe(4);
	expect(readSvgAspectRatio('<svg viewBox="0 0 600 300"></svg>')).toBe(2);
	expect(readSvgAspectRatio('<svg></svg>')).toBeNull();
	expect(readSvgAspectRatio('not svg')).toBeNull();
});

test('stripWrapGroupChrome removes only generated wrap groups', () => {
	const svg = '<svg><g class="subgraph" data-id="mwWrap0" data-label=" "><rect/><text> </text></g>'
		+ '<g class="subgraph" data-id="keep" data-label="K"><rect/></g><g class="node" data-id="A"><rect/></g></svg>';
	const stripped = stripWrapGroupChrome(svg);
	expect(stripped).not.toContain('mwWrap0');
	expect(stripped).toContain('data-id="keep"');
	expect(stripped).toContain('data-id="A"');
});

// --- compose utilities ---

test('extractBandParts splits root attrs, style, defs, and content', () => {
	const svg = '<svg width="300" height="60" style="--accent:red"><style>text { fill: black; }</style>'
		+ '<defs><marker id="arrowhead"></marker></defs><g class="node" data-id="A"><rect x="8" y="8" width="145" height="44"/></g></svg>';
	const parts = extractBandParts(svg);
	expect(parts?.width).toBe(300);
	expect(parts?.height).toBe(60);
	expect(parts?.styleAttr).toBe('--accent:red');
	expect(parts?.styleBlock).toContain('<style>');
	expect(parts?.defs).toContain('arrowhead');
	expect(parts?.content).toContain('class="node"');
	expect(parts?.content).not.toContain('<defs>');
	expect(extractBandParts('not svg')).toBeNull();
});

test('findNodeBox locates rect and ellipse boxes', () => {
	const svg = '<g class="node" data-id="A"><rect x="8" y="10" width="145" height="44"/></g>'
		+ '<g class="node" data-id="B"><ellipse cx="50" cy="60" rx="20" ry="15"/></g>';
	expect(findNodeBox(svg, 'A')).toEqual({ x: 8, y: 10, w: 145, h: 44 });
	expect(findNodeBox(svg, 'B')).toEqual({ x: 30, y: 45, w: 40, h: 30 });
	expect(findNodeBox(svg, 'missing')).toBeNull();
});

test('renderComposedZigzag composes bands with elbow connectors and no group chrome', () => {
	const chain = detectLinearFlowchartChain(EIGHT_NODE_CHAIN)!;
	const svg = renderComposedZigzag(chain, 2);

	expect(svg).not.toBeNull();
	expect(svg).not.toContain('mwWrap');
	expect(svg).not.toContain('class="subgraph"');
	expect(svg!.match(/class="node"/g)).toHaveLength(8);
	expect(svg!.match(/data-autofit-connector/g)).toHaveLength(1);
	// Self-drawn edges use the smaller custom arrowhead and subdued opacity.
	expect(svg).toContain('id="mwArrowhead"');
	expect(svg).toContain('marker-end="url(#mwArrowhead)"');
	expect(svg).toContain('stroke-opacity="0.6"');
	// Two 4-node rows stacked with the default gap.
	expect(readSvgAspectRatio(svg!)).toBeGreaterThan(2.2);
});

test('renderComposedZigzag rejects invalid band counts', () => {
	const chain = detectLinearFlowchartChain(EIGHT_NODE_CHAIN)!;
	expect(renderComposedZigzag(chain, 1)).toBeNull();
	expect(renderComposedZigzag(chain, 8)).toBeNull();
});

// --- renderMermaidAutoFitSVG (mocked renderer) ---

test('wraps an over-wide chain until the aspect ratio fits', () => {
	const svg = renderMermaidAutoFitSVG(EIGHT_NODE_CHAIN);

	expect(readSvgAspectRatio(svg)).toBeLessThanOrEqual(2.2);
	const sources = renderMock.mock.calls.map((call) => call[0]);
	expect(sources[0]).toBe(EIGHT_NODE_CHAIN);
	// Composition path: bands render as standalone LR/RL chains.
	expect(sources.some((source) => source.startsWith('flowchart RL'))).toBe(true);
	// Original render + 2 band renders + 3 band renders.
	expect(renderMock).toHaveBeenCalledTimes(6);
});

test('folds an over-tall TD chain into columns', () => {
	const svg = renderMermaidAutoFitSVG(FIVE_NODE_TD_CHAIN);

	expect(readSvgAspectRatio(svg)).toBeGreaterThanOrEqual(0.8);
	const sources = renderMock.mock.calls.map((call) => call[0]);
	expect(sources[0]).toBe(FIVE_NODE_TD_CHAIN);
	expect(sources[1]).toContain('flowchart TD');
	expect(sources[2]).toContain('flowchart BT');
	// Original render + one 2-column attempt (2 band renders).
	expect(renderMock).toHaveBeenCalledTimes(3);
});

test('leaves in-band TD chains untouched', () => {
	renderMermaidAutoFitSVG(FIVE_NODE_TD_CHAIN, {}, { minAspectRatio: 0.3 });
	expect(renderMock).toHaveBeenCalledTimes(1);
	expect(renderMock.mock.calls[0]?.[0]).toBe(FIVE_NODE_TD_CHAIN);
});

test('leaves already-fitting diagrams untouched', () => {
	renderMermaidAutoFitSVG(EIGHT_NODE_CHAIN, {}, { targetAspectRatio: 100 });
	expect(renderMock).toHaveBeenCalledTimes(1);
	expect(renderMock.mock.calls[0]?.[0]).toBe(EIGHT_NODE_CHAIN);
});

test('leaves non-chain diagrams untouched', () => {
	const branched = 'flowchart LR\n  L --> G\n  C --> M\n  G --> M';
	renderMermaidAutoFitSVG(branched);
	expect(renderMock).toHaveBeenCalledTimes(1);
	expect(renderMock.mock.calls[0]?.[0]).toBe(branched);
});

test('respects the enabled switch', () => {
	renderMermaidAutoFitSVG(EIGHT_NODE_CHAIN, {}, { enabled: false });
	expect(renderMock).toHaveBeenCalledTimes(1);
	expect(renderMock.mock.calls[0]?.[0]).toBe(EIGHT_NODE_CHAIN);
});

test('falls back to the original render when band renders fail', () => {
	const defaultImplementation = renderMock.getMockImplementation();
	renderMock.mockImplementation(((source: string, options?: Record<string, string | number | boolean>) => {
		if (source.includes('mwWrap') || source.includes('flowchart RL')) {
			throw new Error('layout exploded');
		}
		return '<svg width="1600" height="60"><text>mock diagram</text></svg>';
	}) as typeof renderMermaidSVG);

	try {
		const svg = renderMermaidAutoFitSVG(EIGHT_NODE_CHAIN);
		expect(svg).toContain('width="1600"');
	} finally {
		if (defaultImplementation) {
			renderMock.mockImplementation(defaultImplementation);
		}
	}
});
