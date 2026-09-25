#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Command } from 'commander';
import {
  artifactPath,
  dependencyPaths,
  projectSummary,
  resolveProjectLanguage,
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
  clearRefs,
  listRefs,
  parseAssignment,
  setRefs,
} from '../../../packages/openpencil/src/refs.js';
import {
  compilePrototype,
  inspectScreen,
  renderScreens,
  validatePrototypeCanvas,
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

// Templates ship with an English placeholder; artifacts should declare the project's language.
const localizedTemplate = (template: string) => {
  let language: string;
  try {
    language = resolveProjectLanguage(root());
  } catch {
    return template;
  }
  return template.replace(/^language: en$/m, `language: ${language}`);
};

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
      template: localizedTemplate(templateFor(id)),
    };
    output(contract, options.json);
  });
program
  .command('validate [artifact]')
  .description('Validate one or all artifacts')
  .option('--json', 'Machine-readable JSON')
  .action((id: string | undefined, options: { json?: boolean }) => {
    if (id === 'canvas') {
      const result = validatePrototypeCanvas(root());
      const notes = [
        ...result.findings.map((finding) => finding.message),
        ...result.warnings.map((warning) => `warning: ${warning.message}`),
      ];
      output(
        options.json
          ? result
          : `${result.valid ? '✓' : '✗'} canvas${notes.length ? `: ${notes.join('; ')}` : ''}`,
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
  .command('screen <screen>')
  .description('Resolve a screen key from interactions.yaml and its hotspots')
  .option('--json', 'Machine-readable JSON')
  .action((screen: string, options: { json?: boolean }) =>
    output(inspectScreen(root(), screen), options.json),
  );
program
  .command('system')
  .description('Manage the native OpenPencil design system')
  .command('apply')
  .option('--json', 'Machine-readable JSON')
  .action(async (options: { json?: boolean }) =>
    output(await applyDesignSystem(root()), options.json),
  );
program
  .command('svg')
  .description('Manage editable SVG assets in OpenPencil')
  .command('import <file>')
  .option('--name <name>', 'Name of the imported vector group')
  .option('--json', 'Machine-readable JSON')
  .action((file: string, options: { name?: string; json?: boolean }) =>
    output(importSvg(root(), file, options.name), options.json),
  );
const ref = program
  .command('ref')
  .description('Manage stable node references used by interactions.yaml');
ref
  .command('set <assignments...>')
  .description('Assign references as <node-id>=<ref> pairs')
  .option('--json', 'Machine-readable JSON')
  .action((assignments: string[], options: { json?: boolean }) =>
    output(setRefs(root(), assignments.map(parseAssignment)), options.json),
  );
ref
  .command('clear <node-ids...>')
  .description('Remove references from nodes')
  .option('--json', 'Machine-readable JSON')
  .action((ids: string[], options: { json?: boolean }) =>
    output(clearRefs(root(), ids), options.json),
  );
ref
  .command('list')
  .description('List references and duplicate or misplaced ones')
  .option('--json', 'Machine-readable JSON')
  .action((options: { json?: boolean }) => {
    const result = listRefs(root());
    output(result, options.json);
    if (result.problems.length) process.exitCode = 1;
  });
program
  .command('render [screen]')
  .description('Export OpenPencil frames to PNG')
  .option('--json', 'Machine-readable JSON')
  .action((screen: string | undefined, options: { json?: boolean }) =>
    output(renderScreens(root(), screen), options.json),
  );
program
  .command('prototype')
  .description('Compile rendered screens into a navigable HTML prototype')
  .option('--json', 'Machine-readable JSON')
  .action((options: { json?: boolean }) =>
    output(compilePrototype(root()), options.json),
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
