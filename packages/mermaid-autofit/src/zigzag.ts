import type { LinearChain, LinearChainNode } from './chain';

/** Id prefix for generated wrap rows; SVG post-processing strips this chrome. */
export const WRAP_GROUP_ID_PREFIX = 'mwWrap';

const SHAPE_WRAPPERS: Record<string, (label: string) => string> = {
	rectangle: (label) => `[${label}]`,
	rounded: (label) => `(${label})`,
	stadium: (label) => `([${label}])`,
	subroutine: (label) => `[[${label}]]`,
	cylinder: (label) => `[(${label})]`,
	circle: (label) => `((${label}))`,
	doublecircle: (label) => `(((${label})))`,
	diamond: (label) => `{${label}}`,
	hexagon: (label) => `{{${label}}}`,
	asymmetric: (label) => `>${label}]`,
	trapezoid: (label) => `[/${label}\\]`,
	'trapezoid-alt': (label) => `[\\${label}/]`,
};

function escapeLabel(label: string): string {
	const escaped = label.replace(/"/g, '#quot;').replace(/\r?\n/g, '<br/>');
	return `"${escaped}"`;
}

function emitNode(node: LinearChainNode): string {
	const wrap = SHAPE_WRAPPERS[node.shape];
	if (!wrap) {
		throw new Error(`Cannot re-emit node shape "${node.shape}".`);
	}
	return `${node.id}${wrap(escapeLabel(node.label))}`;
}

/** Re-emit a chain segment as a standalone single-band flowchart source. */
export function buildBandSource(nodes: LinearChainNode[], direction: 'LR' | 'RL' | 'TD' | 'BT'): string {
	return `flowchart ${direction}\n\t${nodes.map(emitNode).join(' --> ')}`;
}

/**
 * Re-emit a linear chain as a zigzag: one hidden subgraph per band, bands
 * alternating direction so the chain snakes, with connector edges between
 * bands. LR chains fold into horizontal rows (outer TD, rows alternating
 * LR/RL); TD chains fold into vertical columns (outer LR, columns alternating
 * TD/BT). The outer direction is always perpendicular so bands stack along
 * the short axis. `style` lines hide the group chrome for official Mermaid;
 * the beautiful-mermaid chrome is stripped from the SVG after rendering.
 */
export function buildZigzagSource(chain: LinearChain, bands: number): string {
	const { nodes } = chain;
	if (bands < 2 || bands >= nodes.length) {
		throw new Error(`Zigzag requires 2 <= bands < node count (got bands=${bands}, nodes=${nodes.length}).`);
	}

	const rowSnake = chain.direction === 'LR';
	const perBand = Math.ceil(nodes.length / bands);
	const lines = [rowSnake ? 'flowchart TD' : 'flowchart LR'];
	const connectors: string[] = [];
	const styleLines: string[] = [];

	let index = 0;
	let bandIndex = 0;
	while (index < nodes.length) {
		const bandNodes = nodes.slice(index, index + perBand);
		const groupId = `${WRAP_GROUP_ID_PREFIX}${bandIndex}`;
		const direction = bandIndex % 2 === 0
			? (rowSnake ? 'LR' : 'TD')
			: (rowSnake ? 'RL' : 'BT');
		lines.push(`\tsubgraph ${groupId}[" "]`);
		lines.push(`\t\tdirection ${direction}`);
		lines.push(`\t\t${bandNodes.map(emitNode).join(' --> ')}`);
		lines.push('\tend');
		styleLines.push(`\tstyle ${groupId} fill:none,stroke:none`);
		if (index > 0) {
			connectors.push(`\t${nodes[index - 1].id} --> ${nodes[index].id}`);
		}
		index += perBand;
		bandIndex += 1;
	}

	return [...lines, ...connectors, ...styleLines].join('\n');
}
