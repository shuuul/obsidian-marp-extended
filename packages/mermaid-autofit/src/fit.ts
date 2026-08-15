import { renderMermaidSVG, type RenderOptions } from 'beautiful-mermaid';
import { detectLinearFlowchartChain } from './chain';
import { DEFAULT_BAND_GAP, renderComposedZigzag } from './compose';
import { readSvgAspectRatio, stripWrapGroupChrome } from './svg';
import { buildZigzagSource } from './zigzag';

export type MermaidAutoFitOptions = {
	/** Master switch; when false the source renders unchanged. Default true. */
	enabled?: boolean;
	/**
	 * Widest acceptable width/height ratio before an LR chain is folded into
	 * multiple rows. Marp scales slides as a whole, so the aspect ratio is the
	 * scale-invariant proxy for "remaining space". Default 2.2.
	 */
	targetAspectRatio?: number;
	/**
	 * Narrowest acceptable width/height ratio before a TD chain is folded into
	 * multiple columns. Portrait diagrams height-bind against the slide's
	 * max-height, which shrinks text just like an over-wide diagram. Default 0.8.
	 */
	minAspectRatio?: number;
	/** Chains shorter than this render unchanged. Default 5. */
	minChainLength?: number;
	/**
	 * Maximum zigzag bands (rows or columns) to try. More bands mean a
	 * narrower diagram and therefore larger fonts after slide scaling; the
	 * aspect band keeps short chains from over-folding. Default 4.
	 */
	maxBands?: number;
	/** Gap between composed bands in px. Default 24. */
	bandGap?: number;
};

export const DEFAULT_MERMAID_AUTOFIT_OPTIONS: Required<MermaidAutoFitOptions> = {
	enabled: true,
	targetAspectRatio: 2.2,
	minAspectRatio: 0.8,
	minChainLength: 5,
	maxBands: 4,
	bandGap: DEFAULT_BAND_GAP,
};

/**
 * Render a Mermaid diagram, re-laying pure linear flowchart chains as
 * multi-band zigzag diagrams when the straight render falls outside the
 * acceptable aspect-ratio band: over-wide LR chains fold into rows, over-tall
 * TD chains fold into columns. Bands are rendered independently and composed
 * with a tight gap (no hidden subgraph padding); if composition fails, a
 * subgraph-based zigzag with stripped group chrome is used instead. All other
 * diagrams render unchanged. Any failure in the auto-fit path falls back to
 * the plain render of the original source.
 */
export function renderMermaidAutoFitSVG(
	source: string,
	renderOptions: RenderOptions = {},
	autoFit: MermaidAutoFitOptions = {},
): string {
	const options = { ...DEFAULT_MERMAID_AUTOFIT_OPTIONS, ...autoFit };
	if (!options.enabled) {
		return renderMermaidSVG(source, renderOptions);
	}

	const chain = detectLinearFlowchartChain(source, options.minChainLength);
	if (!chain) {
		return renderMermaidSVG(source, renderOptions);
	}

	const originalSvg = renderMermaidSVG(source, renderOptions);
	const originalAspect = readSvgAspectRatio(originalSvg);
	if (originalAspect == null) {
		return originalSvg;
	}

	const tooWide = originalAspect > options.targetAspectRatio;
	const tooTall = originalAspect < options.minAspectRatio;
	// Folding only helps when the chain's flow direction matches the problem:
	// rows narrow an LR chain, columns widen a TD chain.
	if ((tooWide && chain.direction !== 'LR') || (tooTall && chain.direction !== 'TD') || (!tooWide && !tooTall)) {
		return originalSvg;
	}

	const fits = (aspect: number | null): boolean => aspect != null
		&& aspect <= options.targetAspectRatio
		&& aspect >= options.minAspectRatio;

	// Distance outside the acceptable band, as a ratio (1 = inside). Used to
	// pick the least-bad candidate when no band count fits, which happens with
	// tight gaps where even the best fold slightly overshoots the target.
	const distance = (aspect: number): number => {
		if (aspect > options.targetAspectRatio) {
			return aspect / options.targetAspectRatio;
		}
		if (aspect < options.minAspectRatio) {
			return options.minAspectRatio / aspect;
		}
		return 1;
	};

	let bestSvg = originalSvg;
	let bestDistance = Number.POSITIVE_INFINITY;
	const bandLimit = Math.min(options.maxBands, chain.nodes.length - 1);
	for (let bands = 2; bands <= bandLimit; bands += 1) {
		try {
			const candidate = renderComposedZigzag(chain, bands, renderOptions, options.bandGap)
				?? stripWrapGroupChrome(renderMermaidSVG(buildZigzagSource(chain, bands), renderOptions));
			const aspect = readSvgAspectRatio(candidate);
			if (fits(aspect)) {
				return candidate;
			}
			if (aspect != null && distance(aspect) < bestDistance) {
				bestDistance = distance(aspect);
				bestSvg = candidate;
			}
		} catch {
			break;
		}
	}

	return bestSvg;
}
