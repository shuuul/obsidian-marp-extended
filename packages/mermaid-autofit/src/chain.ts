import { parseMermaid, type MermaidGraph } from 'beautiful-mermaid';

export type LinearChainNode = {
	id: string;
	label: string;
	shape: string;
};

export type LinearChain = {
	/** Raw flow direction: LR chains fold into rows, TD chains into columns. */
	direction: 'LR' | 'TD';
	nodes: LinearChainNode[];
};

/** Node shapes that buildZigzagSource can re-emit; anything else bails. */
const REEMITTABLE_SHAPES = new Set([
	'rectangle',
	'rounded',
	'diamond',
	'stadium',
	'circle',
	'subroutine',
	'doublecircle',
	'hexagon',
	'cylinder',
	'asymmetric',
	'trapezoid',
	'trapezoid-alt',
]);

const HEADER_PATTERN = /^\s*(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)\b/m;

/** Foldable flow: LR stays LR; TD and its TB alias both fold into columns. */
function normalizeFoldDirection(raw: string): 'LR' | 'TD' | null {
	if (raw === 'LR') {
		return 'LR';
	}
	if (raw === 'TD' || raw === 'TB') {
		return 'TD';
	}
	return null;
}

/**
 * Detect whether the source is a pure linear `flowchart LR`/`TD` chain: every
 * statement is a simple `-->` edge, the nodes form a single path covering all
 * nodes, and no styling/subgraphs/edge labels are involved. Anything unusual
 * returns null so callers fall back to rendering the source unchanged.
 *
 * The raw header is checked in addition to the parsed direction because
 * beautiful-mermaid keeps RL/BT as distinct directions; re-emitting those
 * with a normalized LR/TD would mirror the author's intended layout. `TB`
 * is the documented alias of `TD` and is accepted as a foldable column chain.
 */
export function detectLinearFlowchartChain(source: string, minChainLength = 5): LinearChain | null {
	const header = source.match(HEADER_PATTERN);
	const direction = header ? normalizeFoldDirection(header[1]) : null;
	if (!direction) {
		return null;
	}

	let graph: MermaidGraph;
	try {
		graph = parseMermaid(source);
	} catch {
		return null;
	}

	if (normalizeFoldDirection(graph.direction) !== direction) {
		return null;
	}
	if (graph.subgraphs.length > 0) {
		return null;
	}
	if (graph.classDefs.size > 0 || graph.classAssignments.size > 0
		|| graph.nodeStyles.size > 0 || graph.linkStyles.size > 0) {
		return null;
	}

	const nodes = [...graph.nodes.values()];
	if (nodes.length < minChainLength) {
		return null;
	}
	if (graph.edges.length !== nodes.length - 1) {
		return null;
	}

	const outTargets = new Map<string, string[]>();
	const inDegree = new Map<string, number>();
	for (const edge of graph.edges) {
		if (edge.label != null || edge.style !== 'solid' || !edge.hasArrowEnd || edge.hasArrowStart) {
			return null;
		}
		if (!graph.nodes.has(edge.source) || !graph.nodes.has(edge.target)) {
			return null;
		}
		outTargets.set(edge.source, [...(outTargets.get(edge.source) ?? []), edge.target]);
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
	}

	const heads = nodes.filter((node) => !inDegree.has(node.id));
	if (heads.length !== 1) {
		return null;
	}

	const ordered: LinearChainNode[] = [];
	const seen = new Set<string>();
	let current: string | undefined = heads[0].id;
	while (current != null) {
		if (seen.has(current)) {
			return null;
		}
		seen.add(current);
		const node = graph.nodes.get(current)!;
		if (!REEMITTABLE_SHAPES.has(node.shape)) {
			return null;
		}
		ordered.push({ id: node.id, label: node.label, shape: node.shape });
		const targets: string[] = outTargets.get(current) ?? [];
		if (targets.length > 1) {
			return null;
		}
		current = targets[0];
	}

	return ordered.length === nodes.length ? { direction, nodes: ordered } : null;
}
