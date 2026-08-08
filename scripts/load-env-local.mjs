import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load flat KEY=VALUE pairs from `.env.local` into `process.env` without
 * overwriting existing environment variables. Supports quoted values so vault
 * paths with spaces work.
 *
 * @param {string} [cwd=process.cwd()]
 * @returns {Record<string, string>} values applied from the file
 */
export function loadEnvLocal(cwd = process.cwd()) {
	const envPath = resolve(cwd, '.env.local');
	const applied = {};
	if (!existsSync(envPath)) {
		return applied;
	}

	const envContent = readFileSync(envPath, 'utf-8');
	for (const rawLine of envContent.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const separator = line.indexOf('=');
		if (separator <= 0) {
			continue;
		}

		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"'))
			|| (value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (!key) {
			continue;
		}

		if (process.env[key] == null || process.env[key] === '') {
			process.env[key] = value;
			applied[key] = value;
		}
	}

	return applied;
}
