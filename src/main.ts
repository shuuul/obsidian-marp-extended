import { MarkdownView, Plugin, addIcon, PluginSettingTab, Setting, TFile, Modal, Notice, type App, type TAbstractFile } from 'obsidian';
import { EditorView, type ViewUpdate } from '@codemirror/view';

import { MARP_PREVIEW_VIEW, MarpPreviewView } from './views/marpPreviewView';
import { ICON_SLIDE_PREVIEW, ICON_EXPORT_PDF, ICON_EXPORT_PPTX, ICON_SLIDE_PRESENT, ICON_FIT_WIDTH } from './utilities/icons';
import { type MarpSlidesSettings, DEFAULT_SETTINGS } from 'utilities/settings';
import { ensureDefaultThemes } from './utilities/ensureDefaultThemes';
import { ensureDefaultMermaidThemes } from './utilities/ensureDefaultMermaidThemes';
import { MermaidThemeManager, type InstalledMermaidThemeEntry } from './utilities/mermaidThemeManager';
import { ThemeManager, type InstalledThemeEntry } from './utilities/themeManager';
import { ThemePropertyOptions } from './utilities/themePropertyOptions';
import { getPreviewSlideIndexFromLineReader } from './utilities/previewSync';
import { MarpExport } from './utilities/marpExport';


export default class MarpSlides extends Plugin {
	
	public settings: MarpSlidesSettings;
	private slidesView : MarpPreviewView;
	private editorView : MarkdownView | null;
	private themePropertyOptions: ThemePropertyOptions | null = null;

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
			(leaf) => new MarpPreviewView(this.settings, leaf)
		);

		addIcon('slides-preview-marp', ICON_SLIDE_PREVIEW);
		addIcon('slides-marp-export-pdf', ICON_EXPORT_PDF);
		addIcon('slides-marp-export-pptx', ICON_EXPORT_PPTX);
		addIcon('slides-marp-slide-present', ICON_SLIDE_PRESENT);
		addIcon('slides-marp-fit-width', ICON_FIT_WIDTH);
		this.addRibbonIcon('slides-preview-marp', 'Show slide preview', async () => {
			await this.showPreviewSlide();
		});
		
		this.addCommand({
			id: 'preview',
			name: 'Slide preview',
			callback: () => { void this.showPreviewSlide(); }
		});
		
		this.addCommand({
			id: 'export-pdf',
			name: 'Export PDF',
			callback: (() => this.exportFile('pdf'))
		});

		this.addCommand({
			id: 'export-pdf-notes',
			name: 'Export PDF with notes',
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

		this.registerEvent(this.app.vault.on('modify', (file) => this.onChange(file)));
		this.registerEvent(this.app.metadataCache.on('changed', (file, data) => {
			this.refreshPreviewForFile(file, data);
		}));
	}

	async loadSettings() {
		const saved = await this.loadData() as Partial<MarpSlidesSettings> | null;
		this.settings = {
			MARP_CLI_PATH: saved?.MARP_CLI_PATH ?? DEFAULT_SETTINGS.MARP_CLI_PATH,
			MARP_CLI_USE_NPX: saved?.MARP_CLI_USE_NPX ?? DEFAULT_SETTINGS.MARP_CLI_USE_NPX,
			CHROME_PATH: saved?.CHROME_PATH ?? DEFAULT_SETTINGS.CHROME_PATH,
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

		let progressNotice: Notice | null = null;
		try {
			const marpCli = new MarpExport(this.settings, this.app);
			progressNotice = new Notice(`Exporting Marp slides as ${type.toUpperCase()}…`, 0);
			const outputPath = await marpCli.export(file,type);
			progressNotice.hide();
			progressNotice = null;
			if (outputPath) {
				new Notice(`Exported Marp slides to ${outputPath}`, 7000);
			}
		} catch (error) {
			progressNotice?.hide();
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



export class MarpSlidesSettingTab extends PluginSettingTab {
	private plugin: MarpSlides;

	constructor(app: App, plugin: MarpSlides) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Export and preview')
			.setHeading();

		let marpCliPathText: { setValue(value: string): void } | null = null;
		new Setting(containerEl)
			.setName('Marp CLI path')
			.setDesc('Optional. Export uses this executable first. Leave empty to auto-detect marp from PATH and common Homebrew locations.')
			.addText(text => {
				marpCliPathText = text;
				text
					.setPlaceholder('marp or /opt/homebrew/bin/marp')
					.setValue(this.plugin.settings.MARP_CLI_PATH)
					.onChange(async (value) => {
						this.plugin.settings.MARP_CLI_PATH = value;
						await this.plugin.saveSettings();
					});
			})
			.addButton(button => button
				.setButtonText('Auto-detect')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const detectedPath = MarpExport.detectCliPath();
						if (!detectedPath) {
							new Notice('Marp CLI was not found in PATH or common install locations.', 7000);
							return;
						}
						this.plugin.settings.MARP_CLI_PATH = detectedPath;
						marpCliPathText?.setValue(detectedPath);
						await this.plugin.saveSettings();
						new Notice(`Detected Marp CLI: ${detectedPath}`, 7000);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Marp CLI auto-detect failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}))
			.addButton(button => button
				.setButtonText('Test CLI')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const version = await MarpExport.getCliVersion(this.plugin.settings);
						new Notice(`Marp CLI found${version ? `: ${version}` : '.'}`, 5000);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Marp CLI test failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}));

		new Setting(containerEl)
			.setName('Use npx fallback')
			.setDesc('If Marp CLI is not found and no path is set, run a pinned @marp-team/marp-cli@4.4.0 through npx. This requires Node.js/npm and may download the package on first use.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.MARP_CLI_USE_NPX)
				.onChange(async (value) => {
					this.plugin.settings.MARP_CLI_USE_NPX = value;
					await this.plugin.saveSettings();
				}));

		let chromePathText: { setValue(value: string): void } | null = null;
		new Setting(containerEl)
			.setName('Chrome path')
			.setDesc('Optional. Leave empty to let Marp CLI automatically find Google Chrome, Chromium, or Microsoft Edge. Set this only if export auto-detection fails.')
			.addText(text => {
				chromePathText = text;
				text
					.setPlaceholder('Enter CHROME_PATH')
					.setValue(this.plugin.settings.CHROME_PATH)
					.onChange(async (value) => {
						this.plugin.settings.CHROME_PATH = value;
						await this.plugin.saveSettings();
					});
			})
			.addButton(button => button
				.setButtonText('Auto-detect')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const detectedPath = MarpExport.detectBrowserPath();
						if (!detectedPath) {
							new Notice('Chrome, Chromium, or Microsoft Edge was not found in PATH or common install locations.', 7000);
							return;
						}
						this.plugin.settings.CHROME_PATH = detectedPath;
						chromePathText?.setValue(detectedPath);
						await this.plugin.saveSettings();
						new Notice(`Detected browser: ${detectedPath}`, 7000);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Browser auto-detect failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}));
		this.displayThemesSection(containerEl);
		this.displayMermaidThemesSection(containerEl);
	}

	private displayThemesSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Themes')
			.setHeading();

		const themeManager = new ThemeManager(this.app);
		let themeListEl: HTMLElement;

		new Setting(containerEl)
			.setName('Installed themes')
			.setDesc(`Bundled default themes are installed as managed CSS files in ${themeManager.getDefaultThemeDirectory()} from the current plugin package. Fork a default theme before editing it. Use @theme names in Marp frontmatter.`)
			.addButton(button => button
				.setButtonText('Add CSS theme')
				.setCta()
				.onClick(() => {
					new AddThemeModal(this.app, themeManager, async (entry) => {
						new Notice(`Added Marp theme: ${entry.name}`, 5000);
						await this.plugin.refreshThemePropertyOptions();
						this.plugin.refreshActivePreview();
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

		return `${source} · managed by Marp Extended · fork to edit · ${theme.path}`;
	}

	private async renderThemeList(containerEl: HTMLElement): Promise<void> {
		containerEl.empty();

		const themeManager = new ThemeManager(this.app);
		const themes = await themeManager.listThemes();

		if (themes.length === 0) {
			containerEl.createEl('p', {
				cls: 'marp-extended-theme-empty',
				text: 'No themes installed yet. Marp Extended will install bundled default themes on startup, or you can add CSS manually.',
			});
			return;
		}

		themes.forEach((theme) => {
			const setting = new Setting(containerEl)
				.setName(theme.name)
				.setDesc(this.getThemeDescription(theme));

			if (theme.source === 'default') {
				setting.addExtraButton(button => button
						.setIcon('copy')
						.setTooltip('Fork bundled default theme')
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const forked = await themeManager.forkDefaultTheme(theme.fileName);
								await this.plugin.refreshThemePropertyOptions();
								this.plugin.refreshActivePreview();
								new Notice(`Forked Marp theme: ${forked.name}`, 5000);
								await this.renderThemeList(containerEl);
							} catch (error) {
								const message = error instanceof Error ? error.message : String(error);
								new Notice(`Theme fork failed: ${message}`, 8000);
								button.setDisabled(false);
							}
						}));
			} else {
				setting.addExtraButton(button => button
					.setIcon('pencil')
					.setTooltip('Edit custom theme CSS')
					.onClick(async () => {
						button.setDisabled(true);
						try {
							const css = await themeManager.readThemeCss(theme.path);
							new AddThemeModal(this.app, themeManager, async (entry) => {
								new Notice(`Saved Marp theme: ${entry.name}`, 5000);
								await this.plugin.refreshThemePropertyOptions();
								this.plugin.refreshActivePreview();
								await this.renderThemeList(containerEl);
							}, {
								entry: theme,
								initialCss: css,
								initialName: theme.name,
								mode: 'edit',
							}).open();
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							new Notice(`Theme edit failed: ${message}`, 8000);
						} finally {
							button.setDisabled(false);
						}
					}));

				setting.addExtraButton(button => button
					.setIcon('trash')
					.setTooltip('Delete custom theme CSS')
					.onClick(async () => {
						await themeManager.removeTheme(theme.path);
						await this.plugin.refreshThemePropertyOptions();
						this.plugin.refreshActivePreview();
						new Notice(`Deleted Marp theme: ${theme.name}`, 5000);
						await this.renderThemeList(containerEl);
					}));
			}
		});
	}

	private displayMermaidThemesSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Mermaid themes')
			.setHeading();

		const mermaidThemeManager = new MermaidThemeManager(this.app);
		let themeListEl: HTMLElement;

		new Setting(containerEl)
			.setName('Installed Mermaid themes')
			.setDesc(`Bundled Mermaid themes are installed as managed CSS files in ${mermaidThemeManager.getDefaultThemeDirectory()} from the current plugin package. Fork a default before editing it. Use their names in the mermaidTheme frontmatter property.`)
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

		return `${source} · managed by Marp Extended · fork to edit · ${theme.path}`;
	}

	private async renderMermaidThemeList(containerEl: HTMLElement): Promise<void> {
		containerEl.empty();

		const mermaidThemeManager = new MermaidThemeManager(this.app);
		const themes = await mermaidThemeManager.listThemes();

		if (themes.length === 0) {
			containerEl.createEl('p', {
				cls: 'marp-extended-theme-empty',
				text: 'No Mermaid themes installed yet. Marp Extended will install bundled defaults on startup, or you can add CSS manually.',
			});
			return;
		}

		themes.forEach((theme) => {
			const setting = new Setting(containerEl)
				.setName(theme.name)
				.setDesc(this.getMermaidThemeDescription(theme));

			if (theme.source === 'default') {
				setting.addExtraButton(button => button
						.setIcon('copy')
						.setTooltip('Fork bundled Mermaid theme')
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const forked = await mermaidThemeManager.forkDefaultTheme(theme.fileName);
								await this.plugin.refreshThemePropertyOptions();
								new Notice(`Forked Mermaid theme: ${forked.name}`, 5000);
								await this.renderMermaidThemeList(containerEl);
							} catch (error) {
								const message = error instanceof Error ? error.message : String(error);
								new Notice(`Mermaid theme fork failed: ${message}`, 8000);
								button.setDisabled(false);
							}
						}));
			} else {
				setting.addExtraButton(button => button
					.setIcon('pencil')
					.setTooltip('Edit custom Mermaid theme CSS')
					.onClick(async () => {
						button.setDisabled(true);
						try {
							const css = await mermaidThemeManager.readThemeCss(theme.path);
							new AddMermaidThemeModal(this.app, mermaidThemeManager, async (entry) => {
								new Notice(`Saved Mermaid theme: ${entry.name}`, 5000);
								await this.plugin.refreshThemePropertyOptions();
								await this.renderMermaidThemeList(containerEl);
							}, {
								entry: theme,
								initialCss: css,
								initialName: theme.name,
								mode: 'edit',
							}).open();
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							new Notice(`Mermaid theme edit failed: ${message}`, 8000);
						} finally {
							button.setDisabled(false);
						}
					}));

				setting.addExtraButton(button => button
					.setIcon('trash')
					.setTooltip('Delete custom Mermaid theme CSS')
					.onClick(async () => {
						await mermaidThemeManager.removeTheme(theme.path);
						await this.plugin.refreshThemePropertyOptions();
						new Notice(`Deleted Mermaid theme: ${theme.name}`, 5000);
						await this.renderMermaidThemeList(containerEl);
					}));
			}
		});
	}
}

interface ThemeModalOptions<TEntry> {
	entry?: TEntry;
	initialCss?: string;
	initialName?: string;
	mode?: 'add' | 'edit';
}

class AddThemeModal extends Modal {
	private themeName = '';
	private themeCss = '';
	private mode: 'add' | 'edit';
	private entry?: InstalledThemeEntry;

	constructor(
		app: App,
		private themeManager: ThemeManager,
		private onSaved: (entry: InstalledThemeEntry) => Promise<void>,
		options: ThemeModalOptions<InstalledThemeEntry> = {},
	) {
		super(app);
		this.themeName = options.initialName ?? '';
		this.themeCss = options.initialCss ?? '';
		this.mode = options.mode ?? 'add';
		this.entry = options.entry;
	}

	onOpen(): void {
		this.titleEl.textContent = this.mode === 'edit' ? 'Edit Marp CSS theme' : 'Add Marp CSS theme';
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('marp-extended-add-theme-modal');

		new Setting(contentEl)
			.setName('Theme name')
			.setDesc('Optional if the CSS already has a /* @theme name */ metadata comment.')
			.addText(text => text
				.setPlaceholder('my-theme')
				.setValue(this.themeName)
					.onChange((value) => {
						this.themeName = value;
					}));

		const cssSetting = new Setting(contentEl)
			.setName('Theme CSS')
			.setDesc('Paste a Marp theme CSS file. It will be saved into .marp-extended/themes/.')
			.addTextArea(text => {
				text.inputEl.rows = 18;
				text.inputEl.addClass('marp-extended-theme-css-input');
				text.setPlaceholder('/* @theme my-theme */\n\n@import "default";\n\nsection { ... }')
					.setValue(this.themeCss)
						.onChange((value) => {
							this.themeCss = value;
						});
			});
		cssSetting.settingEl.addClass('marp-extended-theme-css-setting');

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(button => button
				.setButtonText(this.mode === 'edit' ? 'Save changes' : 'Save theme')
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const entry = this.mode === 'edit' && this.entry
								? await this.themeManager.updateCustomThemeFromCss(this.entry.path, this.themeCss, this.themeName)
								: await this.themeManager.addThemeFromCss(this.themeCss, this.themeName);
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
	private mode: 'add' | 'edit';
	private entry?: InstalledMermaidThemeEntry;

	constructor(
		app: App,
		private themeManager: MermaidThemeManager,
		private onSaved: (entry: InstalledMermaidThemeEntry) => Promise<void>,
		options: ThemeModalOptions<InstalledMermaidThemeEntry> = {},
	) {
		super(app);
		this.themeName = options.initialName ?? '';
		this.themeCss = options.initialCss ?? '';
		this.mode = options.mode ?? 'add';
		this.entry = options.entry;
	}

	onOpen(): void {
		this.titleEl.textContent = this.mode === 'edit' ? 'Edit Mermaid CSS theme' : 'Add Mermaid CSS theme';
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('marp-extended-add-theme-modal');

		new Setting(contentEl)
			.setName('Theme name')
			.setDesc('Optional if the CSS already has a /* @mermaid-theme name */ metadata comment.')
			.addText(text => text
				.setPlaceholder('my-mermaid-theme')
				.setValue(this.themeName)
					.onChange((value) => {
						this.themeName = value;
					}));

		const cssSetting = new Setting(contentEl)
			.setName('Theme CSS')
			.setDesc('CSS selectors should target .mermaid-diagram-container and the inline SVG variables such as --bg, --fg, --line, and --accent.')
			.addTextArea(text => {
				text.inputEl.rows = 14;
				text.inputEl.cols = 64;
				text.inputEl.addClass('marp-extended-theme-css-input');
				text.setPlaceholder('/* @mermaid-theme my-mermaid-theme */\nsection .mermaid-diagram-container svg { --accent: #1B365D !important; }');
				text.setValue(this.themeCss);
					text.onChange((value) => {
						this.themeCss = value;
					});
			});
		cssSetting.settingEl.addClass('marp-extended-theme-css-setting');

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
				.addButton(button => button
					.setButtonText(this.mode === 'edit' ? 'Save changes' : 'Save Mermaid theme')
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						try {
							const entry = this.mode === 'edit' && this.entry
								? await this.themeManager.updateCustomThemeFromCss(this.entry.path, this.themeCss, this.themeName)
								: await this.themeManager.addThemeFromCss(this.themeCss, this.themeName);
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
