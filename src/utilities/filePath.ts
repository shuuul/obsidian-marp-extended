import { Vault, normalizePath, FileSystemAdapter, TFile, App } from 'obsidian';
import { MarpExtendedSettings } from './settings';
import { DEFAULT_THEME_DIRECTORY } from './defaultThemes';

interface VaultWithLinkConfig {
	getConfig(key: 'newLinkFormat'): string;
}

type DesktopFileSystemAdapter = FileSystemAdapter & {
	getFullPath?: (normalizedPath: string) => string;
	getFilePath?: (normalizedPath: string) => string;
};

export class FilePath  {

    private settings : MarpExtendedSettings;

    constructor(settings: MarpExtendedSettings) {
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

    /**
     * True only when absolute Obsidian wiki-link mode requires a temporary root export source.
     */
    public shouldUseRootExportSource(file: TFile): boolean {
        return this.isAbsoluteLinkFormat(file) && file.path !== file.name;
    }

    private getDesktopFileSystemAdapter(vault: Vault): DesktopFileSystemAdapter {
        const adapter = vault.adapter as DesktopFileSystemAdapter;
        if (typeof adapter.getBasePath !== 'function') {
            throw new Error('Marp Extended requires Obsidian desktop file system access for export paths.');
        }

        return adapter;
    }

    public static resolveVaultFileSystemPath(vault: Vault, normalizedPath: string): string {
        const adapter = vault.adapter as DesktopFileSystemAdapter;
        if (typeof adapter.getBasePath !== 'function') {
            throw new Error('Marp Extended requires Obsidian desktop file system access for export paths.');
        }
        const path = normalizePath(normalizedPath);

        if (adapter.getFullPath) {
            return FilePath.normalizeFileSystemPath(adapter.getFullPath(path));
        }

        if (adapter.getFilePath) {
            return FilePath.normalizeFileSystemPath(adapter.getFilePath(path));
        }

        return FilePath.normalizeFileSystemPath(`${adapter.getBasePath()}/${path}`);
    }

    private getVaultFileSystemPath(vault: Vault, normalizedPath: string): string {
        return FilePath.resolveVaultFileSystemPath(vault, normalizedPath);
    }

    private static normalizeFileSystemPath(path: string): string {
        const cleanPath = path.split('?')[0];

        if (/^app:\/\//i.test(cleanPath)) {
            const match = cleanPath.match(/^app:\/\/[^/]+\/(.*)$/i);
            if (match) {
                const decoded = decodeURIComponent(match[1]);
                if (decoded.startsWith('/') || /^[A-Za-z]:\//.test(decoded)) {
                    return FilePath.normalizeFilePathSeparators(decoded);
                }
                return FilePath.normalizeFilePathSeparators(`/${decoded}`);
            }
        }

        if (/^file:\/\//i.test(cleanPath)) {
            const url = new URL(cleanPath);
            const decoded = decodeURIComponent(url.pathname);
            if (/^\/[A-Za-z]:\//.test(decoded)) {
                return FilePath.normalizeFilePathSeparators(decoded.slice(1));
            }
            return FilePath.normalizeFilePathSeparators(decoded);
        }

        return FilePath.normalizeFilePathSeparators(cleanPath);
    }

    private static normalizeFilePathSeparators(path: string): string {
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

    /**
     * Returns an Obsidian app:// resource URL for iframe <base href>. Do not pass this to Node APIs or Marp CLI.
     */
	public getPreviewBaseUrl(file: TFile): string{
        let resourcePath = [""];
        if(this.isAbsoluteLinkFormat(file)){
            resourcePath = file.vault.adapter.getResourcePath(normalizePath("/")).split("?");
        }
        else
        {
            if (file.parent != null){
                resourcePath = file.vault.adapter.getResourcePath(normalizePath(file.parent.path)).split("?");
            }
        }
        return `${resourcePath[0]}/`;
	}

    /**
     * Returns a normalized desktop filesystem path for Marp CLI.
     */
    public getExportFileSystemPath(file: TFile) : string{

        let basePath = this.getVaultFileSystemPath(file.vault, file.path);
        if(this.isAbsoluteLinkFormat(file)){
            basePath = this.getVaultFileSystemPath(file.vault, file.name);
        }
        return basePath;
	}

    /**
     * Copies the source file to the vault root only when absolute link mode requires the legacy root export source.
     */
    public async copyFileToRoot(file: TFile) {
        if(this.isAbsoluteLinkFormat(file)){
            await file.vault.adapter.copy(file.path, file.name);
        }
    }

    /**
     * Removes the temporary root source only when absolute link mode requires the legacy root export source.
     */
    public async removeFileFromRoot(file: TFile) {
        const isFileExists = await file.vault.adapter.exists(file.name);
        if(this.isAbsoluteLinkFormat(file) && isFileExists){
            await file.vault.adapter.remove(file.name);
        }
    }

    /**
     * Returns the managed default theme desktop filesystem path for Marp CLI --theme-set.
     */
    public getDefaultThemePath(file: TFile): string{
        return this.getVaultFileSystemPath(file.vault, DEFAULT_THEME_DIRECTORY);
    }

    /**
     * Returns desktop filesystem paths for Marp CLI --theme-set.
     */
    public getThemePaths(file: TFile): string[]{
        return [this.getDefaultThemePath(file)];
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
