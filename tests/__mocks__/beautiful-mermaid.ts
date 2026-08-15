import { jest } from '@jest/globals';

export type RenderOptions = Record<string, string | number | boolean>;

export type MockMermaidNode = { id: string; label: string; shape: string };
export type MockMermaidEdge = {
	source: string;
	target: string;
	label?: string;
	style: string;
	hasArrowStart: boolean;
	hasArrowEnd: boolean;
};
export type MermaidGraph = {
	direction: string;
	nodes: Map<string, MockMermaidNode>;
	edges: MockMermaidEdge[];
	subgraphs: Array<{ id: string; label: string; nodeIds: string[]; children: unknown[] }>;
	classDefs: Map<string, Record<string, string>>;
	classAssignments: Map<string, string>;
	nodeStyles: Map<string, Record<string, string>>;
	linkStyles: Map<number | 'default', Record<string, string>>;
};

const SHAPE_PATTERNS: Array<[RegExp, string]> = [
	[/^\(\(\(([\s\S]*)\)\)\)$/, 'doublecircle'],
	[/^\(\(([\s\S]*)\)\)$/, 'circle'],
	[/^\(\[([\s\S]*)\]\)$/, 'stadium'],
	[/^\[\[([\s\S]*)\]\]$/, 'subroutine'],
	[/^\[\(([\s\S]*)\)\]$/, 'cylinder'],
	[/^\{\{([\s\S]*)\}\}$/, 'hexagon'],
	[/^\{([\s\S]*)\}$/, 'diamond'],
	[/^\[\/([\s\S]*)\\]$/, 'trapezoid'],
	[/^\[\\([\s\S]*)\/]$/, 'trapezoid-alt'],
	[/^\[([\s\S]*)]$/, 'rectangle'],
	[/^\(([\s\S]*)\)$/, 'rounded'],
	[/^>([\s\S]*)]$/, 'asymmetric'],
];

const EDGE_SPLIT_PATTERN = /\s*(<-->|-->|<--|---|-\.->|==>)(?:\|([^|]*)\|)?\s*/;

function unquoteLabel(label: string): string {
	const trimmed = label.trim();
	const quoted = (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"));
	return (quoted ? trimmed.slice(1, -1) : trimmed).replace(/#quot;/g, '"').replace(/<br\s*\/?>/g, '\n');
}

function registerNode(graph: MermaidGraph, token: string): string {
	const match = token.trim().match(/^([A-Za-z0-9_][\w-]*)\s*([\s\S]*)$/);
	if (!match) {
		throw new Error(`Cannot parse node token: ${token}`);
	}
	const id = match[1]!;
	const rest = match[2]!.trim();
	if (!graph.nodes.has(id)) {
		let label = id;
		let shape = 'rectangle';
		if (rest) {
			for (const [pattern, candidate] of SHAPE_PATTERNS) {
				const shapeMatch = rest.match(pattern);
				if (shapeMatch) {
					label = unquoteLabel(shapeMatch[1]!);
					shape = candidate;
					break;
				}
			}
		}
		graph.nodes.set(id, { id, label, shape });
	}
	return id;
}

function parseEdgeLine(graph: MermaidGraph, line: string): void {
	const parts = line.split(EDGE_SPLIT_PATTERN);
	if (parts.length < 4) {
		registerNode(graph, line);
		return;
	}
	// split interleaves captures: [node, arrow, label, node, arrow, label, ...]
	let source = registerNode(graph, parts[0]!);
	for (let index = 1; index + 2 < parts.length + 1 && index < parts.length; index += 3) {
		const arrow = parts[index];
		const label = parts[index + 1];
		const nodeToken = parts[index + 2];
		if (arrow == null || nodeToken == null || nodeToken.trim() === '') {
			break;
		}
		const target = registerNode(graph, nodeToken);
		graph.edges.push({
			source,
			target,
			label: label != null && label !== '' ? label : undefined,
			style: arrow === '-.->' ? 'dotted' : arrow === '==>' ? 'thick' : 'solid',
			hasArrowStart: arrow.startsWith('<'),
			hasArrowEnd: arrow.endsWith('>'),
		});
		source = target;
	}
}

/**
 * Minimal flowchart/graph parser covering what mermaid-autofit's chain
 * detection reads: direction, nodes, edges, subgraphs, and styling directives.
 * Not a general Mermaid parser.
 */
export function parseMermaid(text: string): MermaidGraph {
	const graph: MermaidGraph = {
		direction: 'TD',
		nodes: new Map(),
		edges: [],
		subgraphs: [],
		classDefs: new Map(),
		classAssignments: new Map(),
		nodeStyles: new Map(),
		linkStyles: new Map(),
	};

	let sawHeader = false;
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('%%')) {
			continue;
		}
	const header = line.match(/^(flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/);
		if (header) {
			sawHeader = true;
			graph.direction = header[2]!;
			continue;
		}
		if (/^subgraph\s+/.test(line)) {
			graph.subgraphs.push({ id: `sg${graph.subgraphs.length}`, label: line, nodeIds: [], children: [] });
			continue;
		}
		if (line === 'end' || /^direction\s+/.test(line)) {
			continue;
		}
		const styleMatch = line.match(/^style\s+([\w,-]+)\s+/);
		if (styleMatch) {
			for (const id of styleMatch[1]!.split(',')) {
				graph.nodeStyles.set(id.trim(), {});
			}
			continue;
		}
		if (/^linkStyle\s+/.test(line)) {
			graph.linkStyles.set('default', {});
			continue;
		}
		const classDefMatch = line.match(/^classDef\s+(\w+)\s+/);
		if (classDefMatch) {
			graph.classDefs.set(classDefMatch[1]!, {});
			continue;
		}
		const classMatch = line.match(/^class\s+(\S+)\s+(\w+)/);
		if (classMatch) {
			graph.classAssignments.set(classMatch[1]!, classMatch[2]!);
			continue;
		}
		parseEdgeLine(graph, line);
	}

	if (!sawHeader) {
		throw new Error('Missing diagram header.');
	}
	return graph;
}

const MOCK_NODE_W = 110;
const MOCK_NODE_H = 44;
const MOCK_NODE_GAP = 20;
const MOCK_PAD = 8;

function svgRoot(width: number, height: number, options: RenderOptions, content: string): string {
	return `<svg width="${width}" height="${height}" style="--accent:${options.accent ?? ''};--line:${options.line ?? ''}">`
		+ '<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8"/></marker></defs>'
		+ `${content}<text>mock diagram</text></svg>`;
}

/**
 * Sizing model: flat LR chains are 145px-wide nodes in one row; TD chains one
 * column; subgraph (zigzag fallback) sources keep an aggregate estimate without
 * node boxes. Plain sources emit per-node groups so the composition path can
 * locate node anchors.
 */
function renderMockDiagram(source: string, options: RenderOptions): string {
	let graph: MermaidGraph;
	try {
		graph = parseMermaid(source);
	} catch {
		return svgRoot(200, 60, options, '');
	}

	const nodeCount = Math.max(graph.nodes.size, 1);
	const bands = graph.subgraphs.length;
	if (bands > 0) {
		const width = graph.direction === 'TD' ? 200 * Math.ceil(nodeCount / bands) : 220 * bands;
		const height = graph.direction === 'TD' ? 120 * bands : 100 * Math.ceil(nodeCount / bands);
		return svgRoot(width, height, options, '');
	}

	const nodes = [...graph.nodes.values()];
	if (nodes.length === 0) {
		return svgRoot(200, 60, options, '');
	}
	const horizontal = graph.direction === 'LR' || graph.direction === 'RL';
	const reversed = graph.direction === 'RL' || graph.direction === 'BT';
	const width = horizontal
		? MOCK_PAD * 2 + nodes.length * MOCK_NODE_W + (nodes.length - 1) * MOCK_NODE_GAP
		: MOCK_PAD * 2 + MOCK_NODE_W;
	const height = horizontal
		? MOCK_PAD * 2 + MOCK_NODE_H
		: MOCK_PAD * 2 + nodes.length * MOCK_NODE_H + (nodes.length - 1) * MOCK_NODE_GAP;
	const content = nodes.map((node, index) => {
		const position = reversed ? nodes.length - 1 - index : index;
		const x = horizontal ? MOCK_PAD + position * (MOCK_NODE_W + MOCK_NODE_GAP) : MOCK_PAD;
		const y = horizontal ? MOCK_PAD : MOCK_PAD + position * (MOCK_NODE_H + MOCK_NODE_GAP);
		return `<g class="node" data-id="${node.id}"><rect x="${x}" y="${y}" width="${MOCK_NODE_W}" height="${MOCK_NODE_H}"/><text>${node.label}</text></g>`;
	}).join('\n');
	return svgRoot(width, height, options, content);
}

export const renderMermaidSVG = jest.fn((source: string, options: RenderOptions = {}): string => {
	return renderMockDiagram(source, options);
});
