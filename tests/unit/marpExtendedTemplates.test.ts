import { beforeEach, expect, jest, test } from '@jest/globals';
import type { Editor } from 'obsidian';

import {
	insertMarpExtendedTemplate,
	MARP_EXTENDED_TEMPLATE_COMMANDS,
	type MarpExtendedTemplateCommand,
} from '@/utilities/marpExtendedTemplates';

type EditorPosition = { line: number; ch: number };

function createFakeEditor(initialCursor: EditorPosition): Editor {
	const getCursor = jest.fn((which?: 'from' | 'to' | 'head' | 'anchor') => {
		if (which === 'from' || which === 'to') {
			return { ...initialCursor };
		}
		return { ...initialCursor };
	});
	const replaceSelection = jest.fn();
	const setSelection = jest.fn();

	return {
		getCursor,
		replaceSelection,
		setSelection,
	} as unknown as Editor;
}

function getLeadTemplateCommand(): MarpExtendedTemplateCommand {
	const command = MARP_EXTENDED_TEMPLATE_COMMANDS.find((entry) => entry.id === 'insert-marp-extended-lead');
	if (!command) {
		throw new Error('insert-marp-extended-lead command is missing from MARP_EXTENDED_TEMPLATE_COMMANDS');
	}
	return command;
}

beforeEach(() => {
	jest.clearAllMocks();
});

test('insertMarpExtendedTemplate replaces selection with the lead template and origin', () => {
	const editor = createFakeEditor({ line: 0, ch: 0 });
	const command = getLeadTemplateCommand();

	insertMarpExtendedTemplate(editor, command);

	expect(editor.replaceSelection).toHaveBeenCalledTimes(1);
	expect(editor.replaceSelection).toHaveBeenCalledWith(
		'%%marp-lead%%\nLead text\n%%/marp-lead%%\n',
		'marp-extended-template',
	);
});

test('insertMarpExtendedTemplate selects lead text from the pre-insert cursor', () => {
	const editor = createFakeEditor({ line: 4, ch: 2 });
	const command = getLeadTemplateCommand();

	insertMarpExtendedTemplate(editor, command);

	expect(editor.setSelection).toHaveBeenCalledTimes(1);
	expect(editor.setSelection).toHaveBeenCalledWith(
		{ line: 5, ch: 0 },
		{ line: 5, ch: 9 },
	);
});

test('insertMarpExtendedTemplate delegates selection replacement to the editor', () => {
	const editor = createFakeEditor({ line: 2, ch: 0 });
	const command = getLeadTemplateCommand();

	insertMarpExtendedTemplate(editor, command);

	expect(editor.getCursor).toHaveBeenCalledWith('from');
	expect(editor.replaceSelection).toHaveBeenCalledWith(command.template, 'marp-extended-template');
	expect(editor.setSelection).toHaveBeenCalled();
});

test('template commands use only canonical IDs and marker forms', () => {
	const commands = new Map(MARP_EXTENDED_TEMPLATE_COMMANDS.map((entry) => [entry.id, entry]));

	expect([...commands.keys()]).toEqual([
		'insert-marp-extended-slide',
		'insert-marp-extended-lead',
		'insert-marp-extended-subtitle',
		'insert-marp-extended-metadata',
		'insert-marp-extended-callout',
		'insert-marp-extended-columns',
		'insert-marp-extended-cards',
	]);
	expect(commands.get('insert-marp-extended-subtitle')?.template).toContain('%%marp-subtitle%%');
	expect(commands.get('insert-marp-extended-metadata')?.template).toContain('%%marp-metadata%%');
	expect(commands.get('insert-marp-extended-callout')?.template).toContain('[variant=note]');
	expect(commands.get('insert-marp-extended-columns')?.template).toContain('%%marp-column%%');
	expect(commands.get('insert-marp-extended-cards')?.template).toContain('[columns=2]');
	expect(MARP_EXTENDED_TEMPLATE_COMMANDS).not.toContainEqual(expect.objectContaining({ id: expect.stringContaining('kami') }));
});
