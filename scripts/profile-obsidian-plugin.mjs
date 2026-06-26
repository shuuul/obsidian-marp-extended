#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';

const OBSIDIAN_CLI = process.env.OBSIDIAN_CLI ?? 'obsidian';
const DEFAULT_COMMAND = 'marp-extended:preview';
const DEFAULT_PATH = 'slides/examples/Kami Agent Slides.md';
const PROFILE_STORAGE_KEY = 'marp-extended-profile';

function parseArgs(argv) {
	const args = new Map();
	for (const arg of argv) {
		const separatorIndex = arg.indexOf('=');
		if (separatorIndex === -1) {
			args.set(arg, 'true');
			continue;
		}

		args.set(arg.slice(0, separatorIndex), arg.slice(separatorIndex + 1));
	}
	return args;
}

function runObsidian(args, { quiet = false, allowFailure = false, timeoutMs = 30000 } = {}) {
	const result = spawnSync(OBSIDIAN_CLI, args, { encoding: 'utf-8', timeout: timeoutMs });
	const output = [result.stdout, result.stderr]
		.filter(Boolean)
		.join('')
		.trim();

	if (!quiet && output) {
		console.log(output);
	}

	if (result.error) {
		if (allowFailure) {
			return output;
		}
		throw result.error;
	}

	if (!allowFailure && result.status !== 0) {
		throw new Error(`${OBSIDIAN_CLI} ${args.join(' ')} failed${output ? `:\n${output}` : ''}`);
	}

	return output;
}

function parseJsonOutput(output) {
	try {
		return JSON.parse(output);
	} catch (error) {
		throw new Error(`Unable to parse Obsidian CLI JSON output: ${error instanceof Error ? error.message : String(error)}\n${output}`);
	}
}

function parseEvalJson(output) {
	const match = output.match(/=>\s*([\s\S]*)$/);
	if (!match) {
		throw new Error(`Unable to parse Obsidian eval output:\n${output}`);
	}

	return JSON.parse(match[1]);
}

function runCdp(method, params, options) {
	const args = ['dev:cdp', `method=${method}`];
	if (params) {
		args.push(`params=${JSON.stringify(params)}`);
	}

	return parseJsonOutput(runObsidian(args, { quiet: true, ...(options ?? {}) }));
}

function runEvalJson(code) {
	return parseEvalJson(runObsidian(['eval', `code=${code}`], { quiet: true }));
}

function metricsToMap(metrics) {
	return new Map(metrics.map((metric) => [metric.name, metric.value]));
}

function formatMetricDelta(name, before, after) {
	const start = before.get(name) ?? 0;
	const end = after.get(name) ?? 0;
	const delta = end - start;
	const isDuration = /Duration$/.test(name) || name === 'ThreadTime' || name === 'ProcessTime';
	const value = isDuration ? delta * 1000 : delta;
	const unit = isDuration ? 'ms' : '';
	return `${name.padEnd(24)} ${value.toFixed(isDuration ? 2 : 0).padStart(10)}${unit}`;
}

function printMeasures(measures) {
	if (measures.length === 0) {
		console.log('\nNo Marp Extended user-timing measures captured. Run npm run build before profiling.');
		return;
	}

	console.log('\nMarp Extended preview measures:');
	for (const measure of measures.sort((a, b) => a.startTime - b.startTime)) {
		console.log(`${measure.duration.toFixed(2).padStart(8)}ms  ${measure.name}`);
	}
}

function clearMarpMeasuresCode() {
	return `for (const entry of performance.getEntriesByType('measure')) { if (entry.name.startsWith('marp-extended:')) performance.clearMeasures(entry.name); }`;
}

function sleep(ms) {
	return new Promise((resolveTimeout) => setTimeout(resolveTimeout, ms));
}

const args = parseArgs(process.argv.slice(2));
const command = args.get('command') ?? DEFAULT_COMMAND;
const filePath = args.get('path') ?? DEFAULT_PATH;
const settleMs = Number(args.get('settle') ?? 500);
const delayMs = Number(args.get('delay') ?? 1500);
const timeoutMs = Number(args.get('timeout') ?? 30000);
const shouldCaptureCpuProfile = args.get('cpu') === 'true' || args.get('cpu') === '1';
const outputPath = resolve(
	args.get('out') ?? join(tmpdir(), `marp-extended-${Date.now().toString(36)}.cpuprofile`)
);

if (!Number.isFinite(delayMs) || delayMs < 0) {
	throw new Error(`Invalid delay: ${args.get('delay')}`);
}

if (!Number.isFinite(settleMs) || settleMs < 0) {
	throw new Error(`Invalid settle: ${args.get('settle')}`);
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
	throw new Error(`Invalid timeout: ${args.get('timeout')}`);
}

runObsidian(['open', `path=${filePath}`], { timeoutMs });
await sleep(settleMs);
runObsidian(['eval', `code=localStorage.setItem('${PROFILE_STORAGE_KEY}', '1'); ${clearMarpMeasuresCode()}; performance.clearMarks(); 'profiling enabled'`], { quiet: true, timeoutMs });

runCdp('Performance.enable', undefined, { timeoutMs });
const beforeMetrics = metricsToMap(runCdp('Performance.getMetrics').metrics);
let profile;
let cpuProfileError;

try {
	if (shouldCaptureCpuProfile) {
		runCdp('Profiler.enable', undefined, { timeoutMs });
		runCdp('Profiler.start', undefined, { timeoutMs });
	}

	runObsidian(['command', `id=${command}`], { timeoutMs });
	await sleep(delayMs);

	if (shouldCaptureCpuProfile) {
		try {
			profile = runCdp('Profiler.stop', undefined, { timeoutMs }).profile;
		} catch (error) {
			cpuProfileError = error;
			runCdp('Profiler.disable', undefined, { allowFailure: true, timeoutMs: 5000 });
		}
	}
} finally {
	runObsidian(['eval', `code=localStorage.removeItem('${PROFILE_STORAGE_KEY}'); 'profiling disabled'`], { quiet: true, allowFailure: true, timeoutMs });
}

const afterMetrics = metricsToMap(runCdp('Performance.getMetrics').metrics);
const measures = runEvalJson(`JSON.stringify(performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('marp-extended:')).map((entry) => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration })))`);

if (profile) {
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, JSON.stringify(profile, null, 2));
	console.log(`\nSaved CPU profile: ${outputPath}`);
} else if (cpuProfileError) {
	console.log(`\nCPU profile capture failed: ${cpuProfileError instanceof Error ? cpuProfileError.message : String(cpuProfileError)}`);
} else {
	console.log('\nCPU profile capture skipped. Pass cpu=true to write a .cpuprofile file.');
}
printMeasures(measures);

console.log('\nChrome Performance metric deltas:');
for (const metricName of [
	'TaskDuration',
	'ScriptDuration',
	'LayoutDuration',
	'RecalcStyleDuration',
	'ThreadTime',
	'JSHeapUsedSize',
	'Nodes',
	'JSEventListeners',
	'LayoutObjects',
]) {
	console.log(formatMetricDelta(metricName, beforeMetrics, afterMetrics));
}
