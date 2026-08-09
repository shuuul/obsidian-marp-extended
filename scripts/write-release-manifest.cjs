#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { buildReleaseManifest } = require('./versionMetadata.cjs');

const repoRoot = join(__dirname, '..');

function main() {
	const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
	const manifestPath = join(repoRoot, 'manifest.json');
	const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const releaseManifest = buildReleaseManifest({
		manifestJson,
		packageVersion: packageJson.version,
	});
	writeFileSync(manifestPath, `${JSON.stringify(releaseManifest, null, '\t')}\n`);
	console.log(`Prepared release manifest.json at ${packageJson.version}`);
}

if (require.main === module) main();
