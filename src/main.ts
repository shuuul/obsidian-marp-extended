import { MarkdownView, TAbstractFile, Plugin, addIcon, App, PluginSettingTab, Setting, TFile, Modal, Notice, editorInfoField } from 'obsidian';
import { EditorView, type ViewUpdate } from '@codemirror/view';

import { MARP_PREVIEW_VIEW, MarpPreviewView } from './views/marpPreviewView';
import { ICON_SLIDE_PREVIEW, ICON_EXPORT_PDF, ICON_EXPORT_PPTX, ICON_SLIDE_PRESENT, ICON_FIT_WIDTH } from './utilities/icons';
import { Libs } from './utilities/libs';
import { MarpSlidesSettings, DEFAULT_SETTINGS } from 'utilities/settings';
import { ensureDefaultThemes } from './utilities/ensureDefaultThemes';
import { ensureDefaultMermaidThemes } from './utilities/ensureDefaultMermaidThemes';
import { DEFAULT_MERMAID_THEME_MANIFEST_VERSION } from './utilities/defaultMermaidThemes';
import { DEFAULT_THEME_MANIFEST_VERSION } from './utilities/defaultThemes';
import { MermaidThemeManager, type InstalledMermaidThemeEntry } from './utilities/mermaidThemeManager';
import { ThemeManager, type InstalledThemeEntry } from './utilities/themeManager';
import { ThemePropertyOptions } from './utilities/themePropertyOptions';
import { getPreviewSlideIndex } from './utilities/previewSync';


export default class MarpSlides extends Plugin {
	
	public settings: MarpSlidesSettings;
	private slidesView : MarpPreviewView;
	private editorView : MarkdownView | null;
	private themePropertyOptions: ThemePropertyOptions | null = null;

	async onload() {
		await this.loadSettings();

		const libsUtility = new Libs(this.settings);
		libsUtility.loadLibs(this.app);

		const themeManager = new ThemeManager(this.app);
		this.themePropertyOptions = new ThemePropertyOptions(this.app, themeManager);
		this.themePropertyOptions.register();
		this.register(() => this.themePropertyOptions?.unregister());
		void this.refreshThemePropertyOptions().catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error('Marp Extended: theme property options refresh failed', message);
		});

		void ensureDefaultThemes(this)
			.then(() => this.refreshThemePropertyOptions())
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
			(leaf) => new MarpPreviewView(this.settings, leaf)
		);

		addIcon('slides-preview-marp', ICON_SLIDE_PREVIEW);
		addIcon('slides-marp-export-pdf', ICON_EXPORT_PDF);
		addIcon('slides-marp-export-pptx', ICON_EXPORT_PPTX);
		addIcon('slides-marp-slide-present', ICON_SLIDE_PRESENT);
		addIcon('slides-marp-fit-width', ICON_FIT_WIDTH);
		this.addRibbonIcon('slides-preview-marp', 'Show Slide Preview', async () => {
			await this.showPreviewSlide();
		});
		
		this.addCommand({
			id: 'preview',
			name: 'Slide Preview',
			callback: () => { this.showPreviewSlide();}
		});
		
		this.addCommand({
			id: 'export-pdf',
			name: 'Export PDF',
			callback: (() => this.exportFile('pdf'))
		});

		this.addCommand({
			id: 'export-pdf-notes',
			name: 'Export PDF with Notes',
			callback: (() => this.exportFile('pdf-with-notes'))
		});

		this.addCommand({
			id: 'export-html',
			name: 'Export HTML',
			callback: (() => this.exportFile('html'))
		});

		this.addCommand({
			id: 'export-pptx',
			name: 'Export PPTX',
			callback: (() => this.exportFile('pptx'))
		});

		this.addCommand({
			id: 'export-png',
			name: 'Export PNG',
			callback: (() => this.exportFile('png'))
		});		

		// this.addCommand({
		// 	id: 'export-deck',
		// 	name: 'Export Deck',
		// 	callback: (() => this.exportFile(''))
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MarpSlidesSettingTab(this.app, this));

		this.registerEditorExtension(EditorView.updateListener.of((update: ViewUpdate) => {
			this.handleEditorUpdate(update);
		}));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.view instanceof MarkdownView) {
				this.refreshPreviewForEditor(leaf.view);
			}
		}));

		this.registerEvent(this.app.vault.on('modify', this.onChange.bind(this)));
		this.registerEvent(this.app.metadataCache.on('changed', (file, data) => {
			this.refreshPreviewForFile(file, data);
		}));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(MARP_PREVIEW_VIEW);
	}

	async loadSettings() {
		const saved = await this.loadData() as Partial<MarpSlidesSettings> | null;
		this.settings = {
			CHROME_PATH: saved?.CHROME_PATH ?? DEFAULT_SETTINGS.CHROME_PATH,
			DefaultThemesSeeded: saved?.DefaultThemesSeeded ?? DEFAULT_SETTINGS.DefaultThemesSeeded,
			DefaultThemesVersion: saved?.DefaultThemesVersion ?? DEFAULT_SETTINGS.DefaultThemesVersion,
			DefaultMermaidThemesSeeded: saved?.DefaultMermaidThemesSeeded ?? DEFAULT_SETTINGS.DefaultMermaidThemesSeeded,
			DefaultMermaidThemesVersion: saved?.DefaultMermaidThemesVersion ?? DEFAULT_SETTINGS.DefaultMermaidThemesVersion,
			EnableHTML: saved?.EnableHTML ?? DEFAULT_SETTINGS.EnableHTML,
			MathTypesettings: saved?.MathTypesettings ?? DEFAULT_SETTINGS.MathTypesettings,
			HTMLExportMode: saved?.HTMLExportMode ?? DEFAULT_SETTINGS.HTMLExportMode,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async refreshThemePropertyOptions(): Promise<void> {
		await this.themePropertyOptions?.refresh();
	}

	onChange(file: TAbstractFile) {
		if (file instanceof TFile) {
			this.refreshPreviewForFile(file);
		}
	}

	async exportFile(type: string){
		const file = this.app.workspace.getActiveFile();
		if(file === null){
			new Notice('Open a Markdown file before exporting Marp slides.', 5000);
			return;
		}

		try {
			const { MarpExport } = await import('./utilities/marpExport');
			const marpCli = new MarpExport(this.settings, this.app);
			const outputPath = await marpCli.export(file,type);
			if (outputPath) {
				new Notice(`Exported Marp slides to ${outputPath}`, 7000);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error('Marp export failed:', error);
			new Notice(`Marp export failed: ${message}`, 8000);
		}
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

		this.app.workspace.revealLeaf(leaf);

		return leaf.view as MarpPreviewView;
	}

	private handleEditorUpdate(update: ViewUpdate): void {
		if (!update.selectionSet && !update.docChanged && !update.focusChanged) {
			return;
		}

		if (!update.view.hasFocus) {
			return;
		}

		const file = update.state.field(editorInfoField, false)?.file;
		if (!file) {
			return;
		}

		const previewView = this.getPreviewViewForEditorFile(file);
		if (!previewView?.isSyncPreviewEnabled()) {
			return;
		}

		const cursorLine = update.state.doc.lineAt(update.state.selection.main.head).number - 1;
		void previewView.onLineChanged(getPreviewSlideIndex(update.state.sliceDoc(), cursorLine));
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
		const leaf = this.app.workspace.getLeavesOfType(MARP_PREVIEW_VIEW)[0];
		if (leaf){
			if (reveal) {
				this.app.workspace.revealLeaf(leaf);
			}
			return leaf.view as MarpPreviewView;
		} else {
			return null;
		}
	}
}



export class MarpSlidesSettingTab extends PluginSettingTab {
	private plugin: MarpSlides;

	constructor(app: App, plugin: MarpSlides) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h3', {text: 'General'});

		new Setting(containerEl)
			.setName('Chrome Path')
			.setDesc('Optional. Leave empty to let Marp CLI automatically find Google Chrome, Chromium, or Microsoft Edge. Set this only if auto-detection fails.')
			.addText(text => text
				.setPlaceholder('Enter CHROME_PATH')
				.setValue(this.plugin.settings.CHROME_PATH)
				.onChange(async (value) => {
					this.plugin.settings.CHROME_PATH = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Enable HTML')
			.setDesc('Enable all HTML elements in Marp Markdown. Please Attention when you enable!!!')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.EnableHTML)
				.onChange(async (value) => {
					this.plugin.settings.EnableHTML = value;
					await this.plugin.saveSettings();
				}));
	
		new Setting(containerEl)
			.setName('Math Typesettings')
			.setDesc('Controls math syntax and the default library for rendering math in Marp Core. A using library can override by math global directive in Markdown.')
			.addDropdown(toggle => toggle
				.addOption("mathjax","mathjax")
				.addOption("katex","katex")
				.setValue(this.plugin.settings.MathTypesettings)
				.onChange(async (value) => {
					this.plugin.settings.MathTypesettings = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('HTML Export Mode')
			.setDesc('Choose the Marp CLI HTML template. Bare is minimal; Bespoke adds presentation controls, presenter view, overview, and transitions.')
			.addDropdown(toggle => toggle
				.addOption("bare","bare (minimal)")
				.addOption("bespoke","bespoke (interactive)")
				.setValue(this.plugin.settings.HTMLExportMode)
				.onChange(async (value) => {
					this.plugin.settings.HTMLExportMode = value;
					await this.plugin.saveSettings();
				}));
		
		this.displayThemesSection(containerEl);
		this.displayMermaidThemesSection(containerEl);
	}

	private displayThemesSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', {text: 'Themes'});

		const themeManager = new ThemeManager(this.app);
		let themeListEl: HTMLElement;

		new Setting(containerEl)
			.setName('Installed themes')
			.setDesc(`Default themes are downloaded from GitHub to ${themeManager.getDefaultThemeDirectory()}. Latest default theme version: v${DEFAULT_THEME_MANIFEST_VERSION}. Use their @theme names in Marp frontmatter.`)
			.addButton(button => button
				.setButtonText('Refresh defaults')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const installed = await themeManager.ensureDefaultThemes({ overwrite: true });
						this.plugin.settings.DefaultThemesSeeded = true;
						this.plugin.settings.DefaultThemesVersion = DEFAULT_THEME_MANIFEST_VERSION;
						await this.plugin.saveSettings();
						new Notice(`Refreshed Marp Extended themes (${installed.length}).`, 5000);
						await this.plugin.refreshThemePropertyOptions();
						await this.renderThemeList(themeListEl);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Theme refresh failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}))
			.addButton(button => button
				.setButtonText('Add CSS theme')
				.setCta()
				.onClick(() => {
					new AddThemeModal(this.app, themeManager, async (entry) => {
						new Notice(`Added Marp theme: ${entry.name}`, 5000);
						await this.plugin.refreshThemePropertyOptions();
						await this.renderThemeList(themeListEl);
					}).open();
				}));

		themeListEl = containerEl.createDiv({ cls: 'marp-extended-theme-list' });
		void this.renderThemeList(themeListEl);
	}

	private getThemeDescription(theme: InstalledThemeEntry): string {
		const source = theme.source === 'default' ? 'Built-in' : 'Custom';
		if (theme.source !== 'default') {
			return `${source} · ${theme.path}`;
		}

		const installedVersion = theme.version == null ? 'unknown' : `v${theme.version}`;
		const updateStatus = theme.version === DEFAULT_THEME_MANIFEST_VERSION
			? 'current'
			: `latest v${DEFAULT_THEME_MANIFEST_VERSION}`;
		return `${source} · installed ${installedVersion} · ${updateStatus} · ${theme.path}`;
	}

	private async renderThemeList(containerEl: HTMLElement): Promise<void> {
		containerEl.empty();

		const themeManager = new ThemeManager(this.app);
		const themes = await themeManager.listThemes();

		if (themes.length === 0) {
			containerEl.createEl('p', {
				cls: 'marp-extended-theme-empty',
				text: 'No themes installed yet. Marp Extended will download default themes on startup, or you can add CSS manually.',
			});
			return;
		}

		themes.forEach((theme) => {
			const setting = new Setting(containerEl)
				.setName(theme.name)
				.setDesc(this.getThemeDescription(theme));

			if (theme.source === 'default') {
				const hasUpdate = theme.version !== DEFAULT_THEME_MANIFEST_VERSION;
				setting.addExtraButton(button => {
					if (hasUpdate) {
						button.extraSettingsEl.addClass('marp-extended-theme-update-needed');
					}

					button
						.setIcon('refresh-cw')
						.setTooltip(hasUpdate ? 'Update available: update theme CSS from GitHub' : 'Update theme CSS from GitHub')
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const updated = await themeManager.updateDefaultTheme(theme.fileName);
								await this.plugin.refreshThemePropertyOptions();
								new Notice(`Updated Marp theme: ${updated.name}`, 5000);
								await this.renderThemeList(containerEl);
							} catch (error) {
								const message = error instanceof Error ? error.message : String(error);
								new Notice(`Theme update failed: ${message}`, 8000);
								button.setDisabled(false);
							}
						});
				});
			}

			setting.addExtraButton(button => button
				.setIcon('trash')
				.setTooltip('Delete theme CSS')
				.onClick(async () => {
					await themeManager.removeTheme(theme.path);
					await this.plugin.refreshThemePropertyOptions();
					new Notice(`Deleted Marp theme: ${theme.name}`, 5000);
					await this.renderThemeList(containerEl);
				}));
		});
	}

	private displayMermaidThemesSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', {text: 'Mermaid themes'});

		const mermaidThemeManager = new MermaidThemeManager(this.app);
		let themeListEl: HTMLElement;

		new Setting(containerEl)
			.setName('Installed Mermaid themes')
			.setDesc(`Mermaid themes are downloaded to ${mermaidThemeManager.getDefaultThemeDirectory()}. Use their names in the mermaidTheme frontmatter property. Latest version: v${DEFAULT_MERMAID_THEME_MANIFEST_VERSION}.`)
			.addButton(button => button
				.setButtonText('Refresh defaults')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const installed = await mermaidThemeManager.ensureDefaultThemes({ overwrite: true });
						this.plugin.settings.DefaultMermaidThemesSeeded = true;
						this.plugin.settings.DefaultMermaidThemesVersion = DEFAULT_MERMAID_THEME_MANIFEST_VERSION;
						await this.plugin.saveSettings();
						new Notice(`Refreshed Mermaid themes (${installed.length}).`, 5000);
						await this.plugin.refreshThemePropertyOptions();
						await this.renderMermaidThemeList(themeListEl);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Mermaid theme refresh failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}))
			.addButton(button => button
				.setButtonText('Add CSS theme')
				.setCta()
				.onClick(() => {
					new AddMermaidThemeModal(this.app, mermaidThemeManager, async (entry) => {
						new Notice(`Added Mermaid theme: ${entry.name}`, 5000);
						await this.plugin.refreshThemePropertyOptions();
						await this.renderMermaidThemeList(themeListEl);
					}).open();
				}));

		themeListEl = containerEl.createDiv({ cls: 'marp-extended-theme-list' });
		void this.renderMermaidThemeList(themeListEl);
	}

	private getMermaidThemeDescription(theme: InstalledMermaidThemeEntry): string {
		const source = theme.source === 'default' ? 'Built-in' : 'Custom';
		if (theme.source !== 'default') {
			return `${source} · ${theme.path}`;
		}

		const installedVersion = theme.version == null ? 'unknown' : `v${theme.version}`;
		const updateStatus = theme.version === DEFAULT_MERMAID_THEME_MANIFEST_VERSION
			? 'current'
			: `latest v${DEFAULT_MERMAID_THEME_MANIFEST_VERSION}`;
		return `${source} · installed ${installedVersion} · ${updateStatus} · ${theme.path}`;
	}

	private async renderMermaidThemeList(containerEl: HTMLElement): Promise<void> {
		containerEl.empty();

		const mermaidThemeManager = new MermaidThemeManager(this.app);
		const themes = await mermaidThemeManager.listThemes();

		if (themes.length === 0) {
			containerEl.createEl('p', {
				cls: 'marp-extended-theme-empty',
				text: 'No Mermaid themes installed yet. Marp Extended will download defaults on startup, or you can add CSS manually.',
			});
			return;
		}

		themes.forEach((theme) => {
			const setting = new Setting(containerEl)
				.setName(theme.name)
				.setDesc(this.getMermaidThemeDescription(theme));

			if (theme.source === 'default') {
				const hasUpdate = theme.version !== DEFAULT_MERMAID_THEME_MANIFEST_VERSION;
				setting.addExtraButton(button => {
					if (hasUpdate) {
						button.extraSettingsEl.addClass('marp-extended-theme-update-needed');
					}

					button
						.setIcon('refresh-cw')
						.setTooltip(hasUpdate ? 'Update available: update Mermaid theme CSS from GitHub' : 'Update Mermaid theme CSS from GitHub')
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const updated = await mermaidThemeManager.updateDefaultTheme(theme.fileName);
								await this.plugin.refreshThemePropertyOptions();
								new Notice(`Updated Mermaid theme: ${updated.name}`, 5000);
								await this.renderMermaidThemeList(containerEl);
							} catch (error) {
								const message = error instanceof Error ? error.message : String(error);
								new Notice(`Mermaid theme update failed: ${message}`, 8000);
								button.setDisabled(false);
							}
						});
				});
			}

			setting.addExtraButton(button => button
				.setIcon('trash')
				.setTooltip('Delete Mermaid theme CSS')
				.onClick(async () => {
					await mermaidThemeManager.removeTheme(theme.path);
					await this.plugin.refreshThemePropertyOptions();
					new Notice(`Deleted Mermaid theme: ${theme.name}`, 5000);
					await this.renderMermaidThemeList(containerEl);
				}));
		});
	}
}

class AddThemeModal extends Modal {
	private themeName = '';
	private themeCss = '';

	constructor(
		app: App,
		private themeManager: ThemeManager,
		private onSaved: (entry: InstalledThemeEntry) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.textContent = 'Add Marp CSS theme';
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('marp-extended-add-theme-modal');

		new Setting(contentEl)
			.setName('Theme name')
			.setDesc('Optional if the CSS already has a /* @theme name */ metadata comment.')
			.addText(text => text
				.setPlaceholder('my-theme')
				.onChange((value) => {
					this.themeName = value;
				}));

		new Setting(contentEl)
			.setName('Theme CSS')
			.setDesc('Paste a Marp theme CSS file. It will be saved into .marp-extended/themes/.')
			.addTextArea(text => {
				text.inputEl.rows = 18;
				text.inputEl.addClass('marp-extended-theme-css-input');
				text.setPlaceholder('/* @theme my-theme */\n\n@import "default";\n\nsection { ... }')
					.onChange((value) => {
						this.themeCss = value;
					});
			});

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(button => button
				.setButtonText('Save theme')
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const entry = await this.themeManager.addThemeFromCss(this.themeCss, this.themeName);
						await this.onSaved(entry);
						this.close();
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Theme save failed: ${message}`, 8000);
						button.setDisabled(false);
					}
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class AddMermaidThemeModal extends Modal {
	private themeName = '';
	private themeCss = '';

	constructor(
		app: App,
		private themeManager: MermaidThemeManager,
		private onSaved: (entry: InstalledMermaidThemeEntry) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.textContent = 'Add Mermaid CSS theme';
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('marp-extended-add-theme-modal');

		new Setting(contentEl)
			.setName('Theme name')
			.setDesc('Optional if the CSS already has a /* @mermaid-theme name */ metadata comment.')
			.addText(text => text
				.setPlaceholder('my-mermaid-theme')
				.onChange((value) => {
					this.themeName = value;
				}));

		new Setting(contentEl)
			.setName('Theme CSS')
			.setDesc('CSS selectors should target .mermaid-diagram-container and the inline SVG variables such as --bg, --fg, --line, and --accent.')
			.addTextArea(text => {
				text.inputEl.rows = 14;
				text.inputEl.cols = 64;
				text.setPlaceholder('/* @mermaid-theme my-mermaid-theme */\nsection .mermaid-diagram-container svg { --accent: #1B365D !important; }');
				text.onChange((value) => {
					this.themeCss = value;
				});
			});

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Save Mermaid theme')
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const entry = await this.themeManager.addThemeFromCss(this.themeCss, this.themeName);
						await this.onSaved(entry);
						this.close();
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Could not save Mermaid theme: ${message}`, 8000);
						button.setDisabled(false);
					}
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
