# `tests/` — Jest unit + integration tests

Tests run in Node via Jest and ts-jest. Use the npm scripts rather than calling Jest directly so arguments go through the shared runner.

## Commands

```bash
npm run test
npm run test:coverage
npm run test -- tests/unit/filePath.test.ts
npm run test -- --runInBand tests/unit/filePath.test.ts
npm run test -- --runInBand --selectProjects integration
npm run test -- -t "file base path"
```

## Layout

- `unit/**/*.test.ts` — unit tests (Jest project `unit`; `beautiful-mermaid` is mapped to `__mocks__/beautiful-mermaid.ts`).
- `integration/**/*.test.ts` — integration tests (Jest project `integration`; exercises the real beautiful-mermaid renderer, so its `roots` deliberately exclude `__mocks__`).
- `setupWindow.ts` — minimal `window`, `Image`, and animation-frame shims for Node tests.
- `__mocks__/obsidian.ts` — centralized Obsidian API mock.
- `__mocks__/beautiful-mermaid.ts` — mermaid renderer mock with a minimal flowchart `parseMermaid` and source-derived SVG sizing.

Prefer adding tests under `tests/unit/`, mapping source imports through `@/...` and workspace packages through their `@marp-extended/...` package names. Add real-renderer coverage under `tests/integration/`.

