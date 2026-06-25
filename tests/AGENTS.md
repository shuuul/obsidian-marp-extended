# `tests/` — Jest unit tests

Tests run in Node via Jest and ts-jest. Use the npm scripts rather than calling Jest directly so arguments go through the shared runner.

## Commands

```bash
npm run test
npm run test:coverage
npm run test -- tests/unit/filePath.test.ts
npm run test -- --runInBand tests/unit/filePath.test.ts
npm run test -- -t "file base path"
```

## Layout

- `unit/**/*.test.ts` — unit tests.
- `setupWindow.ts` — minimal `window`, `Image`, and animation-frame shims for Node tests.
- `__mocks__/obsidian.ts` — centralized Obsidian API mock.

Prefer adding tests under `tests/unit/` and mapping source imports through `@/...`.
