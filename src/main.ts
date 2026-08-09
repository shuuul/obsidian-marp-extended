import { MarkdownView, Plugin, addIcon, TFile, type TAbstractFile } from 'obsidian';
import { EditorView, type ViewUpdate } from '@codemirror/view';

import { MARP_PREVIEW_VIEW, MarpPreviewView } from './views/marpPreviewView';
import { ICON_SLIDE_PREVIEW, ICON_EXPORT_PDF, ICON_EXPORT_PPTX, ICON_SLIDE_PRESENT, ICON_FIT_WIDTH } from './utilities/icons';
import { type MarpExtendedSettings, DEFAULT_SETTINGS } from './utilities/settings';
import { ensureDefaultThemes } from './utilities/ensureDefaultThemes';
import { ensureDefaultMermaidThemes } from './utilities/ensureDefaultMermaidThemes';
import { ThemeManager } from './utilities/themeManager';
import { ThemePropertyOptions } from './utilities/themePropertyOptions';
import { getPreviewSlideIndexFromLineReader } from './utilities/previewSync';
import { exportWithNotice } from './utilities/marpExport';
import { createMermaidEditorExtension, refreshMermaidEditorDecorations } from './editor/mermaidEditorExtension';
import { registerMarpCommands } from './commands/registerMarpCommands';
import { MarpExtendedSettingTab } from './settings/marpExtendedSettingTab';


export default class MarpExtended extends Plugin {
	
	public settings: MarpExtendedSettings;
	private slidesView : MarpPreviewView;
	private editorView : MarkdownView | null;
	private themePropertyOptions: ThemePropertyOptions | null = null;
	private codeMirrorEditorViews = new Set<EditorView>();

	async onload() {
		await this.loadSettings();
		const themeManager = new ThemeManager(this.app);
		this.themePropertyOptions = new ThemePropertyOptions(this.app, themeManager);
		this.themePropertyOptions.register();
		this.register(() => this.themePropertyOptions?.unregister());
		void this.refreshThemePropertyOptions().catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error('Marp Extended: theme property options refresh failed', message);
		});

		void ensureDefaultThemes(this)
			.then(async () => {
				await this.refreshThemePropertyOptions();
				this.refreshActivePreview();
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				console.error('Marp Extended: default theme install failed', message);
			});

		void ensureDefaultMermaidThemes(this)
			.then(() => this.refreshThemePropertyOptions())
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				console.error('Marp Extended: default Mermaid theme install failed', message);
			});

		this.registerView(
			MARP_PREVIEW_VIEW,
			(leaf) => new MarpPreviewView(this.settings, leaf, this.manifest.dir)
		);

		addIcon('slides-preview-marp', ICON_SLIDE_PREVIEW);
		addIcon('slides-marp-export-pdf', ICON_EXPORT_PDF);
		addIcon('slides-marp-export-pptx', ICON_EXPORT_PPTX);
		addIcon('slides-marp-slide-present', ICON_SLIDE_PRESENT);
		addIcon('slides-marp-fit-width', ICON_FIT_WIDTH);
		this.addRibbonIcon('slides-preview-marp', 'Show slide preview', async () => {
			await this.showPreviewSlide();
		});
		
		registerMarpCommands(this);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MarpExtendedSettingTab(this.app, this));

		this.registerEditorExtension(EditorView.updateListener.of((update: ViewUpdate) => {
			this.codeMirrorEditorViews.add(update.view);
			this.handleEditorUpdate(update);
		}));
		this.registerEditorExtension(createMermaidEditorExtension(this.app, this.settings));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.view instanceof MarkdownView) {
				this.refreshPreviewForEditor(leaf.view);
			}
		}));

		this.registerEvent(this.app.vault.on('modify', (file) => this.onChange(file)));
		this.registerEvent(this.app.metadataCache.on('changed', (file, data) => {
			this.refreshPreviewForFile(file, data);
		}));
	}

	async loadSettings() {
		const saved = await this.loadData() as Partial<MarpExtendedSettings> | null;
		this.settings = {
			MARP_CLI_PATH: saved?.MARP_CLI_PATH ?? DEFAULT_SETTINGS.MARP_CLI_PATH,
			MARP_CLI_USE_NPX: saved?.MARP_CLI_USE_NPX ?? DEFAULT_SETTINGS.MARP_CLI_USE_NPX,
			CHROME_PATH: saved?.CHROME_PATH ?? DEFAULT_SETTINGS.CHROME_PATH,
			MERMAID_EDITOR_RENDER: saved?.MERMAID_EDITOR_RENDER ?? DEFAULT_SETTINGS.MERMAID_EDITOR_RENDER,
			MERMAID_EDITOR_THEME: saved?.MERMAID_EDITOR_THEME || DEFAULT_SETTINGS.MERMAID_EDITOR_THEME,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async refreshThemePropertyOptions(): Promise<void> {
		await this.themePropertyOptions?.refresh();
	}

	refreshEditorMermaidRendering(): void {
		for (const view of this.codeMirrorEditorViews) {
			try {
				view.dispatch({ effects: refreshMermaidEditorDecorations.of() });
			} catch {
				this.codeMirrorEditorViews.delete(view);
			}
		}
	}

	onChange(file: TAbstractFile) {
		if (file instanceof TFile) {
			this.refreshPreviewForFile(file);
		}
	}

	async exportFile(type: string) {
		const file = this.app.workspace.getActiveFile();
		await exportWithNotice(this.settings, this.app, type, file, this.manifest.dir);
	}

	async showPreviewSlide(){
		this.editorView = this.getActiveMarkdownView();

		if (!this.editorView) {
			return;
		}

		this.slidesView = await this.activateView();
		await this.slidesView.displaySlides(this.editorView);
	}
	
	async activateView() : Promise<MarpPreviewView> {
		this.app.workspace.detachLeavesOfType(MARP_PREVIEW_VIEW);
	
		const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf('split');
		await leaf.setViewState({
			type: MARP_PREVIEW_VIEW,
			active: true,
		});

		void this.app.workspace.revealLeaf(leaf);

		const view = this.getMarpPreviewView(leaf.view);
		if (!view) {
			throw new Error('Marp preview view failed to initialize.');
		}

		return view;
	}

	private handleEditorUpdate(update: ViewUpdate): void {
		if (!update.selectionSet && !update.docChanged && !update.focusChanged) {
			return;
		}

		if (!update.view.hasFocus) {
			return;
		}

		const activeView = this.getActiveMarkdownView();
		const file = activeView?.file;
		if (!file) {
			return;
		}

		const previewView = this.getPreviewViewForEditorFile(file);
		if (!previewView?.isSyncPreviewEnabled()) {
			return;
		}

		const doc = update.state.doc;
		const cursorLine = doc.lineAt(update.state.selection.main.head).number - 1;
		void previewView.onLineChanged(getPreviewSlideIndexFromLineReader(
			doc.lines,
			cursorLine,
			(lineNumber) => doc.line(lineNumber + 1).text,
		));
	}

	private getPreviewViewForEditorFile(file: TFile): MarpPreviewView | null {
		const activeView = this.getActiveMarkdownView();
		if (activeView?.file === file) {
			return this.syncPreviewContext(activeView);
		}

		const previewView = this.getViewInstance(false);
		return previewView?.isDisplayingFile(file) ? previewView : null;
	}

	getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	refreshPreviewForEditor(view: MarkdownView): MarpPreviewView | null {
		this.editorView = view;
		const previewView = this.getViewInstance(false);
		if (previewView) {
			void previewView.displaySlides(view);
		}
		return previewView;
	}

	refreshActivePreview(): MarpPreviewView | null {
		const activeView = this.getActiveMarkdownView();
		return activeView ? this.refreshPreviewForEditor(activeView) : null;
	}

	private refreshPreviewForFile(file: TFile, markdownOverride?: string): MarpPreviewView | null {
		const activeView = this.getActiveMarkdownView();
		const previewView = this.getViewInstance(false);
		if (!previewView) {
			return null;
		}

		if (activeView?.file?.path === file.path) {
			this.editorView = activeView;
			void previewView.displaySlides(activeView, markdownOverride);
			return previewView;
		}

		if (this.editorView?.file?.path === file.path) {
			void previewView.displaySlides(this.editorView, markdownOverride);
			return previewView;
		}

		return null;
	}

	syncPreviewContext(view: MarkdownView): MarpPreviewView | null {
		const shouldRefresh = this.editorView?.file !== view.file;
		this.editorView = view;
		const previewView = this.getViewInstance(false);
		if (previewView && shouldRefresh) {
			void previewView.displaySlides(view);
		}
		return previewView;
	}

	getViewInstance(reveal = true): MarpPreviewView | null {
		for (const leaf of this.app.workspace.getLeavesOfType(MARP_PREVIEW_VIEW)) {
			const view = this.getMarpPreviewView(leaf.view);
			if (!view) {
				continue;
			}

			if (reveal) {
				void this.app.workspace.revealLeaf(leaf);
			}
			return view;
		}

		return null;
	}

	private getMarpPreviewView(view: unknown): MarpPreviewView | null {
		return view instanceof MarpPreviewView ? view : null;
	}
}
