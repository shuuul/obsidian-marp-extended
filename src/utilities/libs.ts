import { App } from 'obsidian';
import { FilePath } from './filePath';
import { MarpSlidesSettings } from './settings';
import JSZip from 'jszip';
import { dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { URL } from 'node:url';

function download(url: string, redirectCount = 0): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		get(new URL(url), (response) => {
			const { statusCode, headers } = response;

			if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
				response.resume();
				if (redirectCount >= 5) {
					reject(new Error(`Too many redirects while downloading ${url}`));
					return;
				}
				resolve(download(new URL(headers.location, url).toString(), redirectCount + 1));
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
 
    loadLibs(app: App){
        const libPathUtility = new FilePath(this.settings);
        const libPath = libPathUtility.getLibDirectory(app.vault);

        if (!existsSync(libPath)) {
			//Download binary
			const downloadUrl = `https://github.com/samuele-cozzi/obsidian-marp-slides/releases/download/lib-v3/lib.zip`;

			download(downloadUrl)
				.then((buf) => new JSZip().loadAsync(buf))
				.then((contents) => Promise.all(
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
						})
				))
				.catch(error => {
					console.log(error);
				});
		}
    }
}
