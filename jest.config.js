/** @type {import('ts-jest').JestConfigWithTsJest} */
const packageModuleNameMapper = {
	'^@marp-extended/code-fence-scanner$': '<rootDir>/packages/code-fence-scanner/src/index.ts',
	'^@marp-extended/marp-dsl$': '<rootDir>/packages/marp-dsl/src/index.ts',
	'^@marp-extended/wiki-links$': '<rootDir>/packages/wiki-links/src/index.ts',
	'^@marp-extended/mermaid-autofit$': '<rootDir>/packages/mermaid-autofit/src/index.ts',
};

const baseConfig = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
	},
	roots: ['<rootDir>/src', '<rootDir>/tests'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	setupFilesAfterEnv: ['<rootDir>/tests/setupWindow.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@test/(.*)$': '<rootDir>/tests/$1',
		'^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
		'^beautiful-mermaid$': '<rootDir>/tests/__mocks__/beautiful-mermaid.ts',
		'^marp-extended:embedded-engine$': '<rootDir>/tests/__mocks__/embeddedEngine.ts',
		...packageModuleNameMapper,
	},
};

module.exports = {
	testTimeout: 15_000,
	projects: [
		{
			...baseConfig,
			displayName: 'unit',
			testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
		},
		{
			...baseConfig,
			displayName: 'integration',
			testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
			// Keep roots away from tests/__mocks__: Jest auto-applies manual mocks
			// for node modules found under roots, and integration tests must
			// exercise the real beautiful-mermaid renderer. beautiful-mermaid only
			// ships an ESM ("import") export, so map it to the bundled dist file
			// and let ts-jest transpile it to CJS (allowJs is on).
			roots: ['<rootDir>/packages', '<rootDir>/tests/integration'],
			transform: {
				'^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
			},
			transformIgnorePatterns: ['/node_modules/(?!beautiful-mermaid/)'],
			moduleNameMapper: {
				'^@/(.*)$': '<rootDir>/src/$1',
				'^@test/(.*)$': '<rootDir>/tests/$1',
				'^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
				'^beautiful-mermaid$': '<rootDir>/node_modules/beautiful-mermaid/dist/index.js',
				'^marp-extended:embedded-engine$': '<rootDir>/tests/__mocks__/embeddedEngine.ts',
				...packageModuleNameMapper,
			},
		},
	],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
	],
	coverageDirectory: 'coverage',
};
