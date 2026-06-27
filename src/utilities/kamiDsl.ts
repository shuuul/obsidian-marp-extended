type FenceAttributes = {
	positional: string[];
	values: Record<string, string>;
};

type KamiBlockName = 'slide' | 'lead' | 'sub' | 'meta' | 'co' | 'mc' | 'note' | 'callout' | 'cols' | 'cards';

const KAMI_BLOCK_CLASS_BY_NAME: Partial<Record<KamiBlockName, string>> = {
	lead: 'lead',
	sub: 'sub',
	meta: 'meta',
	co: 'co',
	mc: 'mc',
	note: 'co',
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function parseFenceAttributes(rawInfo: string): FenceAttributes {
	const bracketMatch = rawInfo.match(/\[(.*)]/);
	const rawAttributes = bracketMatch?.[1].trim() ?? '';
	if (!rawAttributes) {
		return { positional: [], values: {} };
	}

	const tokens = rawAttributes.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
	const positional: string[] = [];
	const values: Record<string, string> = {};

	for (const token of tokens) {
		const separatorIndex = token.indexOf('=');
		if (separatorIndex === -1) {
			positional.push(unquoteValue(token));
			continue;
		}

		const key = token.slice(0, separatorIndex).trim();
		const value = token.slice(separatorIndex + 1).trim();
		if (key) {
			values[key] = unquoteValue(value);
		}
	}

	return { positional, values };
}

function unquoteValue(value: string): string {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	return value;
}

function parseMetadataLines(body: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of body.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const separatorIndex = trimmed.indexOf(':');
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		const value = trimmed.slice(separatorIndex + 1).trim();
		if (key) {
			values[key] = value;
		}
	}

	return values;
}

function renderSlideMetadata(rawInfo: string, body: string): string {
	const attributes = parseFenceAttributes(rawInfo);
	const metadata = {
		...attributes.values,
		...parseMetadataLines(body),
	};

	return Object.entries(metadata)
		.map(([key, value]) => `<!-- ${key.startsWith('_') ? key : `_${key}`}: ${value} -->`)
		.join('\n');
}

function renderClassBlock(className: string, body: string): string {
	return `<div class="${escapeHtml(className)}">\n\n${body.trim()}\n\n</div>`;
}

function splitKamiSegments(body: string): string[] {
	const segments: string[] = [];
	const currentSegment: string[] = [];
	let nestedFence = false;

	for (const line of body.split(/\r?\n/)) {
		if (nestedFence) {
			currentSegment.push(line);
			if (/^```[ \t]*$/.test(line)) {
				nestedFence = false;
			}
			continue;
		}

		if (/^===[ \t]*$/.test(line)) {
			const segment = currentSegment.join('\n').trim();
			if (segment) {
				segments.push(segment);
			}
			currentSegment.length = 0;
			continue;
		}

		currentSegment.push(line);
		if (/^```/.test(line)) {
			nestedFence = true;
		}
	}

	const finalSegment = currentSegment.join('\n').trim();
	if (finalSegment) {
		segments.push(finalSegment);
	}

	return segments;
}

function renderColumns(body: string): string {
	const columns = splitKamiSegments(body);
	return `<div class="c2">\n\n${columns.map((column) => `<div>\n\n${compileKamiFencedBlocks(column)}\n\n</div>`).join('\n\n')}\n\n</div>`;
}

function renderCards(body: string): string {
	const cards = splitKamiSegments(body);
	const cells = cards.map(renderCardCell);
	const rows: string[] = [];

	for (let index = 0; index < cells.length; index += 2) {
		rows.push(`<tr>\n${cells.slice(index, index + 2).join('\n')}\n</tr>`);
	}

	return `<table class="t2x2">\n${rows.join('\n')}\n</table>`;
}

function renderCardCell(card: string): string {
	const lines = card.split(/\r?\n/);
	const headingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
	if (headingIndex === -1) {
		return `<td>\n\n${compileKamiFencedBlocks(card)}\n\n</td>`;
	}

	const heading = lines[headingIndex].trim().replace(/^#{1,6}\s+/, '');
	const body = compileKamiFencedBlocks([
		...lines.slice(0, headingIndex),
		...lines.slice(headingIndex + 1),
	].join('\n').trim());
	const title = renderMetricTitle(heading);

	return `<td>\n\n${title}\n\n${body}\n\n</td>`;
}

function renderMetricTitle(heading: string): string {
	const match = heading.match(/^([^·:：\s]+)\s*[·:：]\s*(.+)$/);
	if (!match) {
		return `<div class="mt">${escapeHtml(heading)}</div>`;
	}

	return `<div class="mt"><span class="ml">${escapeHtml(match[1])}</span>${escapeHtml(match[2])}</div>`;
}

function renderKamiFence(name: KamiBlockName, rawInfo: string, body: string): string {
	if (name === 'slide') {
		return renderSlideMetadata(rawInfo, body);
	}

	if (name === 'cols') {
		return renderColumns(body);
	}

	if (name === 'cards') {
		return renderCards(body);
	}

	if (name === 'callout') {
		const attributes = parseFenceAttributes(rawInfo);
		return renderClassBlock(attributes.positional[0] || attributes.values.type || 'co', body);
	}

	return renderClassBlock(KAMI_BLOCK_CLASS_BY_NAME[name] ?? name, body);
}

export function compileKamiFencedBlocks(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	const output: string[] = [];
	let index = 0;

	while (index < lines.length) {
		const startMatch = lines[index].match(/^```(slide|lead|sub|meta|cols|cards|callout|note|co|mc)(?=\[|\s|$)(.*)$/);
		if (!startMatch) {
			output.push(lines[index]);
			index += 1;
			continue;
		}

		const body: string[] = [];
		let cursor = index + 1;
		let nestedFence = false;
		let foundEnd = false;

		while (cursor < lines.length) {
			const line = lines[cursor];
			if (nestedFence) {
				body.push(line);
				if (/^```[ \t]*$/.test(line)) {
					nestedFence = false;
				}
				cursor += 1;
				continue;
			}

			if (/^```[ \t]*$/.test(line)) {
				foundEnd = true;
				break;
			}

			body.push(line);
			if (/^```/.test(line)) {
				nestedFence = true;
			}
			cursor += 1;
		}

		if (!foundEnd) {
			output.push(lines[index]);
			index += 1;
			continue;
		}

		output.push(renderKamiFence(startMatch[1] as KamiBlockName, startMatch[2], body.join('\n')));
		index = cursor + 1;
	}

	return output.join('\n');
}
