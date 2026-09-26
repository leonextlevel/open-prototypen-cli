import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { initProject } from '../packages/harness/src/index.js';
import {
  interactionsPath,
  reachabilityWarnings,
  readInteractions,
} from '../packages/prototype/src/index.js';

const projects: string[] = [];
afterEach(() => {
  for (const path of projects.splice(0))
    rmSync(path, { recursive: true, force: true });
});
// Screens are listed as `name: [actions]`, each action a YAML flow mapping without node and label.
function warnings(screens: Record<string, string[]>, scenarios = '[]') {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-reach-'));
  projects.push(root);
  initProject(root, 'codex');
  const body = Object.entries(screens)
    .map(
      ([screen, actions]) =>
        `  ${screen}:\n    frame: ${screen}\n    title: ${screen}\n    content: ${screen}.\n    actions:\n${
          actions
            .map(
              (action, index) =>
                `      a${index}: { node: n${index}, label: A${index}, ${action} }`,
            )
            .join('\n') || '      {}'
        }`,
    )
    .join('\n');
  mkdirSync(dirname(interactionsPath(root)), { recursive: true });
  writeFileSync(
    interactionsPath(root),
    `version: 1\ninitialScreen: home\nscenarios: ${scenarios}\nscreens:\n${body}\n`,
  );
  return reachabilityWarnings(readInteractions(root)).map(
    (warning) => `${warning.code}: ${warning.message}`,
  );
}

it('warns about a when that no set-state or scenario produces', () => {
  expect(
    warnings({
      home: [
        'when: { key: mode, value: advanced }, action: navigate, target: details',
      ],
      details: [],
    }),
  ).toEqual([
    'unsatisfiable-when: Action home.a0 waits for mode = advanced, which no set-state action or scenario produces, so it can never run',
    'unreachable-screen: Screen details cannot be reached from home through any action whose when condition can hold',
  ]);
});

it('catches a typo in a when value', () => {
  expect(
    warnings({
      home: [
        'action: set-state, key: mode, value: advnced',
        'when: { key: mode, value: advanced }, action: navigate, target: details',
      ],
      details: [],
    }).map((warning) => warning.split(':')[0]),
  ).toEqual(['unsatisfiable-when', 'unreachable-screen']);
});

it('reaches screens that need a set-state first, also after going back', () => {
  expect(
    warnings({
      home: [
        'action: set-state, key: mode, value: advanced',
        'when: { key: mode, value: advanced }, action: navigate, target: details',
        'action: navigate, target: settings',
        'when: { key: plan, value: pro }, action: navigate, target: pro',
      ],
      details: [],
      settings: ['action: set-state, key: plan, value: pro', 'action: back'],
      pro: [],
    }),
  ).toEqual([]);
});

it('does not follow a when that only another branch of the flow can satisfy', () => {
  // `receipt` needs paid = yes, which only the unreachable `pay` screen sets.
  expect(
    warnings({
      home: [
        'when: { key: paid, value: yes }, action: navigate, target: receipt',
      ],
      receipt: [],
      pay: ['action: set-state, key: paid, value: yes, target: receipt'],
    }),
  ).toEqual([
    'unreachable-screen: Screen receipt cannot be reached from home through any action whose when condition can hold',
    'unreachable-screen: Screen pay cannot be reached from home through any action whose when condition can hold',
  ]);
});

it('lets scenario controls satisfy when conditions and reaches overlays', () => {
  expect(
    warnings(
      {
        home: [
          'when: { key: outcome, value: error }, action: navigate, target: error',
          'action: open-overlay, target: sheet',
        ],
        error: [],
        sheet: ['action: close-overlay'],
      },
      '[{ key: outcome, label: Outcome, initial: ok, values: [{ value: ok, label: Ok }, { value: error, label: Error }] }]',
    ),
  ).toEqual([]);
});
