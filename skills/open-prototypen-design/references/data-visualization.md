# Data visualization

Read this before adding a chart, a sparkline, or a metric tile. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## A question first

- **Default.** Every chart answers a named product question, such as "Is spending this month above the budget?", written in the screen map or the direction. A chart added to make a dashboard look complete answers nothing; leave the space to content.
- **Heuristic.** Choose the form from the question: a line for change over time, bars for comparing categories, a single number with context for one value that matters, and a table when users look up exact values.

## Color

- **Default.** Use as little color as possible: one color for a single series, and neutral gray for context such as previous periods or averages. Save the accent for what the question is about.
- **Default.** Keep categorical palettes small, around five or six colors at most; beyond that, group categories or use another encoding.
- **Constraint.** Do not rely on color alone to tell series apart ([WCAG 2.2, 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)); add direct labels, markers, or line styles. Chart marks that carry meaning need 3:1 contrast against the background ([1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).

## Labels and reading

- **Default.** Label series directly at the end of a line or on a bar instead of in a legend the eye must match. Label axes with units, and start bar axes at zero.
- **Heuristic.** Remove gridlines, borders, and 3D effects that do not help reading the values.

## Data and accessibility

- **Constraint.** Never present invented numbers as real metrics; mock data must look plausible for the domain and read as mock data, as [the content reference](content.md) explains.
- **Constraint.** The prototype's text alternative for a chart is the screen's `content` in `interactions.yaml`: state what the chart shows and its main takeaway, because the PNG has no text for screen readers.

## Sources

- Atlassian, [data visualization color](https://atlassian.design/foundations/color/data-visualization-color): small categorical palettes and color used sparingly.
- Carbon, [data visualization color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/): single-series color, categorical limits, and palette order.
- W3C, WCAG 2.2 Understanding: [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): the standards behind the color constraints.
- The question-first rule, the choice of form, direct labels, and removing chart decoration are this project's opinion, drawn from common data visualization practice.
