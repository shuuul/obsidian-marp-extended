import type MarpExtended from '../main';
import { MARP_EXTENDED_TEMPLATE_COMMANDS, insertMarpExtendedTemplate } from '../utilities/marpExtendedTemplates';

export function registerMarpCommands(plugin: MarpExtended): void {
	plugin.addCommand({ id: 'next-fragment', name: 'Next preview fragment', callback: () => plugin.getViewInstance(false)?.nextFragment() });
	plugin.addCommand({ id: 'previous-fragment', name: 'Previous preview fragment', callback: () => plugin.getViewInstance(false)?.previousFragment() });
	plugin.addCommand({ id: 'reset-fragments', name: 'Reset preview fragments', callback: () => plugin.getViewInstance(false)?.resetActiveSlideFragments() });
	plugin.addCommand({ id: 'toggle-presenter-notes', name: 'Toggle preview presenter notes', callback: () => plugin.getViewInstance(false)?.togglePresenterNotes() });

	plugin.addCommand({
		id: 'preview',
		name: 'Slide preview',
		callback: () => { void plugin.showPreviewSlide(); },
	});

	plugin.addCommand({
		id: 'export-pdf',
		name: 'Export PDF',
		callback: () => { void plugin.exportFile('pdf'); },
	});

	plugin.addCommand({
		id: 'export-pdf-notes',
		name: 'Export PDF with notes',
		callback: () => { void plugin.exportFile('pdf-with-notes'); },
	});

	plugin.addCommand({
		id: 'export-html',
		name: 'Export HTML',
		callback: () => { void plugin.exportFile('html'); },
	});

	plugin.addCommand({
		id: 'export-pptx',
		name: 'Export PPTX',
		callback: () => { void plugin.exportFile('pptx'); },
	});

	for (const command of MARP_EXTENDED_TEMPLATE_COMMANDS) {
		plugin.addCommand({
			id: command.id,
			name: command.name,
			editorCallback: (editor) => insertMarpExtendedTemplate(editor, command),
		});
	}
}
