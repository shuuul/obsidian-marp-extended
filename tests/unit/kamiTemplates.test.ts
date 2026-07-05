import { beforeEach, expect, jest, test } from '@jest/globals';
import type { Editor } from 'obsidian';

import {
	insertKamiTemplate,
	KAMI_TEMPLATE_COMMANDS,
	type KamiTemplateCommand,
} from '@/utilities/kamiTemplates';

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

function getLeadTemplateCommand(): KamiTemplateCommand {
	const command = KAMI_TEMPLATE_COMMANDS.find((entry) => entry.id === 'insert-kami-lead-block');
	if (!command) {
		throw new Error('insert-kami-lead-block command is missing from KAMI_TEMPLATE_COMMANDS');
	}
	return command;
}

beforeEach(() => {
	jest.clearAllMocks();
});

test('insertKamiTemplate replaces selection with the lead template and origin', () => {
	const editor = createFakeEditor({ line: 0, ch: 0 });
	const command = getLeadTemplateCommand();

	insertKamiTemplate(editor, command);

	expect(editor.replaceSelection).toHaveBeenCalledTimes(1);
	expect(editor.replaceSelection).toHaveBeenCalledWith(
		'%%marp-lead%%\nLead text\n%%/marp-lead%%\n',
		'marp-extended-template',
	);
});

test('insertKamiTemplate selects Lead text from the pre-insert cursor', () => {
	const editor = createFakeEditor({ line: 4, ch: 2 });
	const command = getLeadTemplateCommand();

	insertKamiTemplate(editor, command);

	expect(editor.setSelection).toHaveBeenCalledTimes(1);
	expect(editor.setSelection).toHaveBeenCalledWith(
		{ line: 5, ch: 0 },
		{ line: 5, ch: 9 },
	);
});

test('insertKamiTemplate does not branch on selection state beyond replaceSelection', () => {
	const editor = createFakeEditor({ line: 2, ch: 0 });
	const command = getLeadTemplateCommand();

	insertKamiTemplate(editor, command);

	expect(editor.getCursor).toHaveBeenCalledWith('from');
	expect(editor.replaceSelection).toHaveBeenCalledWith(command.template, 'marp-extended-template');
	expect(editor.setSelection).toHaveBeenCalled();
});