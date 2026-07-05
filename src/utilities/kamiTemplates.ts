import type { Editor, EditorPosition } from 'obsidian';

export type KamiTemplateCommand = {
	id: string;
	name: string;
	template: string;
	selection: string;
};

export const KAMI_TEMPLATE_COMMANDS: KamiTemplateCommand[] = [
	{
		id: 'insert-kami-slide-metadata',
		name: 'Insert Kami slide metadata',
		template: '%%marp-slide[class=cover paginate=false footer="" header=""]%%\n',
		selection: 'class=cover',
	},
	{
		id: 'insert-kami-lead-block',
		name: 'Insert Kami lead block',
		template: '%%marp-lead%%\nLead text\n%%/marp-lead%%\n',
		selection: 'Lead text',
	},
	{
		id: 'insert-kami-sub-block',
		name: 'Insert Kami subtitle block',
		template: '%%marp-sub%%\nSubtitle text\n%%/marp-sub%%\n',
		selection: 'Subtitle text',
	},
	{
		id: 'insert-kami-meta-block',
		name: 'Insert Kami metadata text block',
		template: '%%marp-meta%%\nMetadata text\n%%/marp-meta%%\n',
		selection: 'Metadata text',
	},
	{
		id: 'insert-kami-co-block',
		name: 'Insert Kami conclusion block',
		template: '%%marp-co%%\nConclusion text\n%%/marp-co%%\n',
		selection: 'Conclusion text',
	},
	{
		id: 'insert-kami-note-block',
		name: 'Insert Kami note block',
		template: '%%marp-note%%\nNote text\n%%/marp-note%%\n',
		selection: 'Note text',
	},
	{
		id: 'insert-kami-mc-block',
		name: 'Insert Kami mini callout block',
		template: '%%marp-mc%%\nMini callout text\n%%/marp-mc%%\n',
		selection: 'Mini callout text',
	},
	{
		id: 'insert-kami-callout-block',
		name: 'Insert Kami custom callout block',
		template: '%%marp-callout[mc]%%\nCallout text\n%%/marp-callout%%\n',
		selection: 'mc',
	},
	{
		id: 'insert-kami-cols-block',
		name: 'Insert Kami columns block',
		template: '%%marp-cols%%\n### Left column\n\n- Left content\n\n%%marp-col%%\n\n### Right column\n\n- Right content\n%%/marp-cols%%\n',
		selection: 'Left content',
	},
	{
		id: 'insert-kami-cards-2x2-block',
		name: 'Insert Kami 2x2 cards block',
		template: '%%marp-cards[2x2]%%\n### A · First metric\nFirst card text.\n\n%%marp-card%%\n\n### B · Second metric\nSecond card text.\n\n%%marp-card%%\n\n### C · Third metric\nThird card text.\n\n%%marp-card%%\n\n### D · Fourth metric\nFourth card text.\n%%/marp-cards%%\n',
		selection: 'First metric',
	},
];

function offsetPosition(start: EditorPosition, text: string): EditorPosition {
	const lines = text.split('\n');
	if (lines.length === 1) {
		return { line: start.line, ch: start.ch + lines[0].length };
	}

	return { line: start.line + lines.length - 1, ch: lines[lines.length - 1].length };
}

export function insertKamiTemplate(editor: Editor, command: KamiTemplateCommand): void {
	const insertionStart = editor.getCursor('from');
	editor.replaceSelection(command.template, 'marp-extended-template');

	const selectionStartOffset = command.template.indexOf(command.selection);
	if (selectionStartOffset === -1) {
		return;
	}

	const selectionStart = offsetPosition(insertionStart, command.template.slice(0, selectionStartOffset));
	const selectionEnd = offsetPosition(selectionStart, command.selection);
	editor.setSelection(selectionStart, selectionEnd);
}
