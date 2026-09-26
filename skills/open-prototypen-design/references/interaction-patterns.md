# Interaction patterns

Read this when choosing navigation, action hierarchy, overlays, safeguards for destructive actions, or how to show a collection. Patterns are choices that depend on context, not fixed answers. Weigh the user's goal, how often they do the task, the risk, the amount of content, platform conventions, the space available, accessibility, and the patterns the product already uses. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Navigation and information architecture

- **Heuristic.** Give each navigation pattern its role:
  - Global navigation moves between the product's main areas.
  - Local navigation moves within one area.
  - Tabs switch between a few closely related peer views of the same thing, not between unrelated areas and not through the steps of a process.
  - Breadcrumbs show a place in a hierarchy, not progress through a wizard; use a step indicator for that.
  - Back navigation returns to where the user came from.
  - Trees fit deep hierarchies that users browse.
  - Search and a command palette serve users who know what they want.
- **Default.** Keep navigation labels short, in the user's words, and the same wherever they appear, and always show the current location.
- **Heuristic.** Search does not make up for a weak structure; users who cannot name what they want need browsable categories.
- **Heuristic.** A side drawer is not the automatic mobile form of every sidebar. Consider a bottom tab bar for a few frequent areas, or a single screen with sections, depending on how often users switch.

## Actions

- **Default.** Label actions with their outcome, such as "Create project" or "Delete file". Generic labels such as "Submit", "OK", or "Confirm" are acceptable only where the context makes the outcome unmistakable.
- **Default.** Give each decision context one primary action, and rank the rest as secondary, tertiary, or destructive. Several primary buttons make the user choose which one matters.
- **Heuristic.** Represent only the states the flows need: default, hover, pressed, focus, disabled, and loading. A disabled action should say, nearby, why it is unavailable.

## Overlays

Choose by how much the task should interrupt the user:

- **Heuristic.** A dialog holds a focused task that must finish or be cancelled before going on; never open a dialog from a dialog. An alert dialog asks for an explicit decision and names it in its buttons. In the prototype, both are `open-overlay` with a target screen sized to its content, centered over the dimmed screen.
- **Heuristic.** A bottom sheet holds a short task or options on mobile; use `open-overlay` with `placement: bottom`.
- **Heuristic.** A drawer holds supplementary work while the parent stays visible, not a whole application. A popover holds light controls next to what they affect. The runtime has no side or anchored overlays, so draw the parent with the drawer or popover open as a screen variant (`base` with `shown`) and reach it with `navigate` or `set-state`.
- **Default.** Prefer inline editing or disclosure to an overlay when the change is small and the context matters.

## Destructive actions

- **Default.** Scale safeguards to the impact: undo for reversible actions, a trash or soft delete for recoverable ones, and a confirmation that names the object and states the consequence for permanent ones. Harmless actions need no confirmation.
- **Default.** Confirmation buttons say what happens, such as "Delete 3 files", not "Yes" or "OK", and the destructive button is not the default focus.

## Collections

- **Heuristic.** Use a table when users compare the same fields across items, a list for items with flexible supporting content, and cards when each item needs its own containment, media, or actions. A grid of cards is not the default for every collection.
- **Default.** For data-heavy tables, decide column priority and what hides first, right-align numbers, and represent sorting, filtering, selection, row actions, overflow of long values, and the loading and empty states the flows need.

## Components

- **Default.** Create a component for structure or behavior that repeats, not for a one-off group; record justified one-offs as the component review skill describes.
- **Heuristic.** For important components, decide the anatomy, variants, states, sizes, how content behaves when long or missing, and overflow.

## Sources

- Nielsen Norman Group, [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [tabs used right](https://www.nngroup.com/articles/tabs-used-right/), [breadcrumbs](https://www.nngroup.com/articles/breadcrumbs/), and [modal and nonmodal dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/): the roles of tabs and breadcrumbs, when to interrupt with a modal, and error prevention through confirmation.
- Apple, [HIG: buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): outcome-based labels and one prominent action.
- GOV.UK Design System, [patterns and components](https://design-system.service.gov.uk/): tables, step-by-step progress, and confirmation of destructive actions.
- The mapping to the prototype runtime reflects Open Prototypen's supported actions. Safeguards scaled to impact and the collection choices are this project's opinion, informed by the sources above.
