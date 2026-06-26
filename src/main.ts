import { MarkdownView, TAbstractFile, Plugin, addIcon, App, PluginSettingTab, Setting, EditorSuggest, EditorPosition, Editor, TFile, EditorSuggestTriggerInfo, EditorSuggestContext, Modal, Notice  } from 'obsidian';

import { MARP_PREVIEW_VIEW, MarpPreviewView } from './views/marpPreviewView';
import { ICON_SLIDE_PREVIEW, ICON_EXPORT_PDF, ICON_EXPORT_PPTX, ICON_SLIDE_PRESENT, ICON_FIT_WIDTH } from './utilities/icons';
import { Libs } from './utilities/libs';
import { MarpSlidesSettings, DEFAULT_SETTINGS } from 'utilities/settings';
import { ensureDefaultThemes } from './utilities/ensureDefaultThemes';
import { DEFAULT_THEME_MANIFEST_VERSION } from './utilities/defaultThemes';
import { ThemeManager, type InstalledThemeEntry } from './utilities/themeManager';
import { ThemePropertyOptions } from './utilities/themePropertyOptions';


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

		this.registerEditorSuggest(new LineSelectionListener(this.app, this));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.view instanceof MarkdownView) {
				this.refreshPreviewForEditor(leaf.view);
			}
		}));

		this.registerEvent(this.app.vault.on('modify', this.onChange.bind(this)));
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
			EnableHTML: saved?.EnableHTML ?? DEFAULT_SETTINGS.EnableHTML,
			MathTypesettings: saved?.MathTypesettings ?? DEFAULT_SETTINGS.MathTypesettings,
			HTMLExportMode: saved?.HTMLExportMode ?? DEFAULT_SETTINGS.HTMLExportMode,
			EnableMarkdownItPlugins: saved?.EnableMarkdownItPlugins ?? DEFAULT_SETTINGS.EnableMarkdownItPlugins,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async refreshThemePropertyOptions(): Promise<void> {
		await this.themePropertyOptions?.refresh();
	}

	onChange(file: TAbstractFile) {
		if (file == this.editorView?.file) {
			const view = this.getViewInstance(false);
			if (view) {
				void view.onChange(this.editorView);
			}
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
		
		new Setting(containerEl)
			.setName('MarkdownIt Plugins')
			.setDesc('Enable the Markdown It Plugins (Mark, Containers, Kroki)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.EnableMarkdownItPlugins)
				.onChange(async (value) => {
					this.plugin.settings.EnableMarkdownItPlugins = value;
					await this.plugin.saveSettings();
				}));

		this.displayThemesSection(containerEl);
	}

	private displayThemesSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', {text: 'Themes'});

		const themeManager = new ThemeManager(this.app);
		let themeListEl: HTMLElement;

		new Setting(containerEl)
			.setName('Installed themes')
			.setDesc(`Default themes are downloaded from GitHub to ${themeManager.getDefaultThemeDirectory()}. Use their @theme names in Marp frontmatter.`)
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
			const desc = `${theme.source === 'default' ? 'Built-in' : 'Custom'} · ${theme.path}`;
			const setting = new Setting(containerEl)
				.setName(theme.name)
				.setDesc(desc);

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

class LineSelectionListener extends EditorSuggest<string> {
	private plugin: MarpSlides;

	constructor(app: App, plugin: MarpSlides) {
		super(app);
		this.plugin = plugin;
	}

	private hasFrontMatter(text: string): boolean {
		const lines = text.split('\n');
		if (lines[0]?.trim() !== '---') {
			return false;
		}

		return lines.slice(1).some((line) => line.trim() === '---');
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
		//console.log("line: " + cursor.line);
		//console.log("ch: " + cursor.ch);
		//console.log("value: " + editor.getValue());
        
        const activeView = this.plugin.getActiveMarkdownView();
		const instance = activeView?.file === file
			? this.plugin.syncPreviewContext(activeView)
			: this.plugin.getViewInstance(false);

		if (instance?.isSyncPreviewEnabled()) {
			const lines = editor.getValue().split('\n');
			const firstNLines = lines.slice(0, cursor.line);
			const text = firstNLines.join('\n');
			
			const regex = new RegExp('---', 'g');
			const matches = text.match(regex);
			const slide = matches ? matches.length : 0;
			if (this.hasFrontMatter(text)) {
				instance.onLineChanged(slide - 2);
			} else {
				instance.onLineChanged(slide);
			}			
		}
		return null;
	}
	getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
		const suggestion :string[] = [];
		return suggestion;
		//throw new Error('Method not implemented.');
	}
	renderSuggestion(value: string, el: HTMLElement): void {
		throw new Error('Method not implemented.');
	}
	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		throw new Error('Method not implemented.');
	}
}
