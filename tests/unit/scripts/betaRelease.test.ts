import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const nodeRequire = createRequire(join(process.cwd(), 'package.json'));
const {
	assertAllowedBranch,
	parseArgs,
	prepareBetaVersion,
	resolveNextBetaVersion,
} = nodeRequire('./scripts/prepare-beta-release.cjs');
const {
	buildReleaseManifest,
	buildStableVersionMetadata,
	isPrereleaseVersion,
} = nodeRequire('./scripts/versionMetadata.cjs');
const { parseConventionalCommit, renderBetaReleaseNotes } = nodeRequire('./scripts/generate-beta-release-notes.cjs');

describe('beta release preparation', () => {
	test('only allows dedicated beta branches', () => {
		expect(() => assertAllowedBranch('main')).toThrow('must run on next or beta');
		expect(() => assertAllowedBranch('next')).not.toThrow();
		expect(() => assertAllowedBranch('beta')).not.toThrow();
	});

	test('starts a preminor beta from stable metadata and increments existing betas', () => {
		expect(prepareBetaVersion({
			branch: 'next',
			currentVersion: '0.9.0',
			stableVersion: '0.9.0',
		})).toBe('0.10.0-beta.0');
		expect(resolveNextBetaVersion(undefined, '0.10.0-beta.0', '0.9.0')).toBe('0.10.0-beta.1');
	});

	test('supports an explicit stable base version', () => {
		expect(prepareBetaVersion({
			base: '1.0.0',
			branch: 'beta',
			currentVersion: '0.9.0',
			stableVersion: '0.9.0',
		})).toBe('1.0.0-beta.0');
		expect(parseArgs(['node', 'script', '--base', '1.0.0'])).toEqual({ base: '1.0.0' });
	});
});

describe('beta release assets and notes', () => {
	test('rewrites only the release manifest version', () => {
		expect(buildReleaseManifest({
			manifestJson: { id: 'marp-extended', version: '0.9.0' },
			packageVersion: '0.10.0-beta.0',
		})).toEqual({
			id: 'marp-extended',
			version: '0.10.0-beta.0',
		});
	});

	test('keeps stable and prerelease version metadata paths separate', () => {
		expect(isPrereleaseVersion('0.10.0-beta.0')).toBe(true);
		expect(isPrereleaseVersion('0.10.0')).toBe(false);
		expect(buildStableVersionMetadata({
			packageJson: { version: '0.10.0' },
			manifestJson: { version: '0.9.0', minAppVersion: '1.8.3' },
			versionsJson: { '0.9.0': '1.8.3' },
		})).toEqual({
			manifestJson: { version: '0.10.0', minAppVersion: '1.8.3' },
			versionsJson: { '0.9.0': '1.8.3', '0.10.0': '1.8.3' },
		});
	});

	test('omits release preparation commits and marks breaking changes', () => {
		expect(parseConventionalCommit('a'.repeat(40), 'chore(release): prepare 0.10.0-beta.0')).toBeUndefined();
		const notes = renderBetaReleaseNotes({
			fromTag: '0.9.0',
			toTag: '0.10.0-beta.0',
			repository: 'shuuul/obsidian-marp-extended',
			commits: [{ hash: 'b'.repeat(40), subject: 'feat(language)!: canonical syntax' }],
		});
		expect(notes).toContain('## Features');
		expect(notes).toContain('**BREAKING:** **language:** canonical syntax');
		expect(notes).toContain('compare/0.9.0...0.10.0-beta.0');
	});
});

describe('Pivi-style release workflows', () => {
	const workflow = readFileSync(join(process.cwd(), '.github', 'workflows', 'release.yml'), 'utf8');
	const releasePleaseWorkflow = readFileSync(
		join(process.cwd(), '.github', 'workflows', 'release-please.yml'),
		'utf8',
	);
	const verifyWorkflow = readFileSync(join(process.cwd(), '.github', 'workflows', 'verify.yml'), 'utf8');
	const qualityGates = readFileSync(
		join(process.cwd(), '.github', 'actions', 'quality-gates', 'action.yml'),
		'utf8',
	);
	const releasePleaseConfig = readFileSync(join(process.cwd(), 'release-please-config.json'), 'utf8');

	test('publishes stable and prerelease builds only from annotated tag pushes', () => {
		expect(workflow).toMatch(/push:\s*\n\s+tags:/);
		expect(workflow).toContain('- "*"');
		expect(workflow).not.toContain('workflow_dispatch:');
		expect(workflow).toContain('--prerelease');
		expect(workflow).toContain('package.json version ($package_version) does not match tag ($tag)');
		expect(workflow).toContain('Release tag $tag must be an annotated tag.');
		expect(workflow).toContain('must point to a commit pushed to next or beta');
	});

	test('keeps Release Please separate from tag publication', () => {
		expect(releasePleaseWorkflow).toContain('skip-github-release: true');
		expect(releasePleaseWorkflow).toContain("!startsWith(github.event.head_commit.message, 'chore(release):')");
		expect(releasePleaseWorkflow).not.toContain('gh release create');
		expect(releasePleaseConfig).toContain('"bump-minor-pre-major": true');
		expect(releasePleaseConfig).toContain('"bump-patch-for-minor-pre-major": false');
	});

	test('uses the same mandatory quality gates in CI and release', () => {
		for (const command of [
			'npm run typecheck',
			'npm run lint',
			'npm run check:specs',
			'npm test -- --runInBand',
			'npm run build',
		]) {
			expect(qualityGates).toContain(command);
		}
		expect(verifyWorkflow).toContain('uses: ./.github/actions/quality-gates');
		expect(workflow).toContain('uses: ./.github/actions/quality-gates');
	});

	test('generates a release manifest and publishes every required asset idempotently', () => {
		expect(workflow).toContain('node scripts/write-release-manifest.cjs');
		expect(workflow).toContain('node scripts/generate-beta-release-notes.cjs');
		for (const asset of ['main.js', 'manifest.json', 'styles.css', 'marp-engine.cjs']) {
			expect(workflow).toContain(asset);
		}
		expect(workflow).toContain('marp-extended-${RELEASE_TAG_RESOLVED}.zip');
		expect(workflow).toContain('gh release edit "$RELEASE_TAG_RESOLVED"');
		expect(workflow).toContain('--clobber');
		expect(workflow).toContain('cmp --silent "$file" "$download_dir/$file"');
	});

	test('pins third-party actions and follows Pivi reviewer-compatible publication', () => {
		const pinPattern = /uses:\s+(actions\/checkout|actions\/setup-node|googleapis\/release-please-action)@[0-9a-f]{40}/g;
		expect(workflow.match(pinPattern)?.length).toBeGreaterThanOrEqual(2);
		expect(releasePleaseWorkflow.match(pinPattern)?.length).toBeGreaterThanOrEqual(3);
		expect(workflow).not.toContain('actions/attest');
		expect(workflow).not.toContain('attestations: write');
	});
});
