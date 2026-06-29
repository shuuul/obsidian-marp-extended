import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAIN_JS_MAX_BYTES = 5 * 1024 * 1024;
const ROOT_RELEASE_ASSETS = new Set(['main.js', 'manifest.json', 'styles.css']);
const TEXT_EXTENSIONS_TO_SCAN = new Set(['.css', '.js', '.json', '.md', '.ts', '.tsx', '.mjs', '.cjs']);

const bundleRules = [
	{ name: 'hex-encoded variable name', pattern: /\b_0x[0-9a-fA-F]+\b/ },
	{ name: 'eval() call', pattern: /\beval\s*\(/ },
	{ name: 'new Function() call', pattern: /\bnew\s+Function\s*\(/ },
	{ name: 'setTimeout string argument', pattern: /\bsetTimeout\s*\(\s*['"`]/ },
	{ name: 'setInterval string argument', pattern: /\bsetInterval\s*\(\s*['"`]/ },
	{ name: 'dynamic script element creation', pattern: /\.createElement\s*\(\s*['"]script['"]\s*\)/ },
	{ name: 'bundled browser automation dependency', pattern: /\b(?:puppeteer|chromium-bidi)\b/ },
];

const remoteCssRules = [
	{ name: 'remote CSS import', pattern: /@import\s+url\s*\(\s*['"]?https?:\/\// },
	{ name: 'remote CSS resource URL', pattern: /url\s*\(\s*['"]?https?:\/\// },
];

function fail(message) {
	console.error(message);
	process.exitCode = 1;
}

function readText(path) {
	return readFileSync(path, 'utf-8');
}

function assertRequiredAssets() {
	for (const asset of ROOT_RELEASE_ASSETS) {
		if (!existsSync(asset)) {
			fail(`Missing required release asset: ${asset}`);
		}
	}

	for (const name of readdirSync('.')) {
		if (name.endsWith('.zip')) {
			fail(`Unsupported ZIP release asset found: ${name}`);
		}
	}
}

function assertBundle() {
	if (!existsSync('main.js')) {
		return;
	}

	const bytes = statSync('main.js').size;
	console.log(`main.js bytes: ${bytes}`);
	if (bytes > MAIN_JS_MAX_BYTES) {
		console.warn(`Warning: main.js is larger than ${MAIN_JS_MAX_BYTES} bytes.`);
	}

	const mainJs = readText('main.js');
	for (const rule of bundleRules) {
		if (rule.pattern.test(mainJs)) {
			fail(`Blocked release bundle pattern: ${rule.name}`);
		}
	}
}

function* walk(directory) {
	if (!existsSync(directory)) {
		return;
	}

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			yield* walk(path);
		} else {
			yield path;
		}
	}
}

function assertNoRemoteCss() {
	const paths = [
		...walk('vault/themes'),
		...walk('vault/mermaid-themes'),
		'src/utilities/packagedDefaultThemeCss.ts',
	];

	for (const path of paths) {
		if (!existsSync(path)) {
			continue;
		}
		if (!TEXT_EXTENSIONS_TO_SCAN.has(path.slice(path.lastIndexOf('.')))) {
			continue;
		}

		const text = readText(path);
		const lines = text.split('\n');
		for (const rule of remoteCssRules) {
			for (const [index, line] of lines.entries()) {
				if (rule.pattern.test(line)) {
					fail(`${path}:${index + 1}: ${rule.name}`);
				}
			}
		}
	}
}

assertRequiredAssets();
assertBundle();
assertNoRemoteCss();

if (process.exitCode) {
	process.exit(process.exitCode);
}
