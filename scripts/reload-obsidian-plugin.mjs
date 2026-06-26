#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const OBSIDIAN_CLI = process.env.OBSIDIAN_CLI ?? 'obsidian';
const PLUGIN_ID = 'marp-extended';

function runObsidian(args, { quiet = false } = {}) {
	const result = spawnSync(OBSIDIAN_CLI, args, {
		encoding: 'utf-8',
	});
	const output = [result.stdout, result.stderr]
		.filter(Boolean)
		.join('')
		.trim();

	if (!quiet && output) {
		console.log(output);
	}

	return {
		ok: result.status === 0,
		output,
		error: result.error,
	};
}

function fail(message) {
	console.error(message);
	process.exit(1);
}

function isAlreadyEnabled(output) {
	return /already enabled/i.test(output);
}

function isCommandUnavailable(output) {
	return /command "plugin:reload" not found/i.test(output)
		|| /command "plugin:enable" not found/i.test(output)
		|| /unknown command/i.test(output);
}

const pluginInfo = runObsidian(['plugin', `id=${PLUGIN_ID}`, 'filter=community'], { quiet: true });
if (pluginInfo.error) {
	fail(`Unable to run ${OBSIDIAN_CLI}: ${pluginInfo.error.message}`);
}

if (pluginInfo.ok && !/enabled\s+true/.test(pluginInfo.output)) {
	const enablePlugin = runObsidian(['plugin:enable', `id=${PLUGIN_ID}`, 'filter=community']);
	if (enablePlugin.error) {
		fail(`Unable to run ${OBSIDIAN_CLI}: ${enablePlugin.error.message}`);
	}
	if (!enablePlugin.ok && !isAlreadyEnabled(enablePlugin.output)) {
		fail(`Obsidian plugin enable failed for ${PLUGIN_ID}.`);
	}
}

const pluginReload = runObsidian(['plugin:reload', `id=${PLUGIN_ID}`]);
if (pluginReload.error) {
	fail(`Unable to run ${OBSIDIAN_CLI}: ${pluginReload.error.message}`);
}

if (!pluginReload.ok) {
	if (!isCommandUnavailable(pluginReload.output)) {
		fail(`Obsidian plugin reload failed for ${PLUGIN_ID}.`);
	}

	console.log('plugin:reload is unavailable; falling back to full vault reload.');
	const vaultReload = runObsidian(['reload']);
	if (vaultReload.error) {
		fail(`Unable to run ${OBSIDIAN_CLI}: ${vaultReload.error.message}`);
	}
	if (!vaultReload.ok) {
		fail('Obsidian vault reload failed.');
	}
}

const devErrors = runObsidian(['dev:errors']);
if (devErrors.error) {
	fail(`Unable to run ${OBSIDIAN_CLI}: ${devErrors.error.message}`);
}
if (!devErrors.ok) {
	fail('Unable to read Obsidian dev errors after reload.');
}
