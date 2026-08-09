#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');
const packagePath = join(repoRoot, 'package.json');
const releasePleaseManifestPath = join(repoRoot, '.release-please-manifest.json');
const allowedBranches = new Set(['next', 'beta']);
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const betaVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta\.(0|[1-9]\d*)$/;

function parseArgs(argv) {
	let base;
	for (let index = 2; index < argv.length; index += 1) {
		if (argv[index] !== '--base') throw new Error(`Unknown argument: ${argv[index]}`);
		base = argv[index + 1];
		if (!base) throw new Error('Missing value for --base');
		index += 1;
	}
	return { base };
}

function assertAllowedBranch(branch) {
	if (!allowedBranches.has(branch)) {
		throw new Error(`prepare-beta-release must run on next or beta, not "${branch}".`);
	}
}

function assertStableVersion(version) {
	const match = stableVersionPattern.exec(version);
	if (!match) throw new Error(`Invalid stable semver version: ${version}`);
	return match.slice(1).map(Number);
}

function resolveNextBetaVersion(base, currentVersion, stableVersion) {
	const currentBeta = betaVersionPattern.exec(currentVersion);
	if (currentBeta) {
		return `${currentBeta[1]}.${currentBeta[2]}.${currentBeta[3]}-beta.${Number(currentBeta[4]) + 1}`;
	}

	if (base) {
		assertStableVersion(base);
		return `${base}-beta.0`;
	}

	const [major, minor] = assertStableVersion(stableVersion);
	return `${major}.${minor + 1}.0-beta.0`;
}

function prepareBetaVersion({ base, branch, currentVersion, stableVersion }) {
	assertAllowedBranch(branch);
	return resolveNextBetaVersion(base, currentVersion, stableVersion);
}

function main() {
	const { base } = parseArgs(process.argv);
	const branch = execFileSync('git', ['branch', '--show-current'], {
		cwd: repoRoot,
		encoding: 'utf8',
	}).trim();
	const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
	const releasePleaseManifest = JSON.parse(readFileSync(releasePleaseManifestPath, 'utf8'));
	const nextVersion = prepareBetaVersion({
		base,
		branch,
		currentVersion: packageJson.version,
		stableVersion: releasePleaseManifest['.'],
	});

	packageJson.version = nextVersion;
	writeFileSync(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`);

	console.log(`Prepared beta version ${nextVersion} in package.json`);
	console.log('Stable manifest.json and versions.json were not changed.');
	console.log('');
	console.log('Next steps:');
	console.log('  git add package.json');
	console.log(`  git commit -m "chore(release): prepare ${nextVersion}"`);
	console.log(`  git tag -a ${nextVersion} -m "${nextVersion}"`);
	console.log(`  git push origin ${branch} && git push origin ${nextVersion}`);
}

if (require.main === module) main();

module.exports = {
	assertAllowedBranch,
	parseArgs,
	prepareBetaVersion,
	resolveNextBetaVersion,
};
