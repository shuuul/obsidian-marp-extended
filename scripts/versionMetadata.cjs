const { prerelease } = require("semver");

function isPrereleaseVersion(version) {
	return prerelease(version) !== null;
}

function buildStableVersionMetadata({ packageJson, manifestJson, versionsJson }) {
	const nextManifest = { ...manifestJson, version: packageJson.version };
	const nextVersions = {
		...versionsJson,
		[packageJson.version]: nextManifest.minAppVersion,
	};

	return {
		manifestJson: nextManifest,
		versionsJson: nextVersions,
	};
}

function buildReleaseManifest({ manifestJson, packageVersion }) {
	return {
		...manifestJson,
		version: packageVersion,
	};
}

module.exports = {
	buildReleaseManifest,
	buildStableVersionMetadata,
	isPrereleaseVersion,
};
