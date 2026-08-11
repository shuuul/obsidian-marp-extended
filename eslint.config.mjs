import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default [
	{
		ignores: [
			'node_modules/**',
			'coverage/**',
			'main.js',
			'marp-engine.cjs',
			'esbuild.config.mjs',
			'jest.config.js',
			'version-bump.mjs',
			'scripts/**',
			'tests/**',
		],
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mjs', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			'obsidianmd/ui/sentence-case': 'off',
		},
	},
];