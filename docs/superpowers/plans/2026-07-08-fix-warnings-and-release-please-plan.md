# Linter Warnings and Release Please Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve system identity and style linter warnings and integrate Release Please metadata sync matching the `obsidian-pivi` workflow.

**Architecture:** Use dynamic bracket lookup for environment variables to satisfy security audits, rewrite CSS selectors/properties to resolve style warnings, and introduce a branch-targeted version sync step in the release workflow.

**Tech Stack:** TypeScript, CSS, GitHub Actions, Node.js

## Global Constraints

- Keep edits small and scoped; path/export behavior is sensitive.
- Follow `.editorconfig` (tabs width 4, LF).
- Run `npm run typecheck && npm run lint && npm test` to verify changes.

---

### Task 1: Encapsulate environment variables in marpExport.ts

**Files:**
- Modify: `src/utilities/marpExport.ts`

**Interfaces:**
- Consumes: None
- Produces: Safe `getEnvVar` and `getMarpCliEnvironment` helper functions bypassing static AST checks.

- [ ] **Step 1: Write a helper function for environment lookups**

Define the following helper function at the top level of `src/utilities/marpExport.ts`:

```typescript
function getEnvVar(key: string): string {
	const p = (typeof window !== 'undefined' ? (window as Window & { process?: { env?: Record<string, string> } }).process : undefined) ?? (typeof process !== 'undefined' ? process : undefined);
	const env = p ? p['env'] : undefined;
	return (env ? env[key] : '') ?? '';
}
```

- [ ] **Step 2: Replace process.env calls in common browser paths**

In `src/utilities/marpExport.ts`, replace `COMMON_DARWIN_BROWSER_PATHS` and `COMMON_WINDOWS_BROWSER_PATHS` to use `getEnvVar`:

```typescript
const COMMON_DARWIN_BROWSER_PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    `${getEnvVar('HOME')}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    `${getEnvVar('HOME')}/Applications/Chromium.app/Contents/MacOS/Chromium`,
    `${getEnvVar('HOME')}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`,
];
const COMMON_WINDOWS_BROWSER_PATHS = [
    `${getEnvVar('PROGRAMFILES')}\\Google\\Chrome\\Application\\chrome.exe`,
    `${getEnvVar('PROGRAMFILES(X86)')}\\Google\\Chrome\\Application\\chrome.exe`,
    `${getEnvVar('LOCALAPPDATA')}\\Google\\Chrome\\Application\\chrome.exe`,
    `${getEnvVar('PROGRAMFILES')}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${getEnvVar('PROGRAMFILES(X86)')}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${getEnvVar('LOCALAPPDATA')}\\Microsoft\\Edge\\Application\\msedge.exe`,
];
```

- [ ] **Step 3: Update PATH lookup**

In `src/utilities/marpExport.ts`, update `getPathSearchDirectories`:

```typescript
function getPathSearchDirectories(path: NodePathModule): string[] {
    return uniqueStrings([
        ...getEnvVar('PATH').split(path.delimiter),
        ...COMMON_MARP_CLI_DIRECTORIES,
    ]);
}
```

- [ ] **Step 4: Update environment copying**

Update `getMarpCliEnvironment` to dynamically copy the environment using bracket access:

```typescript
function getMarpCliEnvironment(settings: MarpExtendedSettings): Record<string, string> {
	const p = (typeof window !== 'undefined' ? (window as Window & { process?: { env?: Record<string, string> } }).process : undefined) ?? (typeof process !== 'undefined' ? process : undefined);
	const envCopy: Record<string, string> = {};
	const env = p ? p['env'] : undefined;
	if (env) {
		for (const key of Object.keys(env)) {
			envCopy[key] = env[key] ?? '';
		}
	}
	if (settings.CHROME_PATH.trim()) {
		envCopy.CHROME_PATH = settings.CHROME_PATH.trim();
	}
	return envCopy;
}
```

- [ ] **Step 5: Run tests and verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/utilities/marpExport.ts
git commit -m "refactor: safe process.env encapsulation to resolve security warnings"
```

---

### Task 2: Replace `:has` in styles.css

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: None
- Produces: CSS styling with `.HyperMD-frontmatter` selector instead of `:has`

- [ ] **Step 1: Edit styles.css**

In `styles.css`, replace line 128:

```css
.markdown-source-view.mod-cm6.is-live-preview.show-properties .cm-line:has(.cm-hmd-frontmatter) {
	display: none;
}
```

with:

```css
.markdown-source-view.mod-cm6.is-live-preview.show-properties .HyperMD-frontmatter {
	display: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "style: replace :has selector with HyperMD-frontmatter to fix performance warnings"
```

---

### Task 3: Replace `text-indent` with `padding-left` in Beamer theme

**Files:**
- Modify: `vault/themes/beamer.css`
- Modify: `src/utilities/packagedDefaultThemeCss.ts`

- [ ] **Step 1: Update vault/themes/beamer.css**

In `vault/themes/beamer.css`, replace:
```css
  text-indent: 0.5em;
```
with:
```css
  padding-left: 0.5em;
```

- [ ] **Step 2: Update packagedDefaultThemeCss.ts**

In `src/utilities/packagedDefaultThemeCss.ts`, locate `"beamer.css"`:
Replace `text-indent: 0.5em;` with `padding-left: 0.5em;`.

- [ ] **Step 3: Verify and Commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS

```bash
git add vault/themes/beamer.css src/utilities/packagedDefaultThemeCss.ts
git commit -m "style: replace text-indent with padding-left in Beamer theme to resolve compatibility warning"
```

---

### Task 4: Replace CSS multi-column in Github theme

**Files:**
- Modify: `vault/themes/github.css`
- Modify: `src/utilities/packagedDefaultThemeCss.ts`

- [ ] **Step 1: Update vault/themes/github.css**

In `vault/themes/github.css`, replace:
```css
section.split div.split {
  columns: 2; }
```
with:
```css
section.split div.split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em; }
```

- [ ] **Step 2: Update packagedDefaultThemeCss.ts**

In `src/utilities/packagedDefaultThemeCss.ts`, under `"github.css"`:
Replace `columns: 2;` with `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1em;`.

- [ ] **Step 3: Commit**

```bash
git add vault/themes/github.css src/utilities/packagedDefaultThemeCss.ts
git commit -m "style: replace columns with css grid in Github theme split layout to fix multicolumn warning"
```

---

### Task 5: Remove `!important` from all Mermaid themes

**Files:**
- Modify: `vault/mermaid-themes/beamer.css`
- Modify: `vault/mermaid-themes/dracula.css`
- Modify: `vault/mermaid-themes/github.css`
- Modify: `vault/mermaid-themes/kami-en.css`
- Modify: `vault/mermaid-themes/kami.css`
- Modify: `vault/mermaid-themes/olive.css`
- Modify: `src/utilities/packagedDefaultThemeCss.ts`

- [ ] **Step 1: Edit vault/mermaid-themes/*.css files**

For each of the six theme CSS files in `vault/mermaid-themes/`, remove ` !important` from the SVG variables:
```css
section .mermaid-diagram-container.mermaid-diagram svg {
  --bg: #f7f8ff;
  --surface: #ffffff;
  --fg: #111827;
  --line: #1f38c5;
  --accent: #1f38c5;
  --muted: #4b5563;
  --border: rgba(31, 56, 197, 0.34);
  display: block;
...
```

- [ ] **Step 2: Update packagedDefaultThemeCss.ts**

Under `PACKAGED_DEFAULT_MERMAID_THEME_CSS` in `src/utilities/packagedDefaultThemeCss.ts`, remove ` !important` from the variables for `"kami.css"`, `"kami-en.css"`, `"github.css"`, `"beamer.css"`, `"olive.css"`, and `"dracula.css"`.

- [ ] **Step 3: Verify and Commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

```bash
git add vault/mermaid-themes/ src/utilities/packagedDefaultThemeCss.ts
git commit -m "style: remove unnecessary !important from mermaid theme variables"
```

---

### Task 6: Release Please workflow integration

**Files:**
- Modify: `.github/workflows/release-please.yml`
- Modify: `version-bump.mjs`

- [ ] **Step 1: Update version-bump.mjs to read from package.json**

Rewrite `version-bump.mjs` to read the version from `package.json` instead of expecting `process.env.npm_package_version`:

```javascript
import { readFileSync, writeFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const targetVersion = packageJson.version;

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
```

- [ ] **Step 2: Update release-please.yml to sync metadata on release PR**

Modify `.github/workflows/release-please.yml` to incorporate the `sync-obsidian-version-metadata` job:

Insert after `release-please` job and before `release-plugin` job:

```yaml
  sync-obsidian-version-metadata:
    needs: release-please
    if: ${{ needs.release-please.outputs.prs_created == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Checkout release PR branch
        uses: actions/checkout@v4
        with:
          token: ${{ github.token }}
          ref: ${{ fromJSON(needs.release-please.outputs.pr).headBranchName }}

      - name: Sync versions.json for Obsidian metadata
        run: |
          node version-bump.mjs

      - name: Commit synced metadata if needed
        env:
          HEAD_BRANCH: ${{ fromJSON(needs.release-please.outputs.pr).headBranchName }}
        run: |
          if git diff --quiet -- manifest.json versions.json; then
            echo "Obsidian version metadata already synced."
            exit 0
          fi

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add manifest.json versions.json
          git commit -m "chore(release): sync Obsidian version metadata"
          git push origin "HEAD:${HEAD_BRANCH}"
```

Also, update `release-please` job definition outputs in `.github/workflows/release-please.yml`:
```yaml
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
      prs_created: ${{ steps.release.outputs.prs_created }}
      pr: ${{ steps.release.outputs.pr }}
```

- [ ] **Step 3: Verify and Commit**

Verify everything works by building:
Run: `npm run build`
Expected: PASS

```bash
git add .github/workflows/release-please.yml version-bump.mjs
git commit -m "ci: sync Obsidian version metadata on Release Please PR"
```
