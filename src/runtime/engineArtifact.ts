import type { App } from 'obsidian';
import type * as NodeFs from 'node:fs';
import type * as NodePath from 'node:path';
import type * as NodeZlib from 'node:zlib';
import type * as NodeCrypto from 'node:crypto';
import { brotliBase64, sha256 as embeddedSha256 } from 'marp-extended:embedded-engine';
import { FilePath } from '../utilities/filePath';

export type EngineArtifactPayload = { brotliBase64: string; sha256: string };
export type EngineArtifactDependencies = {
	fs: typeof NodeFs; path: typeof NodePath; zlib: typeof NodeZlib; crypto: typeof NodeCrypto;
};

function nodeDependencies(): EngineArtifactDependencies {
	/* eslint-disable @typescript-eslint/no-require-imports -- Obsidian desktop exposes Node built-ins through CommonJS. */
	const dependencies = {
		fs: require('node:fs') as typeof NodeFs,
		path: require('node:path') as typeof NodePath,
		zlib: require('node:zlib') as typeof NodeZlib,
		crypto: require('node:crypto') as typeof NodeCrypto,
	};
	/* eslint-enable @typescript-eslint/no-require-imports -- Keep the exception scoped to desktop built-ins. */
	return dependencies;
}

function hash(bytes: Buffer, crypto: typeof NodeCrypto): string {
	return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function ensureEngineArtifact(
	app: App,
	pluginDir: string | undefined,
	payload: EngineArtifactPayload = { brotliBase64, sha256: embeddedSha256 },
	dependencies: EngineArtifactDependencies = nodeDependencies(),
): Promise<string> {
	if (!pluginDir) throw new Error('Marp Extended cannot locate its installed plugin directory (manifest.dir is unavailable).');
	const { fs, path, zlib, crypto } = dependencies;
	const directory = FilePath.resolveVaultFileSystemPath(app.vault, pluginDir);
	const releaseTarget = path.resolve(directory, 'marp-engine.cjs');
	let bytes: Buffer;
	try { bytes = zlib.brotliDecompressSync(Buffer.from(payload.brotliBase64, 'base64')); }
	catch (error) { throw new Error(`Embedded Marp engine could not be decoded: ${String(error)}`); }
	if (hash(bytes, crypto) !== payload.sha256) throw new Error('Embedded Marp engine failed its SHA-256 integrity check.');
	try {
		if (fs.existsSync(releaseTarget) && hash(fs.readFileSync(releaseTarget), crypto) === payload.sha256) return releaseTarget;
		fs.mkdirSync(directory, { recursive: true });
		const nonce = () => crypto.randomBytes(8).toString('hex');
		const contentTarget = path.resolve(directory, `marp-engine-${payload.sha256}.cjs`);
		let target = contentTarget;
		if (fs.existsSync(target)) {
			if (hash(fs.readFileSync(target), crypto) === payload.sha256) return target;
			try { fs.unlinkSync(target); }
			catch { target = path.resolve(directory, `marp-engine-${payload.sha256}-${nonce()}.cjs`); }
		}
		const temporary = `${target}.tmp-${process.pid}-${nonce()}`;
		try {
			fs.writeFileSync(temporary, bytes, { flag: 'wx' });
			try { fs.renameSync(temporary, target); }
			catch (error) {
				if (!fs.existsSync(target) || hash(fs.readFileSync(target), crypto) !== payload.sha256) throw error;
			}
		}
		finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
		if (hash(fs.readFileSync(target), crypto) !== payload.sha256) throw new Error('materialized file hash does not match');
		return target;
	} catch (error) {
		throw new Error(`Unable to install marp-engine.cjs in ${directory}: ${String(error)}`);
	}
}
