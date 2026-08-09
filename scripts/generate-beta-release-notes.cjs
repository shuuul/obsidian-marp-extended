#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const sectionTitles = {
	feat: 'Features',
	fix: 'Bug Fixes',
	perf: 'Performance Improvements',
	deps: 'Dependencies',
	other: 'Other Changes',
};

function parseConventionalCommit(hash, subject) {
	const match = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/.exec(subject);
	if (!match || (match[1] === 'chore' && match[2] === 'release')) return undefined;

	const [, type, scope, breaking, summary] = match;
	const section = type === 'feat'
		? 'feat'
		: type === 'fix'
			? 'fix'
			: type === 'perf'
				? 'perf'
				: type === 'chore' && (scope === 'deps' || scope === 'deps-dev')
					? 'deps'
					: 'other';
	return { hash, scope, breaking: Boolean(breaking), summary, section };
}

function renderBetaReleaseNotes({ fromTag, toTag, repository, commits }) {
	const parsed = commits
		.map(({ hash, subject }) => parseConventionalCommit(hash, subject))
		.filter(Boolean);
	const lines = [];

	for (const section of ['feat', 'fix', 'perf', 'deps', 'other']) {
		const entries = parsed.filter((commit) => commit.section === section);
		if (entries.length === 0) continue;
		lines.push(`## ${sectionTitles[section]}`, '');
		for (const commit of entries) {
			const scope = commit.scope ? `**${commit.scope}:** ` : '';
			const breaking = commit.breaking ? '**BREAKING:** ' : '';
			const shortHash = commit.hash.slice(0, 7);
			lines.push(`- ${breaking}${scope}${commit.summary} ([${shortHash}](https://github.com/${repository}/commit/${commit.hash}))`);
		}
		lines.push('');
	}

	lines.push(`**Full Changelog**: https://github.com/${repository}/compare/${fromTag}...${toTag}`);
	return `${lines.join('\n')}\n`;
}

function readCommits(fromTag, toTag) {
	const output = execFileSync(
		'git',
		['log', `${fromTag}..${toTag}`, '--no-merges', '--pretty=format:%H%x09%s'],
		{ encoding: 'utf8' },
	).trim();
	if (!output) return [];
	return output.split('\n').map((line) => {
		const separator = line.indexOf('\t');
		return { hash: line.slice(0, separator), subject: line.slice(separator + 1) };
	});
}

function main() {
	const [, , fromTag, toTag, repository] = process.argv;
	if (!fromTag || !toTag || !repository) {
		throw new Error('Usage: generate-beta-release-notes.cjs <from-tag> <to-tag> <owner/repo>');
	}
	process.stdout.write(renderBetaReleaseNotes({
		fromTag,
		toTag,
		repository,
		commits: readCommits(fromTag, toTag),
	}));
}

if (require.main === module) main();

module.exports = { parseConventionalCommit, readCommits, renderBetaReleaseNotes };
