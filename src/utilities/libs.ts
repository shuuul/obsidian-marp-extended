import type * as NodeFs from 'node:fs';
import type * as NodeHttps from 'node:https';
import type * as NodePath from 'node:path';
import type * as NodeUrl from 'node:url';
import { Platform, type App } from 'obsidian';
import { FilePath } from './filePath';
import type { MarpSlidesSettings } from './settings';
import JSZip from 'jszip';

type NodeFsModule = typeof NodeFs;
type NodePathModule = typeof NodePath;
type NodeHttpsModule = typeof NodeHttps;
type NodeUrlModule = typeof NodeUrl;

function getNodeFs(): NodeFsModule {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop plugin installs libs with Node fs via require()
	return require('node:fs') as NodeFsModule;
}

function getNodePath(): NodePathModule {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop plugin installs libs with Node path via require()
	return require('node:path') as NodePathModule;
}

function getNodeHttps(): NodeHttpsModule {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop plugin downloads optional libs with Node https via require()
	return require('node:https') as NodeHttpsModule;
}

function getNodeUrl(): NodeUrlModule {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop plugin downloads optional libs with Node url via require()
	return require('node:url') as NodeUrlModule;
}

function download(url: string, redirectCount = 0): Promise<Buffer> {
	const { get } = getNodeHttps();
	const { URL } = getNodeUrl();

	return new Promise((resolve, reject) => {
		get(new URL(url), (response) => {
			const { statusCode, headers } = response;

			if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
				response.resume();
				if (redirectCount >= 5) {
					reject(new Error(`Too many redirects while downloading ${url}`));
					return;
				}
				void download(new URL(headers.location, url).toString(), redirectCount + 1)
					.then(resolve)
					.catch(reject);
				return;
			}

			if (statusCode !== 200) {
				response.resume();
				reject(new Error(`Download failed with status ${statusCode ?? 'unknown'} for ${url}`));
				return;
			}

			const chunks: Buffer[] = [];
			response.on('data', (chunk: Buffer) => chunks.push(chunk));
			response.on('end', () => resolve(Buffer.concat(chunks)));
		}).on('error', reject);
	});
}

export class Libs {

    private settings : MarpSlidesSettings;

    constructor(settings: MarpSlidesSettings) {
        this.settings = settings;
    }
 
    async loadLibs(app: App): Promise<void> {
		if (!Platform.isDesktop) {
			return;
		}

		try {
			await this.loadLibsDesktop(app);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Marp Extended: failed to load markdown-it libraries: ${message}`);
		}
    }

	private async loadLibsDesktop(app: App): Promise<void> {
		const { existsSync, mkdirSync, writeFileSync } = getNodeFs();
		const { dirname } = getNodePath();
        const libPathUtility = new FilePath(this.settings);
        const libPath = libPathUtility.getLibDirectory(app.vault);

        if (!existsSync(libPath)) {
			const downloadUrl = `https://github.com/samuele-cozzi/obsidian-marp-slides/releases/download/lib-v3/lib.zip`;

			const buf = await download(downloadUrl);
			const contents = await new JSZip().loadAsync(buf);
			await Promise.all(
				Object.keys(contents.files).map(async (filename) => {
					if (contents.files[filename].dir) {
						return;
					}

					const file = contents.file(filename);
					if (file != null){
						const content = await file.async('nodebuffer');
						const dest = `${libPathUtility.getLibDirectory(app.vault)}${filename}`;
						mkdirSync(dirname(dest), { recursive: true });
						writeFileSync(dest, content);
					}
				}),
			);
			this.writeMarpEngineConfig(libPathUtility, app);
			return;
		}

		this.writeMarpEngineConfig(libPathUtility, app);
    }

	private writeMarpEngineConfig(libPathUtility: FilePath, app: App): void {
		const { mkdirSync, writeFileSync } = getNodeFs();
		const { dirname } = getNodePath();
		const engineConfigPath = libPathUtility.getMarpEngine(app.vault);

		mkdirSync(dirname(engineConfigPath), { recursive: true });
		writeFileSync(engineConfigPath, this.getMarpEngineConfig(), 'utf-8');
	}

	private getMarpEngineConfig(): string {
		return `module.exports = ({ marp }) =>
marp
.use(require('./markdown-it/markdown-it-mark/dist/markdown-it-mark.min'))
.use(require('./markdown-it/markdown-it-container/dist/markdown-it-container.min'), 'container');
`;
	}
}