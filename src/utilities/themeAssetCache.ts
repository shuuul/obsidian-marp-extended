import { App, normalizePath, requestUrl } from 'obsidian';

export const THEME_ASSET_CACHE_DIRECTORY = '.marp-extended/cache/theme-assets';

const CSS_IMPORT_REGEX = /@import\s+(?:url\(\s*(?:(['"])(.*?)\1|([^)'"\s]+))\s*\)|(?:(['"])(.*?)\4))([^;]*);/gi;
const CSS_URL_REGEX = /url\(\s*(?:(['"])(.*?)\1|([^)'"\s]+))\s*\)/gi;
const THEME_ASSET_USER_AGENT = 'marp-extended-obsidian-plugin';

interface RewriteFailures {
	count: number;
}

function joinVaultPath(...parts: string[]): string {
	return normalizePath(parts.filter(Boolean).join('/'));
}

function hashUrl(url: string): string {
	let hash = 2166136261;
	for (let index = 0; index < url.length; index++) {
		hash ^= url.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return `${(hash >>> 0).toString(36)}-${url.length.toString(36)}`;
}

function getExtensionFromUrl(url: string): string | null {
	try {
		const { pathname } = new URL(url);
		const match = pathname.match(/\.([a-z0-9]{1,12})$/i);
		return match ? match[1].toLowerCase() : null;
	} catch {
		return null;
	}
}

function escapeCssString(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/[\r\n\f]/g, '');
}

function isImportUrl(css: string, urlIndex: number): boolean {
	return /@import\s*$/i.test(css.slice(Math.max(0, urlIndex - 64), urlIndex));
}

async function replaceAsync(
	input: string,
	regex: RegExp,
	replacer: (match: RegExpExecArray) => Promise<string>,
): Promise<string> {
	const localRegex = new RegExp(regex.source, regex.flags);
	let result = '';
	let lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = localRegex.exec(input)) !== null) {
		result += input.slice(lastIndex, match.index);
		result += await replacer(match);
		lastIndex = localRegex.lastIndex;

		if (match[0].length === 0) {
			localRegex.lastIndex++;
		}
	}

	return result + input.slice(lastIndex);
}

export class ThemeAssetCache {
	private resourceUrls = new Map<string, string>();

	constructor(private app: App) {}

	async rewriteRemoteAssets(css: string): Promise<string> {
		return this.rewriteCss(css);
	}

	private async rewriteCss(
		css: string,
		baseUrl?: string,
		activeCssUrls = new Set<string>(),
		failures?: RewriteFailures,
	): Promise<string> {
		const withCachedImports = await replaceAsync(css, CSS_IMPORT_REGEX, async (match) => {
			const rawUrl = match[2] || match[3] || match[5] || '';
			const resolvedUrl = this.resolveRemoteUrl(rawUrl, baseUrl);
			if (!resolvedUrl) {
				return match[0];
			}

			try {
				const resourceUrl = await this.cacheCss(resolvedUrl, activeCssUrls);
				return `@import url("${escapeCssString(resourceUrl)}")${match[6] || ''};`;
			} catch (error) {
				if (failures) {
					failures.count++;
				}
				console.warn(`Marp Extended: failed to cache theme CSS import ${resolvedUrl}`, error);
				return match[0];
			}
		});

		return replaceAsync(withCachedImports, CSS_URL_REGEX, async (match) => {
			if (isImportUrl(withCachedImports, match.index)) {
				return match[0];
			}

			const rawUrl = match[2] || match[3] || '';
			const resolvedUrl = this.resolveRemoteUrl(rawUrl, baseUrl);
			if (!resolvedUrl) {
				return match[0];
			}

			try {
				const resourceUrl = await this.cacheBinary(resolvedUrl);
				return `url("${escapeCssString(resourceUrl)}")`;
			} catch (error) {
				if (failures) {
					failures.count++;
				}
				console.warn(`Marp Extended: failed to cache theme asset ${resolvedUrl}`, error);
				return match[0];
			}
		});
	}

	private resolveRemoteUrl(rawUrl: string, baseUrl?: string): string | null {
		const trimmedUrl = rawUrl.trim();
		if (!trimmedUrl || /^[#?]/.test(trimmedUrl) || /^(data|blob|app|file):/i.test(trimmedUrl)) {
			return null;
		}

		try {
			const url = trimmedUrl.startsWith('//')
				? new URL(`https:${trimmedUrl}`)
				: baseUrl
					? new URL(trimmedUrl, baseUrl)
					: new URL(trimmedUrl);

			return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
		} catch {
			return null;
		}
	}

	private async cacheCss(url: string, activeCssUrls: Set<string>): Promise<string> {
		const cachedResourceUrl = this.resourceUrls.get(url);
		if (cachedResourceUrl) {
			return cachedResourceUrl;
		}

		const path = this.getCachePath(url, 'css');
		if (await this.app.vault.adapter.exists(path)) {
			return this.rememberResourceUrl(url, path);
		}

		if (activeCssUrls.has(url)) {
			return url;
		}

		activeCssUrls.add(url);
		try {
			const response = await requestUrl({
				url,
				throw: false,
				headers: {
					Accept: 'text/css,*/*',
					'User-Agent': THEME_ASSET_USER_AGENT,
				},
			});

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`HTTP ${response.status}`);
			}

			const failures = { count: 0 };
			const rewrittenCss = await this.rewriteCss(response.text, url, activeCssUrls, failures);
			if (failures.count > 0) {
				throw new Error('Nested CSS assets could not be cached');
			}

			await this.ensureVaultFolder(THEME_ASSET_CACHE_DIRECTORY);
			await this.app.vault.adapter.write(path, rewrittenCss.endsWith('\n') ? rewrittenCss : `${rewrittenCss}\n`);
			return this.rememberResourceUrl(url, path);
		} finally {
			activeCssUrls.delete(url);
		}
	}

	private async cacheBinary(url: string): Promise<string> {
		const cachedResourceUrl = this.resourceUrls.get(url);
		if (cachedResourceUrl) {
			return cachedResourceUrl;
		}

		const path = this.getCachePath(url, getExtensionFromUrl(url) ?? 'bin');
		if (await this.app.vault.adapter.exists(path)) {
			return this.rememberResourceUrl(url, path);
		}

		if (typeof this.app.vault.adapter.writeBinary !== 'function') {
			throw new Error('Vault adapter does not support binary writes');
		}

		const response = await requestUrl({
			url,
			throw: false,
			headers: {
				Accept: '*/*',
				'User-Agent': THEME_ASSET_USER_AGENT,
			},
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`HTTP ${response.status}`);
		}

		await this.ensureVaultFolder(THEME_ASSET_CACHE_DIRECTORY);
		await this.app.vault.adapter.writeBinary(path, response.arrayBuffer);
		return this.rememberResourceUrl(url, path);
	}

	private getCachePath(url: string, extension: string): string {
		const normalizedExtension = extension.replace(/^\./, '').toLowerCase() || 'bin';
		return joinVaultPath(THEME_ASSET_CACHE_DIRECTORY, `${hashUrl(url)}.${normalizedExtension}`);
	}

	private rememberResourceUrl(url: string, path: string): string {
		const resourceUrl = this.app.vault.adapter.getResourcePath(normalizePath(path));
		this.resourceUrls.set(url, resourceUrl);
		return resourceUrl;
	}

	private async ensureVaultFolder(directory: string): Promise<void> {
		const parts = normalizePath(directory).split('/').filter(Boolean);
		let current = '';

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!await this.app.vault.adapter.exists(current)) {
				await this.app.vault.adapter.mkdir(current);
			}
		}
	}
}