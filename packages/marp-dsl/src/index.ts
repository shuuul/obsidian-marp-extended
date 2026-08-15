import { closingCodeFence, openingCodeFence, type CodeFence } from '@marp-extended/code-fence-scanner';

type MarkerAttributes = {
	positional: string[];
	values: Record<string, string>;
};

type BlockName = 'lead' | 'subtitle' | 'metadata' | 'callout' | 'columns' | 'cards';

const BLOCK_NAMES = new Set<BlockName>(['lead', 'subtitle', 'metadata', 'callout', 'columns', 'cards']);

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseMarkerAttributes(rawInfo: string): MarkerAttributes | undefined {
	const rawAttributes = rawInfo.match(/\[(.*)]/)?.[1].trim() ?? '';
	let quote: '"' | "'" | undefined;
	for (let index = 0; index < rawAttributes.length; index += 1) {
		const character = rawAttributes[index];
		if (character !== '"' && character !== "'") continue;
		if (!quote && (index === 0 || /[\s=]/.test(rawAttributes[index - 1]))) quote = character;
		else if (quote === character) quote = undefined;
	}
	if (quote) return undefined;
	const tokens = rawAttributes.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
	const positional: string[] = [];
	const values: Record<string, string> = {};
	for (const token of tokens) {
		const separatorIndex = token.indexOf('=');
		if (separatorIndex < 0) positional.push(unquoteValue(token));
		else {
			const key = token.slice(0, separatorIndex).trim();
			if (key) values[key] = unquoteValue(token.slice(separatorIndex + 1).trim());
		}
	}
	return { positional, values };
}

function unquoteValue(value: string): string {
	if (value === '""' || value === "''") return value;
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
	return value;
}

function safeToken(value: string, fallback: string): string {
	return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function practicalCount(value: string | undefined, fallback: number): number {
	const count = Number.parseInt(value ?? '', 10);
	return Number.isInteger(count) && count >= 1 && count <= 6 ? count : fallback;
}

function renderSlideMetadata(attributes: MarkerAttributes): string {
	return Object.entries(attributes.values)
		.map(([key, value]) => `<!-- ${key.startsWith('_') ? key : `_${key}`}: ${value} -->`).join('\n');
}

function renderClassBlock(className: string, body: string): string {
	return `<div class="${escapeHtml(className)}">\n\n${body.trim()}\n\n</div>`;
}

function splitSegments(body: string, separatorNames: string[]): string[] {
	const segments: string[] = [];
	let current: string[] = [];
	let fence: CodeFence | undefined;
	for (const line of body.split(/\r?\n/)) {
		if (fence) {
			current.push(line);
			if (closingCodeFence(line, fence)) fence = undefined;
			continue;
		}
		const separator = line.match(/^%%marp-([a-z]+)%%$/)?.[1];
		if (separator && separatorNames.includes(separator)) {
			if (current.join('\n').trim()) segments.push(current.join('\n').trim());
			current = [];
			continue;
		}
		current.push(line);
		fence = openingCodeFence(line) ?? undefined;
	}
	if (current.join('\n').trim()) segments.push(current.join('\n').trim());
	return segments;
}

function renderColumns(body: string): string {
	const columns = splitSegments(body, ['column']);
	const count = practicalCount(String(columns.length), 1);
	const cells = columns.map((column) => `<div class="marp-extended-column">\n\n${compileMarpExtendedCommentBlocks(column)}\n\n</div>`);
	return `<div class="marp-extended-columns marp-extended-columns-${count}">\n\n${cells.join('\n\n')}\n\n</div>`;
}

function renderCards(body: string, attributes: MarkerAttributes): string {
	const count = practicalCount(attributes.values.columns, 2);
	const cells = splitSegments(body, ['card']).map(renderCardCell);
	const rows: string[] = [];
	for (let index = 0; index < cells.length; index += count) rows.push(`<tr>\n${cells.slice(index, index + count).join('\n')}\n</tr>`);
	return `<table class="marp-extended-cards marp-extended-cards-${count}">\n${rows.join('\n')}\n</table>`;
}

function renderCardCell(card: string): string {
	const lines = card.split(/\r?\n/);
	const headingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
	if (headingIndex < 0) return `<td class="marp-extended-card">\n\n${compileMarpExtendedCommentBlocks(card)}\n\n</td>`;
	const heading = lines[headingIndex].trim().replace(/^#{1,6}\s+/, '');
	const body = compileMarpExtendedCommentBlocks([...lines.slice(0, headingIndex), ...lines.slice(headingIndex + 1)].join('\n').trim());
	return `<td class="marp-extended-card">\n\n${renderMetricTitle(heading)}\n\n${body}\n\n</td>`;
}

function renderMetricTitle(heading: string): string {
	const match = heading.match(/^([^·:：\s]+)\s*[·:：]\s*(.+)$/);
	if (!match) return `<div class="marp-extended-card-title">${escapeHtml(heading)}</div>`;
	return `<div class="marp-extended-card-title"><span class="marp-extended-card-label">${escapeHtml(match[1])}</span>${escapeHtml(match[2])}</div>`;
}

function renderBlock(name: BlockName, attributes: MarkerAttributes, body: string): string {
	if (name === 'columns') return renderColumns(body);
	if (name === 'cards') return renderCards(body, attributes);
	const compiledBody = compileMarpExtendedCommentBlocks(body);
	if (name === 'callout') {
		const variant = safeToken(attributes.values.variant ?? 'co', 'co');
		return renderClassBlock(`marp-extended-callout marp-extended-callout-${variant}`, compiledBody);
	}
	const classes: Record<Exclude<BlockName, 'columns' | 'cards' | 'callout'>, string> = {
		lead: 'marp-extended-lead',
		subtitle: 'marp-extended-subtitle',
		metadata: 'marp-extended-metadata',
	};
	return renderClassBlock(classes[name], compiledBody);
}

function blockName(value: string): BlockName | undefined {
	return BLOCK_NAMES.has(value as BlockName) ? value as BlockName : undefined;
}

function supportsAttributes(name: BlockName, attributes: MarkerAttributes): boolean {
	if (attributes.positional.length > 0) return false;
	const keys = Object.keys(attributes.values);
	if (name === 'callout') return keys.every((key) => key === 'variant');
	if (name === 'cards') return keys.every((key) => key === 'columns');
	return keys.length === 0;
}

export function compileMarpExtendedCommentBlocks(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	const output: string[] = [];
	let index = 0;
	let outerFence: CodeFence | undefined;
	while (index < lines.length) {
		const line = lines[index];
		if (outerFence) {
			output.push(line);
			if (closingCodeFence(line, outerFence)) outerFence = undefined;
			index += 1;
			continue;
		}
		outerFence = openingCodeFence(line) ?? undefined;
		if (outerFence) { output.push(line); index += 1; continue; }
		const slideMatch = line.match(/^%%marp-slide(\[[^\]]*\])%%$/);
		if (slideMatch) {
			const attributes = parseMarkerAttributes(slideMatch[1]);
			output.push(attributes ? renderSlideMetadata(attributes) : line);
			index += 1;
			continue;
		}
		const startMatch = line.match(/^%%marp-([a-z]+)(\[[^\]]*\])?%%$/);
		const name = startMatch ? blockName(startMatch[1]) : undefined;
		if (!startMatch || !name) { output.push(line); index += 1; continue; }
		const attributes = parseMarkerAttributes(startMatch[2] ?? '');
		if (!attributes || !supportsAttributes(name, attributes)) { output.push(line); index += 1; continue; }

		const body: string[] = [];
		const stack: BlockName[] = [];
		let cursor = index + 1;
		let fence: CodeFence | undefined;
		let foundEnd = false;
		for (; cursor < lines.length; cursor += 1) {
			const candidate = lines[cursor];
			if (fence) { body.push(candidate); if (closingCodeFence(candidate, fence)) fence = undefined; continue; }
			fence = openingCodeFence(candidate) ?? undefined;
			if (fence) { body.push(candidate); continue; }
			const nestedMatch = candidate.match(/^%%marp-([a-z]+)(?:\[[^\]]*\])?%%$/);
			const nested = nestedMatch ? blockName(nestedMatch[1]) : undefined;
			if (nested) { stack.push(nested); body.push(candidate); continue; }
			const closeMatch = candidate.match(/^%%\/marp-([a-z]+)%%$/);
			const closing = closeMatch ? blockName(closeMatch[1]) : undefined;
			if (closing) {
				if (stack.length && stack[stack.length - 1] === closing) { stack.pop(); body.push(candidate); continue; }
				if (!stack.length && closing === name) { foundEnd = true; break; }
				break;
			}
			body.push(candidate);
		}
		if (!foundEnd) { output.push(line); index += 1; continue; }
		output.push(renderBlock(name, attributes, body.join('\n')));
		index = cursor + 1;
	}
	return output.join('\n');
}
