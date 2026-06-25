import marpCli, { CLIError, CLIErrorCode } from '@marp-team/marp-cli'
import { TFile, App } from 'obsidian';
import { MarpSlidesSettings } from './settings';
import { FilePath } from './filePath';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

const EXPORT_EXTENSIONS: Record<string, string> = {
    pdf: 'pdf',
    'pdf-with-notes': 'pdf',
    pptx: 'pptx',
    png: 'png',
    html: 'html',
};

export class MarpExport {

    private settings : MarpSlidesSettings;
    private app : App | null;

    constructor(settings: MarpSlidesSettings, app: App | null = null) {
        this.settings = settings;
        this.app = app;
    }

    async export(file: TFile, type: string){
        const filesTool = new FilePath(this.settings);
        const outputPath = await this.getOutputPath(file, type, filesTool);
        if (this.shouldChooseExportDirectory(type) && outputPath == null) {
            return;
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
                    argv.push('--images');
                    argv.push('--png');
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
        } 

    }

    //async exportPdf(argv: string[], opts?: MarpCLIAPIOptions | undefined){
    private async run(argv: string[], resourcesPath: string){
        const { CHROME_PATH } = process.env;

        try {
            process.env.CHROME_PATH = this.settings.CHROME_PATH || CHROME_PATH;

            await this.runMarpCli(argv, resourcesPath);
            
        } catch (e) {
            console.error(e)

            if (
                e instanceof CLIError &&
                e.errorCode === CLIErrorCode.NOT_FOUND_CHROMIUM
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

    private async runMarpCli(argv: string[], resourcesPath: string) {
        //console.info(`Execute Marp CLI [${argv.join(' ')}] (${JSON.stringify(opts)})`)
        console.info(`Execute Marp CLI [${argv.join(' ')}]`);
        const temp__dirname = __dirname;

        try {    
            // eslint-disable-next-line no-global-assign
            __dirname = resourcesPath;
            const exitCode = await marpCli(argv, {});

            if (exitCode > 0) {
                console.error(`Failure (Exit status: ${exitCode})`)
            }
        } catch(e) {
            if (e instanceof CLIError){
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

    private async chooseExportDirectory(sourceFilePath: string): Promise<string | null> {
        const dialog = this.getElectronDialog();
        if (!dialog) {
            throw new MarpCLIError('Folder picker is unavailable in this environment.');
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
