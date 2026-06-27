import { Vault, normalizePath, FileSystemAdapter, TFile, App } from 'obsidian';
import { MarpSlidesSettings } from './settings';
import { DEFAULT_THEME_DIRECTORY } from './defaultThemes';

interface VaultWithLinkConfig {
	getConfig(key: 'newLinkFormat'): string;
}

export class FilePath  {

    private settings : MarpSlidesSettings;

    constructor(settings: MarpSlidesSettings) {
        this.settings = settings;
    }

    private getLinkFormat(file: TFile): string {
        return (file.vault as unknown as VaultWithLinkConfig).getConfig('newLinkFormat');
    }

    private isAbsoluteLinkFormat(file: TFile): boolean {
        if(this.getLinkFormat(file) == "absolute"){
            return true;
        }
        else{
            return false;
        }
    }

    public shouldUseRootExportSource(file: TFile): boolean {
        return this.isAbsoluteLinkFormat(file) && file.path !== file.name;
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
        const normalized = path.replace(/\\/g, '/');
        const isAbsolute = normalized.startsWith('/');
        const hasDrivePrefix = /^[A-Za-z]:\//.test(normalized);
        const parts = normalized.split('/').filter((part) => part.length > 0 && part !== '.');
        const resolved: string[] = [];

        for (const part of parts) {
            if (part === '..') {
                resolved.pop();
                continue;
            }
            resolved.push(part);
        }

        const joined = resolved.join('/');
        if (hasDrivePrefix) {
            return joined;
        }
        if (isAbsolute) {
            return `/${joined}`;
        }
        return joined;
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
        const wikiLinkRegex = /!\[\[([^\]]+)\]\]/g;

        return markdown.replace(wikiLinkRegex, (match: string, wikiLink: string) => {
            const [rawLinkPath, rawDisplayText] = wikiLink.split('|', 2);
            const linkPath = rawLinkPath.trim();
            const displayText = rawDisplayText?.trim();

            if (!this.isImageLinkPath(linkPath)) {
                return match;
            }

            const linkedFile = app.metadataCache.getFirstLinkpathDest(linkPath, sourceFile.path);
            const imagePath = linkedFile
                ? this.getMarkdownImagePath(sourceFile, linkedFile)
                : linkPath;
            const altText = this.getMarpImageAltText(linkPath, displayText);

            return `![${this.escapeMarkdownAltText(altText)}](${this.encodeMarkdownLinkDestination(imagePath)})`;
        });
    }

    private isImageLinkPath(linkPath: string): boolean {
        return /\.(png|jpg|jpeg|gif|svg|webp|bmp)(?:[?#].*)?$/i.test(linkPath);
    }

    private getMarkdownImagePath(sourceFile: TFile, linkedFile: TFile): string {
        if (this.isAbsoluteLinkFormat(sourceFile)) {
            return linkedFile.path;
        }

        return this.getRelativePathFromFile(sourceFile, linkedFile);
    }

    private getMarpImageAltText(linkPath: string, displayText: string | undefined): string {
        if (!displayText) {
            return linkPath;
        }

        const dimensionMatch = displayText.match(/^(?:(\d+)(?:px)?)?(?:x(?:(\d+)(?:px)?))?$/i);
        if (!dimensionMatch || (!dimensionMatch[1] && !dimensionMatch[2])) {
            return displayText;
        }

        return [
            dimensionMatch[1] ? `w:${dimensionMatch[1]}` : null,
            dimensionMatch[2] ? `h:${dimensionMatch[2]}` : null,
        ].filter(Boolean).join(' ');
    }

    private escapeMarkdownAltText(altText: string): string {
        return altText.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
    }

    private encodeMarkdownLinkDestination(path: string): string {
        return path
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/');
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
        const relativeParts = [
            ...Array.from({ length: upCount }, () => '..'),
            ...targetParts.slice(commonLength),
        ];

        return relativeParts.join('/');
    }
}
