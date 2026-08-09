import type { Editor, EditorPosition } from 'obsidian';

export type MarpExtendedTemplateCommand = {
	id: string;
	name: string;
	template: string;
	selection: string;
};

export const MARP_EXTENDED_TEMPLATE_COMMANDS: MarpExtendedTemplateCommand[] = [
	{
		id: 'insert-marp-extended-slide',
		name: 'Insert Marp Extended slide metadata',
		template: '%%marp-slide[class=cover paginate=false footer="" header=""]%%\n',
		selection: 'class=cover',
	},
	{
		id: 'insert-marp-extended-lead',
		name: 'Insert Marp Extended lead block',
		template: '%%marp-lead%%\nLead text\n%%/marp-lead%%\n',
		selection: 'Lead text',
	},
	{
		id: 'insert-marp-extended-subtitle',
		name: 'Insert Marp Extended subtitle block',
		template: '%%marp-subtitle%%\nSubtitle text\n%%/marp-subtitle%%\n',
		selection: 'Subtitle text',
	},
	{
		id: 'insert-marp-extended-metadata',
		name: 'Insert Marp Extended metadata block',
		template: '%%marp-metadata%%\nMetadata text\n%%/marp-metadata%%\n',
		selection: 'Metadata text',
	},
	{
		id: 'insert-marp-extended-callout',
		name: 'Insert Marp Extended callout block',
		template: '%%marp-callout[variant=note]%%\nCallout text\n%%/marp-callout%%\n',
		selection: 'note',
	},
	{
		id: 'insert-marp-extended-columns',
		name: 'Insert Marp Extended columns block',
		template: '%%marp-columns%%\n### Left column\n\n- Left content\n\n%%marp-column%%\n\n### Right column\n\n- Right content\n%%/marp-columns%%\n',
		selection: 'Left content',
	},
	{
		id: 'insert-marp-extended-cards',
		name: 'Insert Marp Extended 2x2 cards block',
		template: '%%marp-cards[columns=2]%%\n### A · First metric\nFirst card text.\n\n%%marp-card%%\n\n### B · Second metric\nSecond card text.\n\n%%marp-card%%\n\n### C · Third metric\nThird card text.\n\n%%marp-card%%\n\n### D · Fourth metric\nFourth card text.\n%%/marp-cards%%\n',
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

export function insertMarpExtendedTemplate(editor: Editor, command: MarpExtendedTemplateCommand): void {
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
