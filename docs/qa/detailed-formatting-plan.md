# Detailed formatting and AI editing acceptance

## Product requirement
Every supported visual needs detailed, discoverable formatting. Equivalent concepts use equivalent pane groups and labels. Controls must have a visible effect and preserve unrelated settings. AI must use the same supported configuration contract. Unsupported features must be identified explicitly; accepting a JSON key is not proof of support.

## Per-visual checklist
| Group | Required audit coverage |
| --- | --- |
| Container | Background, opacity, border color/width/style/radius, shadow, padding, size, responsive minimums, clipping |
| Title/subtitle | Visibility, text, family, size, weight, style, color, alignment, wrapping, spacing |
| Series | Every measure/category color, opacity, stroke, width/style, marker shape/size, hover/selected/unselected style |
| Primary axes | Axis line/tick/grid color and width, labels/font/rotation/wrapping, title, position, domain, units, decimals, prefix/suffix |
| Secondary axes | Whether independently scaled axes exist; series assignment; independent visibility, title, font, color, grid, domain and number format |
| Labels | Visibility, content, placement, color, font, number format, overlap and boundary handling |
| Legend | Visibility, placement, alignment, fonts/colors, spacing, symbols, wrap/scroll, interaction |
| Tooltip | Visibility, fields, number formats, text/background/border, edge positioning, null handling |
| Visual-specific | All exposed controls, including table headers/cells/totals, KPI deltas/sparklines, gauge ranges, text formatting, playback and drill |
| Reset/persistence | Clear override restores defaults; save/reopen and unrelated edits retain explicit values |

## Validation per control
1. Record visual ID, config path, pane location, allowed values and default.
2. Trace UI change through state to the renderer consuming that exact path.
3. Exercise default, nondefault, boundary and reset values with deterministic data.
4. Verify rendered effect, small-container behavior and unchanged unrelated properties.
5. Repeat in supported app/web/Fabric/Power BI/local-report targets; mark unsupported and untested separately.
6. During the AI phase, test real prompts for direct, combined, scoped and ambiguous edits; validate patch, rendered result and preservation. Include undo/recovery and invalid-value rejection.

## Confirmed source gaps
- `LineMarks` emits one Y-axis for both primary and secondary series. `secondaryColor` styles a series, not an independent right-side scale. Dual-axis support needs domain, assignment and target tests before new pane controls.
- `axisTextConfig.js` applies the same `yAxisLabel*` overrides to all Y-axis entries. Independent secondary-axis typography is absent from `axisFormattingSchema.js`.
- Existing AI coverage is permissive field transport. Live prompt-to-render semantic coverage is not complete; see `../ai-ui-parity-matrix.md`.

## Work order
Non-AI formatting/rendering and target correctness first, AI configuration/edit effectiveness next, local Ollama last. This document defines acceptance; it does not certify that the checklist is implemented or tested.
