import { Platform, TFile, App } from 'obsidian';
import { MarpSlidesSettings } from './settings';
import { FilePath } from './filePath';
import { renderMermaidFences } from '../markdown-it/mermaid';
import { compileKamiFencedBlocks } from './kamiDsl';
import { insertMarkdownAfterFrontmatter, loadMermaidThemeCssForFile, wrapMermaidThemeCss } from './mermaidTheme';

export class MarpCLIError extends Error {}

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

type MarpCliFunction = (argv: string[], opts: Record<string, unknown>) => Promise<number>;
type NodeRequireFunction = (moduleName: string) => unknown;
type NodeCreateRequire = (filename: string | URL) => NodeRequireFunction;

interface NodeModuleApi {
    createRequire: NodeCreateRequire;
}

type ProcessWithPkg = typeof process & { pkg?: unknown };

interface MarpCliError extends Error {
    errorCode?: string | number;
}

interface MarpCliModule {
    default?: MarpCliFunction;
    marpCli?: MarpCliFunction;
    CLIError: new (...args: unknown[]) => MarpCliError;
    CLIErrorCode: {
        NOT_FOUND_CHROMIUM: string | number;
    };
}

interface ExportSource {
    path: string;
    temporaryPath: string | null;
}

let marpCliModulePromise: Promise<MarpCliModule> | null = null;

type NodeFsModule = typeof import('node:fs');
type NodePathModule = typeof import('node:path');

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

function normalizeCreateRequireFilename(filename: string | URL): string | URL {
    const value = filename instanceof URL ? filename.href : filename;
    const appUrlMatch = value.split('?')[0].match(/^app:\/\/[^/]+\/(.*)$/i);

    if (appUrlMatch) {
        const decoded = decodeURIComponent(appUrlMatch[1]);
        if (decoded.startsWith('/') || /^[A-Za-z]:[\\/]/.test(decoded)) {
            return decoded;
        }
        return `/${decoded}`;
    }

    if (typeof value === 'string' && /^file:\/\//i.test(value)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Marp CLI createRequire normalization needs Node url helpers
        const { fileURLToPath } = require('node:url') as typeof import('node:url');
        return fileURLToPath(value.split('?')[0]);
    }

    return filename;
}

async function withNormalizedCreateRequire<T>(callback: () => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ESM node:module exports are read-only; patching needs CommonJS require()
    const nodeModule = require('node:module') as NodeModuleApi;
    const originalCreateRequire = nodeModule.createRequire;

    nodeModule.createRequire = (filename: string | URL) => (
        originalCreateRequire(normalizeCreateRequireFilename(filename))
    );

    try {
        return await callback();
    } finally {
        nodeModule.createRequire = originalCreateRequire;
    }
}

async function withMarpCliExecutionPatches<T>(callback: () => Promise<T>): Promise<T> {
    const runtimeProcess = process as ProcessWithPkg;
    const hadPkg = Object.prototype.hasOwnProperty.call(runtimeProcess, 'pkg');
    const originalPkg = runtimeProcess.pkg;

    // Obsidian's renderer cannot dynamically import file-system engine paths
    // from the app:// plugin bundle, but CommonJS require() can load them.
    // Marp CLI uses this flag to fall back to require() for engine loading.
    runtimeProcess.pkg = originalPkg ?? {};

    try {
        return await withNormalizedCreateRequire(callback);
    } finally {
        if (hadPkg) {
            runtimeProcess.pkg = originalPkg;
        } else {
            delete runtimeProcess.pkg;
        }
    }
}

async function loadMarpCliModule(): Promise<MarpCliModule> {
    if (!marpCliModulePromise) {
        marpCliModulePromise = importMarpCliModule();
    }

    return marpCliModulePromise;
}

async function importMarpCliModule(): Promise<MarpCliModule> {
    return withNormalizedCreateRequire(async () => (
        await import('@marp-team/marp-cli') as unknown as MarpCliModule
    ));
}

export class MarpExport {

    private settings : MarpSlidesSettings;
    private app : App | null;

    constructor(settings: MarpSlidesSettings, app: App | null = null) {
        this.settings = settings;
        this.app = app;
    }

    async export(file: TFile, type: string): Promise<string | null>{
        const fs = getNodeFs();
        const path = getNodePath();
        const filesTool = new FilePath(this.settings);
        const outputPath = await this.getOutputPath(file, type, filesTool, path);
        if (this.shouldChooseExportDirectory(type) && outputPath == null) {
            return null;
        }

        const sourceFilePath = filesTool.getCompleteFilePath(file);
        const themePaths = filesTool.getThemePaths(file).filter((themePath) => fs.existsSync(themePath));
        const resourcesPath = filesTool.getLibDirectory(file.vault);
        const marpEngineConfig = filesTool.getMarpEngine(file.vault);

        if (sourceFilePath != ''){
            const exportSource = await this.prepareExportSource(file, filesTool, sourceFilePath, fs, path);
            const completeFilePath = exportSource.path;
            //console.log(completeFilePath);

            const argv: string[] = [completeFilePath,'--allow-local-files'];
            //const argv: string[] = ['--engine', '@marp-team/marp-core', completeFilePath,'--allow-local-files'];

            argv.push('--engine');
            argv.push(marpEngineConfig);

            if (themePaths.length > 0){
                argv.push('--theme-set');
                argv.push(...themePaths);
            }

            this.pushBrowserPath(argv);
            argv.push('--html');

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
                    argv.push(this.settings.HTMLExportMode);
                    this.pushOutputPath(argv, outputPath);
                    break;
                case 'preview':
                    argv.push('--preview');
                    break;
                default:
                    //argv.push('--template');
                    //argv.push('bare');
                    //argv.push('bespoke');
                    //argv.push('--engine');
                    //argv.remove(completeFilePath);
                    //process.env.PORT = "5001";
                    //argv.push('PORT=5001');
                    //argv.push('--server');
                    
                    //argv.push('--watch');
            }
            try {
                await this.run(argv, resourcesPath);
                return outputPath;
            } finally {
                this.removeTemporaryExportSource(exportSource.temporaryPath, fs);
            }
        } 

        return null;

    }

    //async exportPdf(argv: string[], opts?: MarpCLIAPIOptions | undefined){
    private async run(argv: string[], resourcesPath: string){
        const { CHROME_PATH } = process.env;
        let marpCliModule: MarpCliModule | null = null;

        try {
            process.env.CHROME_PATH = this.settings.CHROME_PATH || CHROME_PATH;

            marpCliModule = await loadMarpCliModule();
            await this.runMarpCli(argv, resourcesPath, marpCliModule);
            
        } catch (e) {
            console.error(e)

            if (
                marpCliModule &&
                e instanceof marpCliModule.CLIError &&
                e.errorCode === marpCliModule.CLIErrorCode.NOT_FOUND_CHROMIUM
            ) {
                const browsers = ['[Google Chrome](https://www.google.com/chrome/)']

                if (process.platform === 'linux')
                    browsers.push('[Chromium](https://www.chromium.org/)')

                browsers.push('[Microsoft Edge](https://www.microsoft.com/edge)')

                throw new MarpCLIError(
                    `It requires to install ${browsers
                    .join(', ')
                    .replace(/, ([^,]*)$/, ' or $1')} for exporting.`
                )
            }

            throw e
        } finally {
            process.env.CHROME_PATH = CHROME_PATH
        }
    }

    private async runMarpCli(argv: string[], resourcesPath: string, marpCliModule: MarpCliModule) {
        const temp__dirname = __dirname;
        const marpCli = marpCliModule.default ?? marpCliModule.marpCli;

        if (!marpCli) {
            throw new MarpCLIError('Marp CLI API is unavailable.');
        }

        try {    
            // eslint-disable-next-line no-global-assign, no-implicit-globals -- Marp CLI resolves bundled resources via __dirname
            __dirname = resourcesPath;
            const exitCode = await withMarpCliExecutionPatches(() => marpCli(argv, {}));

            if (exitCode > 0) {
                throw new MarpCLIError(`Marp CLI failed with exit status ${exitCode}.`)
            }
        } catch(e) {
            if (e instanceof marpCliModule.CLIError){
                console.error(`CLIError code: ${e.errorCode}, message: ${e.message}`);
            } else {
                console.error("Generic Error!");
            }

            throw e;
        } finally {
            // eslint-disable-next-line no-global-assign, no-implicit-globals -- Restore the plugin bundle __dirname after Marp CLI export
            __dirname = temp__dirname;
        }
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
        const compiledMarkdown = compileKamiFencedBlocks(originalContent);
        const processedMarkdown = renderMermaidFences(filesTool.convertImageWikiLinks(compiledMarkdown, file, this.app));
        const processedContent = insertMarkdownAfterFrontmatter(
            processedMarkdown,
            wrapMermaidThemeCss(mermaidThemeCss),
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

        const sourceFilePath = filesTool.getCompleteFilePath(file);
        const defaultPath = path.join(path.dirname(sourceFilePath), `${file.basename}.${extension}`);

        return this.chooseExportFile(defaultPath, extension);
    }

    private pushOutputPath(argv: string[], outputPath: string | null): void {
        if (!outputPath) {
            return;
        }

        argv.push('-o');
        argv.push(outputPath);
    }

    private pushBrowserPath(argv: string[]): void {
        if (!this.settings.CHROME_PATH) {
            return;
        }

        argv.push('--browser-path');
        argv.push(this.settings.CHROME_PATH);
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
            if (result.canceled) {
                return null;
            }
            return result.filePath ?? null;
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
        const maybeWindowRequire = (typeof window !== 'undefined' ? (window as Window & { require?: ElectronRequire }).require : undefined);
        if (maybeWindowRequire) {
            return maybeWindowRequire;
        }

        if (typeof require !== 'undefined') {
            return require as ElectronRequire;
        }

        return null;
    }
}
