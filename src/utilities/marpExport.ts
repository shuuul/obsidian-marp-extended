import { TFile, App } from 'obsidian';
import { MarpSlidesSettings } from './settings';
import { FilePath } from './filePath';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export class MarpCLIError extends Error {}

interface ElectronOpenDialogOptions {
    title: string;
    defaultPath?: string;
    properties: string[];
}

interface ElectronOpenDialogResult {
    canceled: boolean;
    filePaths?: string[];
}

interface ElectronDialog {
    showOpenDialog?: (options: ElectronOpenDialogOptions) => Promise<ElectronOpenDialogResult>;
    showOpenDialogSync?: (options: ElectronOpenDialogOptions) => string[] | undefined;
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

let marpCliModulePromise: Promise<MarpCliModule> | null = null;

const EXPORT_EXTENSIONS: Record<string, string> = {
    pdf: 'pdf',
    'pdf-with-notes': 'pdf',
    pptx: 'pptx',
    png: 'png',
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
        return fileURLToPath(value.split('?')[0]);
    }

    return filename;
}

async function withNormalizedCreateRequire<T>(callback: () => Promise<T>): Promise<T> {
    const nodeModule = require('node:module') as NodeModuleApi;
    const originalCreateRequire = nodeModule.createRequire;

    nodeModule.createRequire = ((filename: string | URL) => (
        originalCreateRequire(normalizeCreateRequireFilename(filename))
    )) as NodeCreateRequire;

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
        const filesTool = new FilePath(this.settings);
        const outputPath = await this.getOutputPath(file, type, filesTool);
        if (this.shouldChooseExportDirectory(type) && outputPath == null) {
            return null;
        }

        await filesTool.removeFileFromRoot(file);
        await filesTool.copyFileToRoot(file);
        const completeFilePath = filesTool.getCompleteFilePath(file);
        const themePaths = filesTool.getThemePaths(file).filter((path) => existsSync(path));
        const resourcesPath = filesTool.getLibDirectory(file.vault);
        const marpEngineConfig = filesTool.getMarpEngine(file.vault);

        // Convert wiki-link images to standard markdown before export
        if (this.app && completeFilePath != '') {
            try {
                const originalContent = readFileSync(completeFilePath, 'utf-8');
                const processedContent = filesTool.convertImageWikiLinks(originalContent, file, this.app);
                writeFileSync(completeFilePath, processedContent, 'utf-8');
            } catch (e) {
                console.error('Failed to process wiki-links for export:', e);
            }
        }

        if (completeFilePath != ''){
            //console.log(completeFilePath);

            const argv: string[] = [completeFilePath,'--allow-local-files'];
            //const argv: string[] = ['--engine', '@marp-team/marp-core', completeFilePath,'--allow-local-files'];

            if (this.settings.EnableMarkdownItPlugins){
                argv.push('--engine');
                argv.push(marpEngineConfig);
            }

            if (themePaths.length > 0){
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
                case 'png':
                    argv.push('--image');
                    argv.push('png');
                    this.pushOutputPath(argv, outputPath);
                    break;
                case 'html':
                    argv.push('--html');
                    argv.push('--template');
                    argv.push(this.settings.HTMLExportMode);
                    this.pushOutputPath(argv, outputPath);
                    break;
                case 'preview':
                    argv.push('--html');
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
            await this.run(argv, resourcesPath);
            return outputPath;
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
        //console.info(`Execute Marp CLI [${argv.join(' ')}] (${JSON.stringify(opts)})`)
        console.info(`Execute Marp CLI [${argv.join(' ')}]`);
        const temp__dirname = __dirname;
        const marpCli = marpCliModule.default ?? marpCliModule.marpCli;

        if (!marpCli) {
            throw new MarpCLIError('Marp CLI API is unavailable.');
        }

        try {    
            // eslint-disable-next-line no-global-assign
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
            // eslint-disable-next-line no-global-assign
            __dirname = temp__dirname;
        }
    }

    private shouldChooseExportDirectory(type: string): boolean {
        return EXPORT_EXTENSIONS[type] != null;
    }

    private async getOutputPath(file: TFile, type: string, filesTool: FilePath): Promise<string | null> {
        const extension = EXPORT_EXTENSIONS[type];
        if (!extension) {
            return null;
        }

        const directory = await this.chooseExportDirectory(filesTool.getCompleteFilePath(file));
        if (!directory) {
            return null;
        }

        return join(directory, `${file.basename}.${extension}`);
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

    private async chooseExportDirectory(sourceFilePath: string): Promise<string | null> {
        const dialog = this.getElectronDialog();
        if (!dialog) {
            return sourceFilePath ? dirname(sourceFilePath) : null;
        }

        const options: ElectronOpenDialogOptions = {
            title: 'Choose export folder',
            defaultPath: sourceFilePath ? dirname(sourceFilePath) : undefined,
            properties: ['openDirectory', 'createDirectory'],
        };

        if (dialog.showOpenDialog) {
            const result = await dialog.showOpenDialog(options);
            if (result.canceled) {
                return null;
            }
            return result.filePaths?.[0] ?? null;
        }

        if (dialog.showOpenDialogSync) {
            return dialog.showOpenDialogSync(options)?.[0] ?? null;
        }

        throw new MarpCLIError('Folder picker is unavailable in this environment.');
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
