# Visibility and text-format verification

This report tracks execution and remaining candidates, not blanket visual approval. Standard editor and viewer contact sheets were inspected for all 41 types. Before-fix sunburst captures preceded animation; use the dedicated settled clipping screenshots for that visual.

Fresh before and after runs: 1230 / 1230 cases, 41 types × 2 hosts × 15 states. DOM clipping candidates: 164 → 156. Each requires ellipsis/scroll/compact-state classification. Canvas labels are covered separately for the repaired column, not exhaustively across all ECharts marks.

| Visual | Executed after | Before candidates | After candidates | Visual acceptance |
|---|---:|---:|---:|---|
| kpi | 30/30 | 2 | 2 | Needs candidate review |
| bar | 30/30 | 2 | 2 | Needs candidate review |
| stacked_bar | 30/30 | 3 | 3 | Needs candidate review |
| line | 30/30 | 2 | 2 | Needs candidate review |
| area | 30/30 | 2 | 2 | Needs candidate review |
| donut | 30/30 | 2 | 2 | Needs candidate review |
| pie | 30/30 | 2 | 2 | Needs candidate review |
| gauge | 30/30 | 2 | 2 | Needs candidate review |
| radar | 30/30 | 2 | 2 | Needs candidate review |
| scatter | 30/30 | 2 | 2 | Needs candidate review |
| bubble | 30/30 | 2 | 2 | Needs candidate review |
| treemap | 30/30 | 2 | 2 | Needs candidate review |
| funnel | 30/30 | 6 | 6 | Needs candidate review |
| sankey | 30/30 | 6 | 6 | Needs candidate review |
| table | 30/30 | 24 | 24 | Needs candidate review |
| column | 30/30 | 2 | 2 | Needs candidate review |
| waterfall | 30/30 | 15 | 6 | Needs candidate review |
| lollipop | 30/30 | 2 | 2 | Needs candidate review |
| bullet | 30/30 | 3 | 3 | Needs candidate review |
| progress | 30/30 | 3 | 3 | Needs candidate review |
| heatmap | 30/30 | 2 | 2 | Needs candidate review |
| ranked_list | 30/30 | 10 | 10 | Needs candidate review |
| stat_card | 30/30 | 4 | 4 | Needs candidate review |
| metric_tile | 30/30 | 3 | 3 | Needs candidate review |
| grouped_bar | 30/30 | 3 | 3 | Needs candidate review |
| stacked_area | 30/30 | 3 | 3 | Needs candidate review |
| sparkline_kpi | 30/30 | 4 | 4 | Needs candidate review |
| slope | 30/30 | 2 | 2 | Needs candidate review |
| bump | 30/30 | 2 | 2 | Needs candidate review |
| chord | 30/30 | 6 | 6 | Needs candidate review |
| sunburst | 30/30 | 2 | 2 | Needs candidate review |
| narrative | 30/30 | 4 | 4 | Needs candidate review |
| insight | 30/30 | 4 | 4 | Needs candidate review |
| waffle | 30/30 | 8 | 8 | Needs candidate review |
| bar_race | 30/30 | 8 | 8 | Needs candidate review |
| nav_button | 30/30 | 2 | 2 | Needs candidate review |
| text_box | 30/30 | 3 | 4 | Needs candidate review |
| shape | 30/30 | 2 | 2 | Needs candidate review |
| image | 30/30 | 2 | 2 | Needs candidate review |
| divider | 30/30 | 2 | 2 | Needs candidate review |
| custom | 30/30 | 2 | 2 | Needs candidate review |

## Verified repairs

- TEXT-FORMAT-001: selected pixel size after italic; mixed bold/italic content retained and reopened.
- TEXT-CLIP-001: long text fits the content box and remains scrollable in both hosts.
- VIS-COLUMN-001: canvas maximum label stays within chart bounds.
- VIS-WATERFALL-001: reserves vertical room for labels without changing cumulative values.
- VIS-SUNBURST-001: percentages placed inside the ring; small segments retain tooltip access. Respects disabled animations and available height.

## Remaining acceptance gaps

Text formatting tests cover actual inspector italic/size actions, base style mutation, Escape commit, and reopened HTML. They do not certify every selection/font/colour/token/undo combination. Empty/error/tiny/large-font cases are execution coverage, not proof of readable output. Native interaction coverage remains representative; Ctrl multi-select is still failing. Four baseline unit failures remain. Live cloud data/LLM requests, packaged installer and export acceptance are not included.

Additional confirmed host parity issues and pending boundary-mark investigations are tracked in bug-log.md.

## Final focused follow-up

After the broad sweep, NAV-LABEL-001, TEXT-FONT-002 and TEXT-TOKEN-002 were repaired and tested with focused cases. The broad sweep was not repeated for these three narrow changes. Navigation gallery screenshots were refreshed; JSON sweep snapshots retain the pre-navigation-fix text.

- Active rich-text controls: 50/50 pass, including all offered font-family and size options, bold/italic/underline, colour, all three alignments, partial selection, live token insertion, commit and reopening. Computed font-family verifies requested CSS, not installation or glyph coverage of every font.
- Text-box base styling, long content and mixed-style reopening: 24/24 pass.
- Clipping scenarios: 6/6 pass with before/after screenshots.
- Navigation label and destination: 3/3 pass.
- Shared-title suite: 240 applicable assertions pass, two internal-header exclusions.
- Full final unit suite: 450 pass, same four baseline failures (`visibility-final-suite.json`).

Unresolved controls UX: toolbar lacks clear active/mixed-format indicators and several controls lack accessible names. Keyboard-only use, undo and every live-token filtering combination still need dedicated acceptance. No full-product approval is implied.

Final main UI, standalone and Fabric embed builds all passed in isolated cache/qa-build/*-visibility-final outputs (25.93s /22.00s /17.54s). Existing chunk-size/toolchain warnings remain. No installer was built.

Sweep runner exit code1 reflects its36 intentionally injected `QA query failure` console entries; report.complete is true and no unexpected console messages were recorded. Execution completion is not visual acceptance. Text overflow checks measure bounds/CSS scrollability; native mouse-wheel and keyboard scrolling, especially through editor drag overlays, still need explicit interaction checks.
