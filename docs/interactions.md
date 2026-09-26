# Prototype interactions

`docs/design/prototype/interactions.yaml` maps screen IDs to OpenPencil frames and action IDs to nodes inside those frames. Frames may live on different pages of the same `.fig`; shared screens need only one frame. Rendered screen images are derived from these frames. Node geometry determines hotspot positions.

## Stable references

OpenPencil renumbers node IDs in document order when the `.fig` is saved, so inserting or removing any node, even on another page, changes the IDs of later nodes. Refer to frames and action nodes by stable references instead. A reference is a lowercase name, such as `search-screen`, stored in the node itself; it survives saves, moves, and renames.

```sh
open-prototypen inspect canvas --json   # find current node IDs on every page
open-prototypen ref set 0:12=collection 0:15=open-detail 0:40=tab-bar
open-prototypen ref list --json         # show references, duplicates, and misplaced ones
open-prototypen ref clear 0:77          # remove a reference, for example from a clone
```

Each reference must belong to exactly one node. Place references on screen frames, on instances, and on ordinary layers of a screen, not inside component masters or instances: masters copy their data into every instance, and instance layers are rebuilt from their master. To target a layer inside an instance, such as one tab of a tab bar, reference the instance and name the layer with `part`; the part must match exactly one layer name inside it. Cloning a referenced node copies its reference, so `render`, `prototype`, `inspect screen`, and `validate canvas` fail until the copy's reference is cleared.

Numeric node IDs such as `'0:12'` are still accepted for existing projects, with a warning, because they break silently when the document changes.

```yaml
version: 1
initialScreen: collection
screens:
  collection:
    frame: collection
    title: 'Coleção de livros'
    content: 'Lista pessoal com três livros. O primeiro está em leitura e abre o detalhe.'
    actions:
      open-detail:
        node: open-detail
        label: 'Abrir detalhes do livro'
        event: click
        action: navigate
        target: detail
      open-profile:
        node: tab-bar
        part: tab-profile
        label: 'Abrir perfil'
        action: navigate
        target: profile
  detail:
    frame: detail-screen
    title: 'Detalhes do livro'
    content: 'Título, autoria, estado de leitura e nota pessoal do livro selecionado.'
    actions:
      back:
        node: back-button
        label: 'Voltar para a coleção'
        event: click
        action: back
```

Use `inspect screen <screen> --json` to confirm bounds and warnings.

Give screens a `title` and `content`, and actions a `label`, in the project's language. These are required. `content` should include all meaningful visible information because the PNG itself has empty alternative text. The runtime presents this content to screen readers while preserving the visual image.

## Geometry checks

- A screen `frame` must be a top-level frame of a page. Anything else is rejected before export, so a stale reference cannot overwrite a render.
- `render` fails when the exported PNG is larger than the frame, which happens when content extends past an unclipped frame. Enable `clipsContent` on screen frames or keep content inside them. `prototype` also rejects renders whose size no longer matches their frame.
- A hotspot must lie inside its frame. Headless OpenPencil does not measure text and reports text nodes as 100×100, so a text action node that still has that default size produces a warning; size it explicitly or use a sized container or a transparent hit area instead.
- `prototype` and `validate canvas` warn about screens that no action target can reach from `initialScreen`.

## Actions

| Action          | Additional fields                        | Result                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate`      | `target` screen ID                       | Open another screen and add browser-like history.                                                                                                                                                                                                                                                                       |
| `back`          | none                                     | Return to the previous screen.                                                                                                                                                                                                                                                                                          |
| `open-overlay`  | `target` screen ID, optional `placement` | Show the target screen as a modal dialog centered above the dimmed, inert current screen; focus moves into it, and Escape or a backdrop click closes it. Size the overlay frame to its content. With `placement: bottom` it is anchored to the bottom edge of the current screen, at the same scale, for bottom sheets. |
| `close-overlay` | none                                     | Close the overlay.                                                                                                                                                                                                                                                                                                      |
| `set-state`     | `key`, `value`, optional `target`        | Store runtime state; optionally navigate.                                                                                                                                                                                                                                                                               |
| `external-link` | HTTP(S) `url`                            | Open a link in a new tab.                                                                                                                                                                                                                                                                                               |

Any action can add `when: {key: ..., value: ...}` to become available only when that state has been set. When several active actions share a node, only the one declared last gets a hotspot, so pointer, keyboard, and screen reader users all reach the same action; `covered-action` warns when an action can never be clicked because a later one on the same node is active whenever it is. Declare the default action first and the state-specific override after it on the same node. The runtime keeps state in memory for the current visit. It does not synthesize visual states inside a PNG: use a target screen when the visual response must change. To simulate an outcome the prototype cannot compute, such as a server error or a resource conflict, declare a scenario, or let a first attempt that fails set the state, and give the overriding action a `when` that leads to the matching state screen. The exit from an error state leads to a screen that reflects the error and lets the user complete the task by another path: a retry may succeed after a transient failure, but a resource someone else just took stays unavailable and the user finishes with another one.

Keyboard focus follows each action. A screen change moves focus to the new screen's title, which screen readers announce. A `set-state` without a target keeps focus on the same hotspot, which may now run a different action. Closing an overlay, by action, Escape, or backdrop click, returns focus to the hotspot that opened it.

## Scenarios

Scenarios simulate outcomes outside the product's control, such as a server response or an expired deadline, without drawing simulation controls into product frames. Declare them at the top level of `interactions.yaml`:

```yaml
scenarios:
  - key: outcome
    label: Server response
    initial: ok
    values:
      - { value: ok, label: Success }
      - { value: error, label: Server error }
```

The prototype shows a panel beside the screens with one labeled control per scenario and a Reset button. Each scenario sets its key to `initial` when the prototype opens, so a default action can already be gated by `when`. Changing a control sets the key and redraws the current screen, keeping focus in the panel. Reset restores the initial values, clears other state and history, and returns to `initialScreen`. Overlays never make the panel inert. Keep `set-state` for choices the product user makes.

`prototype` rejects duplicate scenario keys, duplicate values, and an `initial` that is not one of the values. It warns `unused-scenario` when no action's `when` uses a scenario key, and `unknown-scenario-value` when a `when` on a scenario key waits for a value the scenario does not declare.
