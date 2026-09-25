import {
  evalDocument,
  figPath,
  inspectCanvas,
  REF_KEY,
  REF_NAMESPACE,
  type Bounds,
  type DesignNode,
} from './index.js';

const REF_PATTERN = /^[a-z][a-z0-9-]*$/;
const NODE_ID_PATTERN = /^\d+:\d+$/;
const MASTER_TYPES = new Set(['COMPONENT', 'COMPONENT_SET']);

export type PlacedNode = {
  node: DesignNode;
  bounds: Bounds;
  page: string;
  frame: DesignNode;
  // The master or instance whose structure owns this node, when references cannot live here.
  owner?: { node: DesignNode; kind: 'master' | 'instance' };
};
export type RefIndex = {
  nodes: Map<string, PlacedNode>;
  refs: Map<string, PlacedNode[]>;
  problems: string[];
};

export function isNodeId(value: string): boolean {
  return NODE_ID_PATTERN.test(value);
}
export function describeNode(node: DesignNode): string {
  return `${node.type} ${node.name} (${node.id})`;
}
function placementProblem(ref: string, placed: PlacedNode): string {
  if (!placed.owner) return '';
  const owner = describeNode(placed.owner.node);
  return placed.owner.kind === 'master'
    ? `Reference ${ref} on ${describeNode(placed.node)} is inside component master ${owner}; masters copy references into every instance. Put references on screen frames, instances, or screen layers.`
    : `Reference ${ref} on ${describeNode(placed.node)} is inside ${owner}; instance layers are rebuilt from their master and lose references. Reference the instance and select the layer with part.`;
}

export function indexRefs(tree: DesignNode[]): RefIndex {
  const nodes = new Map<string, PlacedNode>();
  const refs = new Map<string, PlacedNode[]>();
  const visit = (
    list: DesignNode[],
    x: number,
    y: number,
    context: Omit<PlacedNode, 'node' | 'bounds'> | undefined,
  ) => {
    for (const node of list) {
      const bounds = {
        x: x + node.x,
        y: y + node.y,
        width: node.width,
        height: node.height,
      };
      const base = context ?? { page: node.page ?? '', frame: node };
      const owner =
        base.owner ??
        (MASTER_TYPES.has(node.type)
          ? { node, kind: 'master' as const }
          : undefined);
      const placed = { ...base, owner, node, bounds };
      nodes.set(node.id, placed);
      if (node.ref) refs.set(node.ref, [...(refs.get(node.ref) ?? []), placed]);
      visit(node.children ?? [], bounds.x, bounds.y, {
        ...base,
        owner:
          owner ??
          (node.type === 'INSTANCE'
            ? { node, kind: 'instance' as const }
            : undefined),
      });
    }
  };
  visit(tree, 0, 0, undefined);
  const problems: string[] = [];
  for (const [ref, entries] of refs) {
    if (entries.length > 1)
      problems.push(
        `Reference ${ref} is used by ${entries.length} nodes: ${entries.map((entry) => describeNode(entry.node)).join(', ')}. Clones copy references; keep one and remove the others with open-prototypen ref clear <node-id>.`,
      );
    for (const entry of entries) {
      const problem = placementProblem(ref, entry);
      if (problem) problems.push(problem);
    }
  }
  return { nodes, refs, problems };
}

export function resolveNode(index: RefIndex, reference: string): PlacedNode {
  if (isNodeId(reference)) {
    const placed = index.nodes.get(reference);
    if (!placed) throw new Error(`Unknown node ID ${reference}`);
    return placed;
  }
  if (!REF_PATTERN.test(reference))
    throw new Error(
      `Invalid node reference ${reference}; use a lowercase reference such as search-screen, or a node ID`,
    );
  const entries = index.refs.get(reference) ?? [];
  if (!entries.length)
    throw new Error(
      `Unknown reference ${reference}; assign it with open-prototypen ref set <node-id>=${reference}`,
    );
  if (entries.length > 1)
    throw new Error(
      `Reference ${reference} is ambiguous: ${entries.map((entry) => describeNode(entry.node)).join(', ')}`,
    );
  const placed = entries[0] as PlacedNode;
  const problem = placementProblem(reference, placed);
  if (problem) throw new Error(problem);
  return placed;
}

export function resolveFrame(index: RefIndex, reference: string): PlacedNode {
  const placed = resolveNode(index, reference);
  if (placed.frame !== placed.node || placed.node.type !== 'FRAME')
    throw new Error(
      `${reference} resolves to ${describeNode(placed.node)}, which is not a top-level frame of a page`,
    );
  return placed;
}

export function resolvePart(placed: PlacedNode, part: string): PlacedNode {
  const matches: PlacedNode[] = [];
  const visit = (list: DesignNode[], x: number, y: number) => {
    for (const node of list) {
      const bounds = {
        x: x + node.x,
        y: y + node.y,
        width: node.width,
        height: node.height,
      };
      if (node.name === part) matches.push({ ...placed, node, bounds });
      visit(node.children ?? [], bounds.x, bounds.y);
    }
  };
  visit(placed.node.children ?? [], placed.bounds.x, placed.bounds.y);
  if (matches.length !== 1)
    throw new Error(
      `Expected one layer named ${part} inside ${describeNode(placed.node)}; found ${matches.length}`,
    );
  return matches[0] as PlacedNode;
}

export function listRefs(project: string): {
  document: string;
  refs: {
    ref: string;
    id: string;
    name: string;
    type: string;
    page: string;
    frame: string;
  }[];
  problems: string[];
} {
  const index = indexRefs(inspectCanvas(project).tree);
  return {
    document: figPath(project),
    refs: [...index.refs].flatMap(([ref, entries]) =>
      entries.map((entry) => ({
        ref,
        id: entry.node.id,
        name: entry.node.name,
        type: entry.node.type,
        page: entry.page,
        frame: entry.frame.name,
      })),
    ),
    problems: index.problems,
  };
}

function writeRefs(project: string, values: { id: string; ref: string }[]) {
  evalDocument(
    project,
    `
    for (const { id, ref } of ${JSON.stringify(values)})
      figma.getNodeById(id).setSharedPluginData(${JSON.stringify(REF_NAMESPACE)}, ${JSON.stringify(REF_KEY)}, ref);
    return null;`,
    true,
  );
}

export function parseAssignment(value: string): { id: string; ref: string } {
  const [id, ref, ...rest] = value.split('=');
  if (!id || !ref || rest.length || !isNodeId(id) || !REF_PATTERN.test(ref))
    throw new Error(
      `Invalid assignment ${value}; expected <node-id>=<ref>, such as 0:12=search-screen`,
    );
  return { id, ref };
}

export function setRefs(
  project: string,
  assignments: { id: string; ref: string }[],
): {
  document: string;
  assigned: { id: string; name: string; ref: string; previous?: string }[];
} {
  const index = indexRefs(inspectCanvas(project).tree);
  // Nodes in this batch release their current references, so references can move between them.
  const batch = new Set(assignments.map((item) => item.id));
  const ids = new Set<string>(),
    refs = new Set<string>();
  const assigned = assignments.map(({ id, ref }) => {
    if (ids.has(id)) throw new Error(`Node ${id} is assigned more than once`);
    if (refs.has(ref))
      throw new Error(`Reference ${ref} is assigned more than once`);
    ids.add(id);
    refs.add(ref);
    const placed = index.nodes.get(id);
    if (!placed) throw new Error(`Unknown node ID ${id}`);
    const problem = placementProblem(ref, placed);
    if (problem) throw new Error(problem);
    const holders = (index.refs.get(ref) ?? []).filter(
      (entry) => !batch.has(entry.node.id),
    );
    if (holders.length)
      throw new Error(
        `Reference ${ref} is already used by ${holders.map((entry) => describeNode(entry.node)).join(', ')}; clear it first with open-prototypen ref clear <node-id>`,
      );
    return {
      id,
      name: placed.node.name,
      ref,
      ...(placed.node.ref && placed.node.ref !== ref
        ? { previous: placed.node.ref }
        : {}),
    };
  });
  writeRefs(project, assignments);
  return { document: figPath(project), assigned };
}

export function clearRefs(
  project: string,
  ids: string[],
): { document: string; cleared: { id: string; name: string; ref: string }[] } {
  const index = indexRefs(inspectCanvas(project).tree);
  const cleared = ids.map((id) => {
    const placed = index.nodes.get(id);
    if (!placed) throw new Error(`Unknown node ID ${id}`);
    return { id, name: placed.node.name, ref: placed.node.ref ?? '' };
  });
  writeRefs(
    project,
    ids.map((id) => ({ id, ref: '' })),
  );
  return { document: figPath(project), cleared };
}
