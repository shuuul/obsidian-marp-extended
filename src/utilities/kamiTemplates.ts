import type { Editor, EditorPosition } from 'obsidian';

export type MarpExtendedTemplateCommand = {
	id: string;
	name: string;
	template: string;
	selection: string;
};

export type KamiTemplateCommand = MarpExtendedTemplateCommand;

export const MARP_EXTENDED_TEMPLATE_COMMANDS: MarpExtendedTemplateCommand[] = [
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
		template: '%%marp-subtitle%%\nSubtitle text\n%%/marp-subtitle%%\n',
		selection: 'Subtitle text',
	},
	{
		id: 'insert-kami-meta-block',
		name: 'Insert Kami metadata text block',
		template: '%%marp-metadata%%\nMetadata text\n%%/marp-metadata%%\n',
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
		template: '%%marp-callout[variant=mc]%%\nCallout text\n%%/marp-callout%%\n',
		selection: 'mc',
	},
	{
		id: 'insert-kami-cols-block',
		name: 'Insert Kami columns block',
		template: '%%marp-columns%%\n### Left column\n\n- Left content\n\n%%marp-column%%\n\n### Right column\n\n- Right content\n%%/marp-columns%%\n',
		selection: 'Left content',
	},
	{
		id: 'insert-kami-cards-2x2-block',
		name: 'Insert Kami 2x2 cards block',
		template: '%%marp-cards[columns=2]%%\n### A · First metric\nFirst card text.\n\n%%marp-card%%\n\n### B · Second metric\nSecond card text.\n\n%%marp-card%%\n\n### C · Third metric\nThird card text.\n\n%%marp-card%%\n\n### D · Fourth metric\nFourth card text.\n%%/marp-cards%%\n',
		selection: 'First metric',
	},
];

/** Backward-compatible export used by existing command registration and plugins. */
export const KAMI_TEMPLATE_COMMANDS = MARP_EXTENDED_TEMPLATE_COMMANDS;

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

export const insertKamiTemplate = insertMarpExtendedTemplate;
