import type * as NodeFs from 'node:fs';
import type * as NodePath from 'node:path';
import { App, Notice, Platform, TFile } from 'obsidian';
import { ensureEngineArtifact } from '../runtime/engineArtifact';
import {
	clearMarpCliVersionCache,
	detectBrowserPath,
	detectMarpCliPath,
	getMarpCliVersion,
	MarpCLIError,
	runMarpCli,
} from '../runtime/marpCli';
import { wrapBuiltinThemeScaleCss } from './builtinThemeScale';
import { FilePath } from './filePath';
import { compileMarkdownForMarp } from './marpMarkdown';
import { MARP_EXTENDED_STRUCTURAL_CSS } from './marpExtendedStructuralCss';
import {
	insertMarkdownAfterFrontmatter,
	loadMermaidThemeCssForFile,
	parseMermaidRenderOptionsFromCss,
	wrapMermaidThemeCss,
} from './mermaidTheme';
import { MarpExtendedSettings } from './settings';

export { MarpCLIError };

interface ElectronSaveDialogOptions {
	title: string;
	defaultPath?: string;
	filters?: Array<{
		name: string;
		extensions: string[];
	}>;
}

interface ElectronSaveDialogResult {
	canceled: boolean;
	filePath?: string;
}

interface ElectronDialog {
	showSaveDialog?: (options: ElectronSaveDialogOptions) => Promise<ElectronSaveDialogResult>;
	showSaveDialogSync?: (options: ElectronSaveDialogOptions) => string | undefined;
}

interface ElectronModule {
	dialog?: ElectronDialog;
	remote?: {
		dialog?: ElectronDialog;
	};
}

type ElectronRequire = (moduleName: string) => ElectronModule;

interface ExportSource {
	path: string;
	temporaryPath: string | null;
}

type NodeFsModule = typeof NodeFs;
type NodePathModule = typeof NodePath;

const HTML_EXPORT_TEMPLATE = 'bespoke';

function assertDesktopExport(): void {
	if (!Platform.isDesktop) {
		throw new MarpCLIError('Export is only available on desktop Obsidian.');
	}
}

function getNodeFs(): NodeFsModule {
	assertDesktopExport();
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop export uses Node fs via require(); dynamic import() fails at runtime
	return require('node:fs') as NodeFsModule;
}

function getNodePath(): NodePathModule {
	assertDesktopExport();
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop export uses Node path via require(); dynamic import() fails at runtime
	return require('node:path') as NodePathModule;
}

const EXPORT_EXTENSIONS: Record<string, string> = {
	pdf: 'pdf',
	'pdf-with-notes': 'pdf',
	pptx: 'pptx',
	html: 'html',
};

export class MarpExport {
	private settings: MarpExtendedSettings;
	private app: App | null;
	private pluginDir: string | undefined;

	static detectCliPath(): string | null {
		return detectMarpCliPath();
	}

	static detectBrowserPath(): string | null {
		return detectBrowserPath();
	}

	/** Clears the process-local CLI validation cache. */
	static clearCliVersionCache(): void {
		clearMarpCliVersionCache();
	}

	static getCliVersion(settings: MarpExtendedSettings): Promise<string> {
		return getMarpCliVersion(settings);
	}

	constructor(settings: MarpExtendedSettings, app: App | null = null, pluginDir?: string) {
		this.settings = settings;
		this.app = app;
		this.pluginDir = pluginDir;
	}

	async export(file: TFile, type: string): Promise<string | null> {
		const fs = getNodeFs();
		const path = getNodePath();
		const filesTool = new FilePath(this.settings);
		const outputPath = await this.getOutputPath(file, type, filesTool, path);
		if (this.shouldChooseExportDirectory(type) && outputPath == null) {
			return null;
		}
		const enginePath = this.app
			? await ensureEngineArtifact(this.app, this.pluginDir)
			: path.resolve('marp-engine.cjs');

		const sourceFilePath = filesTool.getExportFileSystemPath(file);
		const themePaths = filesTool.getThemePaths(file).filter((themePath) => fs.existsSync(themePath));
		if (sourceFilePath !== '') {
			const exportSource = await this.prepareExportSource(file, filesTool, sourceFilePath, fs, path);
			const argv: string[] = [exportSource.path, '--allow-local-files', '--engine', enginePath, '--html'];

			if (themePaths.length > 0) {
				argv.push('--theme-set');
				argv.push(...themePaths);
			}

			this.pushBrowserPath(argv);
			switch (type) {
				case 'pdf':
					argv.push('--pdf');
					this.pushOutputPath(argv, outputPath);
					break;
				case 'pdf-with-notes':
					argv.push('--pdf');
					argv.push('--pdf-notes');
					argv.push('--pdf-outlines');
					this.pushOutputPath(argv, outputPath);
					break;
				case 'pptx':
					argv.push('--pptx');
					this.pushOutputPath(argv, outputPath);
					break;
				case 'html':
					argv.push('--template');
					argv.push(HTML_EXPORT_TEMPLATE);
					this.pushOutputPath(argv, outputPath);
					break;
				case 'preview':
					argv.push('--preview');
					break;
			}
			try {
				await runMarpCli(this.settings, argv);
				return outputPath;
			} finally {
				this.removeTemporaryExportSource(exportSource.temporaryPath, fs);
			}
		}

		return null;
	}

	private async prepareExportSource(
		file: TFile,
		filesTool: FilePath,
		sourceFilePath: string,
		fs: NodeFsModule,
		path: NodePathModule,
	): Promise<ExportSource> {
		if (!this.app) {
			await filesTool.removeFileFromRoot(file);
			await filesTool.copyFileToRoot(file);
			return { path: sourceFilePath, temporaryPath: null };
		}

		const originalContent = await this.app.vault.cachedRead(file);
		const mermaidThemeCss = await loadMermaidThemeCssForFile(this.app, file, originalContent);
		const mermaidRenderOptions = parseMermaidRenderOptionsFromCss(mermaidThemeCss);
		const processedMarkdown = await compileMarkdownForMarp(originalContent, file, this.app, filesTool, {
			renderMermaidInline: true,
			mermaidOptions: {
				renderOptions: mermaidRenderOptions,
				autoFit: { enabled: this.settings.MERMAID_AUTO_FIT },
			},
			noteWikiLinkMode: 'export',
		});
		const processedContent = insertMarkdownAfterFrontmatter(
			processedMarkdown,
			`${wrapMermaidThemeCss(mermaidThemeCss)}${wrapBuiltinThemeScaleCss()}\n<style>${MARP_EXTENDED_STRUCTURAL_CSS}</style>`,
		);
		const needsTemporarySource = processedContent !== originalContent || filesTool.shouldUseRootExportSource(file);

		if (!needsTemporarySource) {
			return { path: sourceFilePath, temporaryPath: null };
		}

		const temporaryPath = this.getTemporaryExportSourcePath(sourceFilePath, file.basename, path);
		fs.writeFileSync(temporaryPath, processedContent, { encoding: 'utf-8', flag: 'wx' });
		return { path: temporaryPath, temporaryPath };
	}

	private getTemporaryExportSourcePath(sourceFilePath: string, basename: string, path: NodePathModule): string {
		const suffix = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
		return path.join(path.dirname(sourceFilePath), `.${basename}.marp-export-${suffix}.md`);
	}

	private removeTemporaryExportSource(temporaryPath: string | null, fs: NodeFsModule): void {
		if (!temporaryPath || !fs.existsSync(temporaryPath)) {
			return;
		}
		fs.unlinkSync(temporaryPath);
	}

	private shouldChooseExportDirectory(type: string): boolean {
		return EXPORT_EXTENSIONS[type] != null;
	}

	private async getOutputPath(
		file: TFile,
		type: string,
		filesTool: FilePath,
		path: NodePathModule,
	): Promise<string | null> {
		const extension = EXPORT_EXTENSIONS[type];
		if (!extension) {
			return null;
		}

		const sourceFilePath = filesTool.getExportFileSystemPath(file);
		const defaultPath = path.join(path.dirname(sourceFilePath), `${file.basename}.${extension}`);
		return this.chooseExportFile(defaultPath, extension);
	}

	private pushOutputPath(argv: string[], outputPath: string | null): void {
		if (outputPath) {
			argv.push('-o', outputPath);
		}
	}

	private pushBrowserPath(argv: string[]): void {
		if (this.settings.CHROME_PATH) {
			argv.push('--browser-path', this.settings.CHROME_PATH);
		}
	}

	private async chooseExportFile(defaultPath: string, extension: string): Promise<string | null> {
		const dialog = this.getElectronDialog();
		if (!dialog) {
			return defaultPath;
		}

		const options: ElectronSaveDialogOptions = {
			title: 'Choose export file',
			defaultPath,
			filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
		};
		if (dialog.showSaveDialog) {
			const result = await dialog.showSaveDialog(options);
			return result.canceled ? null : result.filePath ?? null;
		}
		if (dialog.showSaveDialogSync) {
			return dialog.showSaveDialogSync(options) ?? null;
		}
		return defaultPath;
	}

	private getElectronDialog(): ElectronDialog | null {
		const electronRequire = this.getElectronRequire();
		if (!electronRequire) {
			return null;
		}

		try {
			const electron = electronRequire('electron');
			const dialog = electron.remote?.dialog ?? electron.dialog;
			if (dialog) {
				return dialog;
			}
		} catch {
			// Try @electron/remote below.
		}

		try {
			return electronRequire('@electron/remote').dialog ?? null;
		} catch {
			return null;
		}
	}

	private getElectronRequire(): ElectronRequire | null {
		const maybeWindowRequire = typeof window !== 'undefined'
			? (window as Window & { require?: ElectronRequire }).require
			: undefined;
		if (maybeWindowRequire) {
			return maybeWindowRequire;
		}
		if (typeof require !== 'undefined') {
			return require as ElectronRequire;
		}
		return null;
	}
}

export async function exportWithNotice(
	settings: MarpExtendedSettings,
	app: App,
	type: string,
	file: TFile | null,
	pluginDir?: string,
): Promise<void> {
	if (!file) {
		new Notice('Open a Markdown file before exporting Marp slides.', 5000);
		return;
	}

	let progressNotice: Notice | null = null;
	try {
		const marpCli = new MarpExport(settings, app, pluginDir);
		progressNotice = new Notice(`Exporting Marp slides as ${type.toUpperCase()}…`, 0);
		const outputPath = await marpCli.export(file, type);
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
