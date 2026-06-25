import { Vault, normalizePath, FileSystemAdapter, TFile, App } from 'obsidian';
import { MarpSlidesSettings } from './settings';
import { DEFAULT_THEME_DIRECTORY } from './defaultThemes';
import { normalize as normalizeFilePath } from 'node:path';

export class FilePath  {

    private settings : MarpSlidesSettings;

    constructor(settings: MarpSlidesSettings) {
        this.settings = settings;
    }

    private getLinkFormat(file: TFile): string {
        //console.log(`newLinkFormat: ${(file.vault as any).getConfig("newLinkFormat")}`);
        return (file.vault as any).getConfig("newLinkFormat");
    }

    private isAbsoluteLinkFormat(file: TFile): boolean {
        if(this.getLinkFormat(file) == "absolute"){
            return true;
        }
        else{
            return false;
        }
    }

    private getVaultPath(vault: Vault, normalizedPath: string): string {
        const adapter = vault.adapter as FileSystemAdapter;
        const path = normalizePath(normalizedPath);

        // Obsidian's desktop adapter can provide the real filesystem path.
        // Use it for Marp CLI because resource URLs like app://... are only
        // valid inside Obsidian's WebView and are rejected by Node APIs.
        if (adapter.getFullPath) {
            return this.normalizeFileSystemPath(adapter.getFullPath(path));
        }

        if (adapter.getFilePath) {
            return this.normalizeFileSystemPath(adapter.getFilePath(path));
        }

        return this.normalizeFileSystemPath(`${adapter.getBasePath()}/${path}`);
    }

    private normalizeFileSystemPath(path: string): string {
        const cleanPath = path.split('?')[0];

        if (/^app:\/\//i.test(cleanPath)) {
            const match = cleanPath.match(/^app:\/\/[^/]+\/(.*)$/i);
            if (match) {
                const decoded = decodeURIComponent(match[1]);
                if (decoded.startsWith('/') || /^[A-Za-z]:\//.test(decoded)) {
                    return this.normalizeFilePathSeparators(decoded);
                }
                return this.normalizeFilePathSeparators(`/${decoded}`);
            }
        }

        if (/^file:\/\//i.test(cleanPath)) {
            const url = new URL(cleanPath);
            const decoded = decodeURIComponent(url.pathname);
            if (/^\/[A-Za-z]:\//.test(decoded)) {
                return this.normalizeFilePathSeparators(decoded.slice(1));
            }
            return this.normalizeFilePathSeparators(decoded);
        }

        return this.normalizeFilePathSeparators(cleanPath);
    }

    private normalizeFilePathSeparators(path: string): string {
        return normalizeFilePath(path.replace(/\\/g, '/'));
    }

	public getCompleteFileBasePath(file: TFile): string{
        let resourcePath = [""];
        if(this.isAbsoluteLinkFormat(file)){
            resourcePath = (file.vault.adapter as FileSystemAdapter).getResourcePath(normalizePath("/")).split("?");
        }
        else
        {
            if (file.parent != null){
                resourcePath = (file.vault.adapter as FileSystemAdapter).getResourcePath(normalizePath(file.parent.path)).split("?");
            }
        }
        //console.log(`Complete File Base Path: ${resourcePath}`);
        return `${resourcePath[0]}/`;
	}

    public getCompleteFilePath(file: TFile) : string{

        let basePath = this.getVaultPath(file.vault, file.path);
        if(this.isAbsoluteLinkFormat(file)){
            basePath = this.getVaultPath(file.vault, file.name);
        }
        //console.log(`Complete File Path: ${basePath}`);
        return basePath;
	}

    public async copyFileToRoot(file: TFile) {
        if(this.isAbsoluteLinkFormat(file)){
            await (file.vault.adapter as FileSystemAdapter).copy(file.path, file.name);
            //console.log(`copied!`);
        }
    }

    public async removeFileFromRoot(file: TFile) {
        const isFileExists = await (file.vault.adapter as FileSystemAdapter).exists(file.name);
        if(this.isAbsoluteLinkFormat(file) && isFileExists){
            await (file.vault.adapter as FileSystemAdapter).remove(file.name);
        }
    }

    public getDefaultThemePath(file: TFile): string{
        return this.getVaultPath(file.vault, DEFAULT_THEME_DIRECTORY);
    }

    public getThemePaths(file: TFile): string[]{
        return [this.getDefaultThemePath(file)];
    }

    private getPluginDirectory(vault: Vault): string {
        const path = `${this.getVaultPath(vault, `${vault.configDir}/plugins/marp-extended`)}/`;
        //console.log(path);
        return path;
	}

    public getLibDirectory(vault: Vault): string {
        const pluginDirectory = this.getPluginDirectory(vault);
        const path = `${pluginDirectory}lib3/`;
        //console.log(path);
        return path;
	}

    public getMarpEngine(vault: Vault): string {
        const libDirectory = this.getLibDirectory(vault);
        const path = `${libDirectory}marp.config.js`;
        //console.log(path);
        return path;
	}

    /**
     * Convert Obsidian wiki-link image syntax to standard Markdown.
     * Transforms ![[image.png]] to ![image.png](path/to/image.png)
     */
    public convertImageWikiLinks(markdown: string, sourceFile: TFile, app: App): string {
        // Image extensions to convert
        const imageExtensions = /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i;

        // Regex: ![[filename]] or ![[filename|alt text]]
        const wikiLinkRegex = /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g;

        return markdown.replace(wikiLinkRegex, (match, filename, altText) => {
            // Only process image files
            if (!imageExtensions.test(filename)) {
                return match;
            }

            // Use Obsidian's link resolver to find the file
            const linkedFile = app.metadataCache.getFirstLinkpathDest(filename, sourceFile.path);

            if (linkedFile) {
                // Build path based on link format setting
                let imagePath: string;
                if (this.isAbsoluteLinkFormat(sourceFile)) {
                    // Absolute: path from vault root
                    imagePath = linkedFile.path;
                } else {
                    // Relative: path from source file's folder
                    imagePath = this.getRelativePathFromFile(sourceFile, linkedFile);
                }

                const alt = altText || filename;
                return `![${alt}](${imagePath})`;
            }

            // File not found - return original
            return match;
        });
    }

    /**
     * Calculate relative path from source file to target file.
     */
    private getRelativePathFromFile(sourceFile: TFile, targetFile: TFile): string {
        const sourceParts = sourceFile.parent?.path.split('/').filter(p => p) || [];
        const targetParts = targetFile.path.split('/').filter(p => p);

        // Find common prefix length
        let commonLength = 0;
        while (commonLength < sourceParts.length &&
               commonLength < targetParts.length - 1 &&
               sourceParts[commonLength] === targetParts[commonLength]) {
            commonLength++;
        }

        // Build relative path
        const upCount = sourceParts.length - commonLength;
        const relativeParts = [...Array(upCount).fill('..'), ...targetParts.slice(commonLength)];

        return relativeParts.join('/');
    }
}
