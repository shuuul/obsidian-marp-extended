import { readFileSync, writeFileSync } from "node:fs";
import versionMetadata from "./scripts/versionMetadata.cjs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifestJson = JSON.parse(readFileSync("manifest.json", "utf8"));
const versionsJson = JSON.parse(readFileSync("versions.json", "utf8"));
const { buildStableVersionMetadata, isPrereleaseVersion } = versionMetadata;

if (isPrereleaseVersion(packageJson.version)) {
	throw new Error(
		`Refusing to sync prerelease ${packageJson.version} into stable Obsidian metadata`,
	);
}

const nextMetadata = buildStableVersionMetadata({
	packageJson,
	manifestJson,
	versionsJson,
});

writeFileSync(
	"manifest.json",
	`${JSON.stringify(nextMetadata.manifestJson, null, "\t")}\n`,
);
writeFileSync(
	"versions.json",
	`${JSON.stringify(nextMetadata.versionsJson, null, "\t")}\n`,
);
