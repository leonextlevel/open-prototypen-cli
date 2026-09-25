# Prototype interactions

`docs/design/prototype/interactions.yaml` maps screen IDs to OpenPencil frame IDs and action IDs to descendant nodes. Frames may live on different pages of the same `.fig`; shared screens need only one frame. Rendered screen images are derived from these frames. Node geometry determines hotspot positions.

```yaml
version: 1
initialScreen: collection
screens:
  collection:
    frame: '0:10'
    title: 'Coleção de livros'
    content: 'Lista pessoal com três livros. O primeiro está em leitura e abre o detalhe.'
    actions:
      open-detail:
        node: '0:15'
        label: 'Abrir detalhes do livro'
        event: click
        action: navigate
        target: detail
  detail:
    frame: '0:20'
    title: 'Detalhes do livro'
    content: 'Título, autoria, estado de leitura e nota pessoal do livro selecionado.'
    actions:
      back:
        node: '0:25'
        label: 'Voltar para a coleção'
        event: click
        action: back
```

Use `inspect canvas --json` to find IDs on every page after saving the `.fig`, and `inspect screen <id> --json` to confirm bounds. The supported actions are:

Give screens a `title` and `content`, and actions a `label`, in the project's language. These are required. `content` should include all meaningful visible information because the PNG itself has empty alternative text. The runtime presents this content to screen readers while preserving the visual image.

| Action          | Additional fields                 | Result                                            |
| --------------- | --------------------------------- | ------------------------------------------------- |
| `navigate`      | `target` screen ID                | Open another screen and add browser-like history. |
| `back`          | none                              | Return to the previous screen.                    |
| `open-overlay`  | `target` screen ID                | Show a screen above the current screen.           |
| `close-overlay` | none                              | Close the overlay.                                |
| `set-state`     | `key`, `value`, optional `target` | Store runtime state; optionally navigate.         |
| `external-link` | HTTP(S) `url`                     | Open a link in a new tab.                         |

Any action can add `when: {key: ..., value: ...}` to become available only when that state has been set. The runtime keeps state in memory for the current visit. It does not synthesize visual states inside a PNG: use a target screen when the visual response must change.
