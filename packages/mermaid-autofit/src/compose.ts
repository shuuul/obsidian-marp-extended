import { renderMermaidSVG, type RenderOptions } from 'beautiful-mermaid';
import type { LinearChain } from './chain';
import { buildBandSource } from './zigzag';

/** Default gap between composed bands (px). Tight by design: folded diagrams exist to save space. */
export const DEFAULT_BAND_GAP = 24;

/** Small per-band padding; band separation is owned by the composition, not the renderer. */
const BAND_PADDING = 8;

/** Outer padding of the composed diagram. */
const COMPOSE_PADDING = 8;

/** Default lane gap inside the grid (px). Tighter than the renderer's node spacing: narrower diagram, larger fonts. */
const COMPACT_LANE_GAP = 24;

/** Opacity of self-drawn edges and their arrowheads: present, but visually behind the nodes. */
const EDGE_OPACITY = 0.6;

/**
 * Custom arrowhead: 6x3.5 at stroke-width 1 (the library's stock head is
 * 8x5), so folded-diagram arrows read as connectors, not decorations.
 * Distinct id to avoid clashing with the band render's own #arrowhead defs.
 */
const ARROW_MARKER_DEFS = '<defs><marker id="mwArrowhead" markerWidth="6" markerHeight="3.5" refX="5" refY="1.75" orient="auto">'
	+ `<polygon points="0 0, 6 1.75, 0 3.5" fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="0.75"`
	+ ` stroke-linejoin="round" fill-opacity="${EDGE_OPACITY}" stroke-opacity="${EDGE_OPACITY}"/>`
	+ '</marker></defs>';

/**
 * Must match beautiful-mermaid's STROKE_WIDTHS.connector: arrowhead markers
 * use markerUnits="strokeWidth", so a mismatched connector stroke scales the
 * arrowhead up/down relative to band-internal edges.
 */
const CONNECTOR_STROKE_WIDTH = 1;

type BandParts = {
	width: number;
	height: number;
	styleAttr: string;
	styleBlock: string;
	defs: string;
	content: string;
};

type NodeBox = { x: number; y: number; w: number; h: number };

type ExtractedNode = { id: string; markup: string; box: NodeBox };

function parseFloatAttr(source: string, attr: string): number | null {
	const match = source.match(new RegExp(`${attr}\\s*=\\s*"(-?[0-9]+(?:\\.[0-9]+)?)"`));
	return match ? Number(match[1]) : null;
}

/** Split a rendered band SVG into reusable parts; null when the structure is unrecognized. */
export function extractBandParts(svg: string): BandParts | null {
	const openTag = svg.match(/<svg\b[^>]*>/i)?.[0];
	if (!openTag) {
		return null;
	}
	const width = parseFloatAttr(openTag, 'width');
	const height = parseFloatAttr(openTag, 'height');
	if (width == null || height == null) {
		return null;
	}
	const styleAttr = openTag.match(/\bstyle\s*=\s*"([^"]*)"/i)?.[1] ?? '';
	const styleBlock = svg.match(/<style>[\s\S]*?<\/style>/i)?.[0] ?? '';
	const defs = svg.match(/<defs>[\s\S]*?<\/defs>/i)?.[0] ?? '';
	const content = svg
		.replace(openTag, '')
		.replace(/<\/svg>\s*$/i, '')
		.replace(styleBlock, '')
		.replace(defs, '');
	return { width, height, styleAttr, styleBlock, defs, content };
}

/** Locate a node's bounding box inside a band SVG (rect, circle/ellipse, or polygon). */
export function findNodeBox(svg: string, id: string): NodeBox | null {
	const group = svg.match(new RegExp(`<g class="node" data-id="${id}"[\\s\\S]*?</g>`))?.[0];
	if (!group) {
		return null;
	}
	const rect = group.match(/<rect\b[^>]*\bx="(-?[\d.]+)"[^>]*\by="(-?[\d.]+)"[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/);
	if (rect) {
		return { x: Number(rect[1]), y: Number(rect[2]), w: Number(rect[3]), h: Number(rect[4]) };
	}
	const ellipse = group.match(/<(?:ellipse|circle)\b[^>]*>/);
	if (ellipse) {
		const cx = parseFloatAttr(ellipse[0], 'cx');
		const cy = parseFloatAttr(ellipse[0], 'cy');
		const rx = parseFloatAttr(ellipse[0], 'rx') ?? parseFloatAttr(ellipse[0], 'r');
		const ry = parseFloatAttr(ellipse[0], 'ry') ?? parseFloatAttr(ellipse[0], 'r');
		if (cx != null && cy != null && rx != null && ry != null) {
			return { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 };
		}
	}
	const polygon = group.match(/<(?:polygon|path)\b[^>]*\b(?:points|d)="([^"]+)"/);
	if (polygon) {
		const coords = polygon[1].match(/-?[\d.]+/g)?.map(Number) ?? [];
		const xs = coords.filter((_, index) => index % 2 === 0);
		const ys = coords.filter((_, index) => index % 2 === 1);
		if (xs.length > 0 && ys.length > 0) {
			const minX = Math.min(...xs);
			const minY = Math.min(...ys);
			return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
		}
	}
	return null;
}

/** Extract a node's rendered markup (shape + label group) verbatim. */
function extractNodeMarkup(svg: string, id: string): string | null {
	return svg.match(new RegExp(`<g class="node" data-id="${id}"[\\s\\S]*?</g>`))?.[0] ?? null;
}

function edgeElement(path: string, connector: boolean): string {
	const marker = connector ? ' data-autofit-connector="1"' : '';
	return `<path class="edge"${marker} d="${path}" fill="none" stroke="var(--_line)" stroke-width="${CONNECTOR_STROKE_WIDTH}" stroke-opacity="${EDGE_OPACITY}" marker-end="url(#mwArrowhead)"/>`;
}

/** Straight edge, or an orthogonal elbow through the midpoint when endpoints drift off-axis. */
function joinPoints(
	sx: number, sy: number, ex: number, ey: number, orientation: 'vertical' | 'horizontal', connector: boolean,
): string {
	if (orientation === 'vertical') {
		if (Math.abs(sx - ex) < 0.5) {
			return edgeElement(`M ${sx} ${sy} L ${ex} ${ey}`, connector);
		}
		const mid = (sy + ey) / 2;
		return edgeElement(`M ${sx} ${sy} L ${sx} ${mid} L ${ex} ${mid} L ${ex} ${ey}`, connector);
	}
	if (Math.abs(sy - ey) < 0.5) {
		return edgeElement(`M ${sx} ${sy} L ${ex} ${ey}`, connector);
	}
	const mid = (sx + ex) / 2;
	return edgeElement(`M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ey} L ${ex} ${ey}`, connector);
}

type Composed = { width: number; height: number; body: string };

/**
 * Lay bands out on a shared grid: every column (row snake) or row (column
 * snake) is as wide/tall as its largest node, so nodes line up across bands
 * and band-to-band connectors drop straight down/across.
 */
function placeOnGrid(
	extracted: ExtractedNode[][],
	rowSnake: boolean,
	colGap: number,
	bandGap: number,
): Composed {
	const bandCount = extracted.length;
	const laneCount = Math.max(...extracted.map((band) => band.length));
	const pad = COMPOSE_PADDING;

	// Lane = visual column (row snake) or visual row (column snake). Odd bands
	// are reversed and right-aligned, so their first node sits on the last lane.
	const laneOf = (bandIndex: number, nodeIndex: number): number => (bandIndex % 2 === 0
		? nodeIndex
		: laneCount - 1 - nodeIndex);

	const laneSize: number[] = Array.from({ length: laneCount }, () => 0);
	const bandSize: number[] = Array.from({ length: bandCount }, () => 0);
	for (const [bandIndex, band] of extracted.entries()) {
		for (const [nodeIndex, node] of band.entries()) {
			const main = rowSnake ? node.box.w : node.box.h;
			const cross = rowSnake ? node.box.h : node.box.w;
			laneSize[laneOf(bandIndex, nodeIndex)] = Math.max(laneSize[laneOf(bandIndex, nodeIndex)], main);
			bandSize[bandIndex] = Math.max(bandSize[bandIndex], cross);
		}
	}

	const laneStart: number[] = [];
	const bandStart: number[] = [];
	let laneCursor = pad;
	for (const size of laneSize) {
		laneStart.push(laneCursor);
		laneCursor += size + colGap;
	}
	let bandCursor = pad;
	for (const size of bandSize) {
		bandStart.push(bandCursor);
		bandCursor += size + bandGap;
	}

	const placed: { box: NodeBox; markup: string }[][] = extracted.map((band, bandIndex) => band.map((node, nodeIndex) => {
		const lane = laneOf(bandIndex, nodeIndex);
		const main = rowSnake ? node.box.w : node.box.h;
		const cross = rowSnake ? node.box.h : node.box.w;
		const mainStart = laneStart[lane] + (laneSize[lane] - main) / 2;
		const crossStart = bandStart[bandIndex] + (bandSize[bandIndex] - cross) / 2;
		const box = rowSnake
			? { x: mainStart, y: crossStart, w: node.box.w, h: node.box.h }
			: { x: crossStart, y: mainStart, w: node.box.w, h: node.box.h };
		return { box, markup: node.markup };
	}));

	const width = rowSnake
		? laneCursor - colGap + pad
		: bandCursor - bandGap + pad;
	const height = rowSnake
		? bandCursor - bandGap + pad
		: laneCursor - colGap + pad;

	const parts: string[] = [];
	for (const [bandIndex, band] of placed.entries()) {
		for (const [nodeIndex, node] of band.entries()) {
			const source = extracted[bandIndex][nodeIndex];
			parts.push(`<g transform="translate(${node.box.x - source.box.x},${node.box.y - source.box.y})">${node.markup}</g>`);
		}
		// Intra-band edges between consecutive nodes.
		for (let nodeIndex = 0; nodeIndex + 1 < band.length; nodeIndex += 1) {
			const source = band[nodeIndex].box;
			const target = band[nodeIndex + 1].box;
			if (rowSnake) {
				const forward = bandIndex % 2 === 0;
				const sx = forward ? source.x + source.w : source.x;
				const ex = forward ? target.x : target.x + target.w;
				const sy = source.y + source.h / 2;
				const ey = target.y + target.h / 2;
				parts.push(joinPoints(sx, sy, ex, ey, 'horizontal', false));
			} else {
				const forward = bandIndex % 2 === 0;
				const sy = forward ? source.y + source.h : source.y;
				const ey = forward ? target.y : target.y + target.h;
				const sx = source.x + source.w / 2;
				const ex = target.x + target.w / 2;
				parts.push(joinPoints(sx, sy, ex, ey, 'vertical', false));
			}
		}
		// Connector to the next band.
		if (bandIndex + 1 < placed.length) {
			const source = band[band.length - 1].box;
			const target = placed[bandIndex + 1][0].box;
			if (rowSnake) {
				parts.push(joinPoints(
					source.x + source.w / 2, source.y + source.h,
					target.x + target.w / 2, target.y,
					'vertical', true,
				));
			} else {
				parts.push(joinPoints(
					source.x + source.w, source.y + source.h / 2,
					target.x, target.y + target.h / 2,
					'horizontal', true,
				));
			}
		}
	}

	return { width, height, body: parts.join('\n') };
}

/**
 * Render a linear chain as independently rendered bands re-laid onto a shared
 * grid in a single compact SVG: LR chains become horizontal rows, TD chains
 * vertical columns, both snaked so band flow alternates direction. Nodes are
 * extracted from the band renders verbatim (shapes and labels untouched);
 * all edges are redrawn as straight orthogonal arrows on the grid. Returns
 * null when band extraction fails so callers can fall back.
 */
export function renderComposedZigzag(
	chain: LinearChain,
	bands: number,
	renderOptions: RenderOptions = {},
	bandGap: number = DEFAULT_BAND_GAP,
): string | null {
	const { nodes } = chain;
	if (bands < 2 || bands >= nodes.length) {
		return null;
	}
	const rowSnake = chain.direction === 'LR';
	const perBand = Math.ceil(nodes.length / bands);

	const extracted: ExtractedNode[][] = [];
	let firstParts: BandParts | null = null;
	for (let bandIndex = 0; bandIndex * perBand < nodes.length; bandIndex += 1) {
		const slice = nodes.slice(bandIndex * perBand, (bandIndex + 1) * perBand);
		const direction = rowSnake
			? (bandIndex % 2 === 0 ? 'LR' : 'RL')
			: (bandIndex % 2 === 0 ? 'TD' : 'BT');
		const svg = renderMermaidSVG(buildBandSource(slice, direction), { ...renderOptions, padding: BAND_PADDING });
		const parts = extractBandParts(svg);
		if (!parts) {
			return null;
		}
		firstParts ??= parts;
		const band: ExtractedNode[] = [];
		for (const node of slice) {
			const markup = extractNodeMarkup(svg, node.id);
			const box = findNodeBox(svg, node.id);
			if (!markup || !box) {
				return null;
			}
			band.push({ id: node.id, markup, box });
		}
		extracted.push(band);
	}
	if (extracted.length < 2 || !firstParts) {
		return null;
	}

	const colGap = Number(renderOptions.nodeSpacing) > 0 ? Number(renderOptions.nodeSpacing) : COMPACT_LANE_GAP;
	const { width, height, body } = placeOnGrid(extracted, rowSnake, colGap, bandGap);

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="${firstParts.styleAttr}">`,
		firstParts.styleBlock,
		firstParts.defs,
		ARROW_MARKER_DEFS,
		body,
		'</svg>',
	].join('\n');
}
