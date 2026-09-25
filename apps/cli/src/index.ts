#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Command } from 'commander';
import {
  artifactPath,
  dependencyPaths,
  projectSummary,
} from '../../../packages/core/src/index.js';
import { readDesignSystem } from '../../../packages/core/src/system.js';
import {
  initProject,
  installSkills,
} from '../../../packages/harness/src/index.js';
import { inspectCanvas } from '../../../packages/openpencil/src/index.js';
import {
  applyDesignSystem,
  importSvg,
  inspectNativeSystem,
} from '../../../packages/openpencil/src/system.js';
import {
  compilePrototype,
  inspectScreen,
  readInteractions,
  renderScreens,
} from '../../../packages/prototype/src/index.js';
import {
  getDefinition,
  loadRegistry,
  packageRoot,
  templateFor,
} from '../../../packages/schemas/src/index.js';
import {
  status,
  validateArtifact,
} from '../../../packages/validator/src/index.js';
import { validateCanvas } from '../../../packages/validator/src/canvas.js';

const program = new Command();
program
  .name('open-prototypen')
  .description(
    'Artifact and prototype infrastructure for agent-led product exploration',
  )
  .version(
    JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8'))
      .version as string,
  );
program.option(
  '-p, --project <path>',
  'Project repository root',
  process.cwd(),
);
const root = () => resolve(program.opts<{ project: string }>().project);
const output = (value: unknown, json?: boolean) =>
  console.log(
    json
      ? JSON.stringify(value, null, 2)
      : typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2),
  );

program
  .command('init')
  .description('Initialize a project and install skills')
  .option('--harness <name>', 'codex, claude, or all')
  .option('--language <tag>', 'Project language')
  .action((options: { harness?: string; language?: string }) => {
    output(initProject(root(), options.harness, options.language));
  });
program
  .command('update')
  .description('Update installed skills while preserving local changes')
  .option('--harness <name>', 'codex, claude, or all')
  .action((options: { harness?: string }) => {
    output(installSkills(root(), options.harness, true));
  });
program
  .command('status')
  .description('Report artifact readiness')
  .option('--json', 'Machine-readable JSON')
  .action((options: { json?: boolean }) => {
    const states = status(root());
    output(
      options.json
        ? states
        : states
            .map(
              (item) =>
                `${item.state.padEnd(9)} ${item.artifact}${item.blockedBy.length ? ` (blocked by ${item.blockedBy.join(', ')})` : ''}`,
            )
            .join('\n'),
      options.json,
    );
  });
program
  .command('instructions <artifact>')
  .description('Show an artifact contract and template')
  .option('--json', 'Machine-readable JSON')
  .action((id: string, options: { json?: boolean }) => {
    const definition = getDefinition(id);
    const contract = {
      artifact: id,
      outputPath: relative(root(), artifactPath(root(), id)),
      templateVersion: 1,
      dependencies: dependencyPaths(root(), id).map((path) =>
        relative(root(), path),
      ),
      requiredSections: definition.requiredSections,
      optional: definition.optional,
      instructions: definition.instructions,
      rules: definition.rules,
      template: templateFor(id),
    };
    output(contract, options.json);
  });
program
  .command('validate [artifact]')
  .description('Validate one or all artifacts')
  .option('--json', 'Machine-readable JSON')
  .action((id: string | undefined, options: { json?: boolean }) => {
    if (id === 'canvas') {
      let frames: Record<string, string> = {};
      let interactionError: string | undefined;
      try {
        frames = Object.fromEntries(
          Object.entries(readInteractions(root()).screens).map(
            ([name, screen]) => [name, screen.frame],
          ),
        );
      } catch (error) {
        interactionError =
          error instanceof Error ? error.message : String(error);
      }
      const result = validateCanvas(root(), frames);
      if (interactionError) {
        result.findings.push({
          code: 'interactions',
          message: interactionError,
        });
        result.valid = false;
      }
      output(
        options.json
          ? result
          : `${result.valid ? '✓' : '✗'} canvas${result.findings.length ? `: ${result.findings.map((finding) => finding.message).join('; ')}` : ''}`,
        options.json,
      );
      if (!result.valid) process.exitCode = 1;
      return;
    }
    const ids = id
      ? [getDefinition(id).id]
      : loadRegistry()
          .artifacts.filter(
            (item) =>
              !item.optional ||
              status(root()).find((entry) => entry.artifact === item.id)
                ?.exists,
          )
          .map((item) => item.id);
    const results = ids.map((item) => validateArtifact(root(), item));
    output(
      options.json
        ? results
        : results
            .map(
              (item) =>
                `${item.valid ? '✓' : '✗'} ${item.artifact}${item.findings.length ? `: ${item.findings.map((finding) => finding.message).join('; ')}` : ''}`,
            )
            .join('\n'),
      options.json,
    );
    if (results.some((item) => !item.valid)) process.exitCode = 1;
  });
const inspect = program
  .command('inspect')
  .description('Inspect project state or OpenPencil design');
inspect
  .command('project')
  .option('--json', 'Machine-readable JSON')
  .action((options: { json?: boolean }) =>
    output({ ...projectSummary(root()), status: status(root()) }, options.json),
  );
inspect
  .command('canvas')
  .option('--json', 'Machine-readable JSON')
  .action((options: { json?: boolean }) =>
    output(inspectCanvas(root()), options.json),
  );
inspect
  .command('system')
  .option('--json', 'Machine-readable JSON')
  .action((options: { json?: boolean }) =>
    output(
      {
        contract: readDesignSystem(root()),
        native: inspectNativeSystem(root()),
      },
      options.json,
    ),
  );
inspect
  .command('screen <id>')
  .option('--json', 'Machine-readable JSON')
  .action((id: string, options: { json?: boolean }) =>
    output(inspectScreen(root(), id), options.json),
  );
program
  .command('system')
  .description('Manage the native OpenPencil design system')
  .command('apply')
  .action(async () => output(await applyDesignSystem(root())));
program
  .command('svg')
  .description('Manage editable SVG assets in OpenPencil')
  .command('import <file>')
  .option('--name <name>', 'Name of the imported vector group')
  .action((file: string, options: { name?: string }) =>
    output(importSvg(root(), file, options.name)),
  );
program
  .command('render [screen]')
  .description('Export OpenPencil frames to PNG')
  .action((screen?: string) => output(renderScreens(root(), screen)));
program
  .command('prototype')
  .description('Compile rendered screens into a navigable HTML prototype')
  .action(() => output(compilePrototype(root())));

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
