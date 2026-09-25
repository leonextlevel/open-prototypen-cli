import { readFileSync } from 'node:fs';

const tag = process.argv[2];
if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag ?? '')) {
  throw new Error('Release tag must be vX.Y.Z');
}

const version = tag.slice(1);
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');
if (manifest.name !== 'open-prototypen-cli') {
  throw new Error('Unexpected npm package name');
}
if (manifest.version !== version) {
  throw new Error(
    `Tag ${tag} does not match package version ${manifest.version}`,
  );
}
if (
  !new RegExp(
    `^## \\[${version.replaceAll('.', '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`,
    'm',
  ).test(changelog)
) {
  throw new Error(`CHANGELOG.md has no dated section for ${version}`);
}
console.log(`Release metadata matches ${tag}`);
