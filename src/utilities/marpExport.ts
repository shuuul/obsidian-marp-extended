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

interface MarpCliExecResult {
    stdout: string;
    stderr: string;
}

interface MarpCliExecError extends Error {
    code?: string | number;
    errno?: number;
    syscall?: string;
    path?: string;
}

interface ExportSource {
    path: string;
    temporaryPath: string | null;
}

interface MarpCliInvocation {
    executable: string;
    argsPrefix: string[];
    isNpxFallback: boolean;
}

type NodeChildProcessModule = typeof import('node:child_process');
type NodeFsModule = typeof import('node:fs');
type NodePathModule = typeof import('node:path');

const DEFAULT_MARP_CLI_COMMAND = 'marp';
const DEFAULT_NPX_MARP_CLI_PACKAGE = '@marp-team/marp-cli@4.4.0';
const MISSING_MARP_CLI_INSTALL_HINT = 'Install it with `npm install -g @marp-team/marp-cli`, set the Marp CLI path, or enable npx fallback in Marp Extended settings.';
const MISSING_NPX_INSTALL_HINT = 'Install Node.js/npm so npx is available, or set the Marp CLI path in Marp Extended settings.';
const MARP_CLI_MAX_BUFFER = 10 * 1024 * 1024;
const COMMON_MARP_CLI_DIRECTORIES = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/opt/local/bin',
    '/usr/bin',
    '/bin',
];

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

function getNodeChildProcess(): NodeChildProcessModule {
	assertDesktopExport();
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop export uses Node child_process via require(); dynamic import() fails at runtime
	return require('node:child_process') as NodeChildProcessModule;
}

const EXPORT_EXTENSIONS: Record<string, string> = {
    pdf: 'pdf',
    'pdf-with-notes': 'pdf',
    pptx: 'pptx',
    html: 'html',
};

class MarpCliProcessError extends Error {
    constructor(
        message: string,
        readonly executable: string,
        readonly args: string[],
        readonly exitCode: number | null,
        readonly code: string | number | undefined,
        readonly stdout: string,
        readonly stderr: string,
        readonly isNpxFallback: boolean,
    ) {
        super(message);
        this.name = 'MarpCliProcessError';
    }
}

function getMarpCliExecutableNames(): string[] {
    return process.platform === 'win32'
        ? ['marp.cmd', 'marp.exe', 'marp']
        : [DEFAULT_MARP_CLI_COMMAND];
}

function getNpxExecutableNames(): string[] {
    return process.platform === 'win32'
        ? ['npx.cmd', 'npx.exe', 'npx']
        : ['npx'];
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function getPathSearchDirectories(path: NodePathModule): string[] {
    return uniqueStrings([
        ...(process.env.PATH ?? '').split(path.delimiter),
        ...COMMON_MARP_CLI_DIRECTORIES,
    ]);
}

function isExecutableFile(fs: NodeFsModule, path: string): boolean {
    try {
        fs.accessSync(path, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function detectExecutablePath(executableNames: string[]): string | null {
    const fs = getNodeFs();
    const path = getNodePath();
    const directories = getPathSearchDirectories(path);

    for (const directory of directories) {
        for (const executableName of executableNames) {
            const executablePath = path.join(directory, executableName);
            if (isExecutableFile(fs, executablePath)) {
                return executablePath;
            }
        }
    }

    return null;
}

function detectMarpCliPath(): string | null {
    return detectExecutablePath(getMarpCliExecutableNames());
}

function getNpxExecutable(): string {
    return detectExecutablePath(getNpxExecutableNames()) ?? (process.platform === 'win32' ? 'npx.cmd' : 'npx');
}

function getPrimaryMarpCliInvocation(settings: MarpSlidesSettings): MarpCliInvocation {
    const configuredPath = settings.MARP_CLI_PATH.trim();
    const detectedPath = configuredPath ? null : detectMarpCliPath();
    const executable = configuredPath || detectedPath || DEFAULT_MARP_CLI_COMMAND;
    return {
        executable,
        argsPrefix: [],
        isNpxFallback: false,
    };
}

function getNpxMarpCliInvocation(): MarpCliInvocation {
    return {
        executable: getNpxExecutable(),
        argsPrefix: ['--yes', '--package', DEFAULT_NPX_MARP_CLI_PACKAGE, DEFAULT_MARP_CLI_COMMAND],
        isNpxFallback: true,
    };
}

function shouldUseNpxFallback(settings: MarpSlidesSettings, error: MarpCliProcessError): boolean {
    return settings.MARP_CLI_USE_NPX
        && settings.MARP_CLI_PATH.trim().length === 0
        && !error.isNpxFallback
        && isMissingExecutable(error);
}

function getMarpCliEnvironment(settings: MarpSlidesSettings): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (settings.CHROME_PATH.trim()) {
        env.CHROME_PATH = settings.CHROME_PATH.trim();
    }
    return env;
}

function toOutputText(output: string | Buffer | undefined): string {
    if (output == null) {
        return '';
    }
    return Buffer.isBuffer(output) ? output.toString('utf-8') : output;
}

function getExecErrorExitCode(error: MarpCliExecError): number | null {
    return typeof error.code === 'number' ? error.code : null;
}

function execMarpCli(
    invocation: MarpCliInvocation,
    args: string[],
    settings: MarpSlidesSettings,
): Promise<MarpCliExecResult> {
    const { spawn } = getNodeChildProcess();
    const commandArgs = [...invocation.argsPrefix, ...args];
    return new Promise((resolve, reject) => {
        const child = spawn(invocation.executable, commandArgs, {
            env: getMarpCliEnvironment(settings),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let stdoutText = '';
        let stderrText = '';
        let settled = false;

        const rejectOnce = (
            message: string,
            exitCode: number | null,
            code: string | number | undefined,
        ): void => {
            if (settled) {
                return;
            }
            settled = true;
            reject(new MarpCliProcessError(
                message,
                invocation.executable,
                commandArgs,
                exitCode,
                code,
                stdoutText,
                stderrText,
                invocation.isNpxFallback,
            ));
        };

        const appendOutput = (target: 'stdout' | 'stderr', output: string | Buffer): void => {
            if (target === 'stdout') {
                stdoutText += toOutputText(output);
            } else {
                stderrText += toOutputText(output);
            }

            if (stdoutText.length + stderrText.length > MARP_CLI_MAX_BUFFER) {
                child.kill();
                rejectOnce('Marp CLI output exceeded the maximum buffer size.', null, 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
            }
        };

        child.stdout?.on('data', (output: string | Buffer) => appendOutput('stdout', output));
        child.stderr?.on('data', (output: string | Buffer) => appendOutput('stderr', output));
        child.on('error', (error: MarpCliExecError) => {
            rejectOnce(error.message, getExecErrorExitCode(error), error.code);
        });
        child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
            if (settled) {
                return;
            }
            settled = true;

            if (exitCode === 0) {
                resolve({ stdout: stdoutText, stderr: stderrText });
                return;
            }

            reject(new MarpCliProcessError(
                signal ? `Marp CLI was terminated by ${signal}.` : `Marp CLI exited with status ${String(exitCode ?? 'unknown')}.`,
                invocation.executable,
                commandArgs,
                exitCode,
                exitCode ?? signal ?? undefined,
                stdoutText,
                stderrText,
                invocation.isNpxFallback,
            ));
        });
    });
}

function getMarpCliOutput(error: MarpCliProcessError): string {
    return [error.stderr, error.stdout].filter((output) => output.trim().length > 0).join('\n').trim();
}

function isMissingExecutable(error: MarpCliProcessError): boolean {
    return error.code === 'ENOENT';
}

function isMissingBrowserError(output: string): boolean {
    return /NOT_FOUND_CHROMIUM|could not find.*(?:chrome|chromium|edge)|no .*browser|no usable sandbox|install .*chrome|chromium.*not found/i.test(output);
}

function toUserFacingCliError(error: MarpCliProcessError): MarpCLIError {
    if (isMissingExecutable(error)) {
        if (error.isNpxFallback) {
            return new MarpCLIError(`npx executable was not found. ${MISSING_NPX_INSTALL_HINT} Tried: ${error.executable}`);
        }
        return new MarpCLIError(`Marp CLI executable was not found. ${MISSING_MARP_CLI_INSTALL_HINT} Tried: ${error.executable}`);
    }

    const output = getMarpCliOutput(error);
    if (isMissingBrowserError(output)) {
        const suffix = output ? `\n\n${output}` : '';
        return new MarpCLIError(`Marp CLI could not find Chrome, Chromium, or Microsoft Edge. Install a supported browser or set CHROME_PATH in Marp Extended settings.${suffix}`);
    }

    const status = error.exitCode == null ? `error code ${String(error.code ?? 'unknown')}` : `exit status ${error.exitCode}`;
    const suffix = output ? `\n\n${output}` : '';
    return new MarpCLIError(`Marp CLI failed with ${status}.${suffix}`);
}

async function execMarpCliWithFallback(
    settings: MarpSlidesSettings,
    args: string[],
): Promise<MarpCliExecResult> {
    const primaryInvocation = getPrimaryMarpCliInvocation(settings);
    try {
        return await execMarpCli(primaryInvocation, args, settings);
    } catch (error) {
        if (!(error instanceof MarpCliProcessError)) {
            throw error;
        }

        if (!shouldUseNpxFallback(settings, error)) {
            throw toUserFacingCliError(error);
        }

        try {
            return await execMarpCli(getNpxMarpCliInvocation(), args, settings);
        } catch (fallbackError) {
            if (fallbackError instanceof MarpCliProcessError) {
                throw toUserFacingCliError(fallbackError);
            }

            throw fallbackError;
        }
    }
}

export class MarpExport {

    private settings : MarpSlidesSettings;
    private app : App | null;

    static detectCliPath(): string | null {
        return detectMarpCliPath();
    }

    static async getCliVersion(settings: MarpSlidesSettings): Promise<string> {
        const result = await execMarpCliWithFallback(settings, ['--version']);
        return (result.stdout || result.stderr).trim();
    }

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
                await this.run(argv);
                return outputPath;
            } finally {
                this.removeTemporaryExportSource(exportSource.temporaryPath, fs);
            }
        } 

        return null;

    }

    //async exportPdf(argv: string[], opts?: MarpCLIAPIOptions | undefined){
    private async run(argv: string[]): Promise<void> {
        await execMarpCliWithFallback(this.settings, argv);
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
