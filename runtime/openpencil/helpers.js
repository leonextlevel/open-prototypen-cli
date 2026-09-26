// Helpers injected as `op` into scripts run with `open-prototypen eval`. They resolve nodes by
// name or stable reference, since OpenPencil renumbers node IDs on every save that adds or
// removes nodes.
const op = (() => {
  const COLLECTION = 'Open Prototypen';
  const REF_NAMESPACE = 'open-prototypen';
  const REF_KEY = 'ref';
  const GAP = 32;
  const all = () => figma.root.findAll(() => true);
  const one = (matches, description) => {
    if (matches.length !== 1)
      throw new Error(`Expected one ${description}; found ${matches.length}`);
    return matches[0];
  };

  // The native variable for a token declared in system.yaml and created by `system apply`.
  function token(name) {
    const collection = figma
      .getLocalVariableCollections()
      .find((item) => item.name === COLLECTION);
    return one(
      figma
        .getLocalVariables()
        .filter(
          (item) => item.name === name && item.collectionId === collection?.id,
        ),
      `native variable named ${name}; run open-prototypen system apply`,
    );
  }

  // Binds a field such as 'fills/0/color', 'strokes/0/color', 'itemSpacing', or 'paddingLeft' to a
  // token and writes its value, because binding alone does not repaint the literal.
  function bind(node, field, tokenName) {
    const variable = token(tokenName);
    const value = figma.graph.resolveVariable(variable.id);
    const [key, index, property] = field.split('/');
    if (index === undefined) node[key] = value;
    else {
      const paints = structuredClone(node[key] ?? []);
      if (!paints[Number(index)])
        throw new Error(`${node.name} has no ${key}[${index}] to bind`);
      paints[Number(index)][property] = value;
      node[key] = paints;
    }
    figma.bindVariable(node.id, field, variable.id);
    return node;
  }

  // The component master with this exact name, on any page.
  function master(name) {
    return one(
      all().filter((node) => node.type === 'COMPONENT' && node.name === name),
      `component master named ${name}`,
    );
  }

  // The page with this name; `{ create: true }` creates it when missing.
  function page(name, options = {}) {
    const found = figma.root.children.find((item) => item.name === name);
    if (found) return found;
    if (!options.create)
      throw new Error(`Unknown page: ${name}; pass { create: true } to add it`);
    const created = figma.createPage();
    created.name = name;
    return created;
  }

  function byRef(ref) {
    return one(
      all().filter(
        (node) => node.getSharedPluginData(REF_NAMESPACE, REF_KEY) === ref,
      ),
      `node with reference ${ref}`,
    );
  }

  // Gives a screen frame or action node a stable reference for interactions.yaml.
  function setRef(node, ref) {
    if (!/^[a-z][a-z0-9-]*$/.test(ref))
      throw new Error(
        `Invalid reference ${ref}; use lowercase letters, digits, and hyphens`,
      );
    const owner = all().find(
      (item) =>
        item.id !== node.id &&
        item.getSharedPluginData(REF_NAMESPACE, REF_KEY) === ref,
    );
    if (owner)
      throw new Error(`Reference ${ref} already belongs to ${owner.name}`);
    node.setSharedPluginData(REF_NAMESPACE, REF_KEY, ref);
    return node;
  }

  // A position to the right of the page's content, where a new node does not overlap it.
  function freeSpot(target = figma.currentPage) {
    const content = target.children;
    if (!content.length) return { x: 0, y: 0 };
    return {
      x: Math.max(...content.map((node) => node.x + node.width)) + GAP,
      y: Math.min(...content.map((node) => node.y)),
    };
  }

  // Places an instance of a master (or master name) in a parent at x, y relative to the parent.
  // `overrides` maps layer names inside the instance to properties; only text (`characters`)
  // survives saving, as the headless reference explains.
  function place(source, parent, x = 0, y = 0, overrides = {}) {
    const instance = (
      typeof source === 'string' ? master(source) : source
    ).createInstance();
    parent.appendChild(instance);
    instance.x = x;
    instance.y = y;
    for (const [name, properties] of Object.entries(overrides)) {
      const layer = one(
        instance.findAll((node) => node.name === name),
        `layer named ${name} in ${instance.name}`,
      );
      Object.assign(layer, properties);
    }
    return instance;
  }

  return { token, bind, master, page, byRef, setRef, freeSpot, place };
})();
