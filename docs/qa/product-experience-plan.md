# Product experience priorities

Desktop rendering remains the reference for web, Fabric and Power BI. UX work must preserve saved specs, field semantics and existing interactions. Local smoke tests do not certify deployed equivalence.

## Intended user journey

1. Connect data and understand available fields, with clear connection and query errors.
2. Choose a visual or describe an analytical question; explain the proposed field assignments before applying ambiguous changes.
3. Preview real results and identify missing fields without exposing template code as a prerequisite.
4. Format through consistent named sections, searchable controls and contextual help; retain advanced visual-specific options.
5. Recover from mistakes through undo, retry and explicit save state.
6. Present or publish with a target-specific compatibility report and matching data, typography, colors, bounds and interactions.

## Ordered acceptance work

| Priority | Improvement | Acceptance evidence required |
|---|---|---|
| P1 | Playground responsive panes and reliable save feedback | Narrow/wide running UI; delayed save, failure and retry |
| P1 | Export fidelity and compatibility | All41 types through real target packages; matched data/options/geometry/screenshots; deployed filtering |
| P1 | Playground-to-library-to-canvas workflow | Save, reopen library, insert, edit and persist custom visuals |
| P1 | Clipping and accessible controls | Small containers, long labels, keyboard navigation and readable contrast |
| P2 | Searchable consistent formatting | Every applicable setting discoverable, edits verified in renderer, no invalid controls |
| P2 | Guided visual setup | Required field roles named; missing bindings identified; empty vs loading vs failure distinguished |
| P2 | Recoverable intelligent editing | Reviewable supported operations, undo, invalid operation rejection and live-provider checks |
| P2 | Progressive disclosure in Playground | Visual-first workflow with advanced template editor still available; no lost template or bindings |
| P3 | Contextual help and shortcuts | Concise help tied to actual operations; shortcut and focus tests |

Current delivery is incremental. This plan is not a claim that the above capabilities are implemented or fully tested. See bug-log.md and full-round-report.md for evidence and limitations.
