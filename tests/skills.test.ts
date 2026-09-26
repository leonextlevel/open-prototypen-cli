import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { packageRoot } from '../packages/schemas/src/index.js';

function markdown(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? markdown(path)
      : entry.name.endsWith('.md')
        ? [path]
        : [];
  });
}

it('resolves every relative link between skills and references', () => {
  const broken = markdown(join(packageRoot(), 'skills')).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
      .map((match) => match[1] ?? '')
      .filter((link) => !/^[a-z]+:/.test(link))
      .filter((link) => !existsSync(resolve(dirname(file), link)))
      .map((link) => `${file}: ${link}`),
  );
  expect(broken).toEqual([]);
});

it('ends every design reference with its sources', () => {
  const references = join(
    packageRoot(),
    'skills/open-prototypen-design/references',
  );
  for (const file of readdirSync(references))
    expect(readFileSync(join(references, file), 'utf8'), file).toMatch(
      /\n## Sources\n/,
    );
});
