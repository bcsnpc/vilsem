# Settled clipping review

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

The corrected v3 sweep completed **1,230 unique cases**, 41 visual IDs × two hosts × fifteen data/size states. It captured 454 console error events, not 454 independent bugs. There are 164 cases with DOM text clipping candidates, 85 containing at least one non-ellipsis candidate. These counts do not include all canvas labels or non-text marks.

## VIS-HEATMAP-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Fit grid rows to available height. Default four-cell bounds pass in both hosts. See [fix status](fix-status.md).

- Area/category/severity: Heatmap / Edge clipping, layout / High (P1).
- Reproduce: Mount Heatmap at 480×320 with QA Category and Revenue values 25, 50, 75, 100, using default two-column layout. Repeat in editor and viewer.
- Expected: All four marks remain accessible within the chart's content area. Fit cells to available width and height or provide an explicit usable scroll policy.
- Actual: Width-driven square cells produce two rows about 436px tall. In editor, the lower cells extend to y=500 while the inner clipping boundary ends at y=330. Viewer lower cells extend to y≈502 while card ends at y=332. Most of the lower row is hidden.
- Evidence: `evidence/review-audit.json`, `evidence/screenshots/heatmap-editor-settled.png`, `heatmap-viewer-settled.png`. Visually inspected and measured after geometry settled.
- Root cause: `ui/src/appspec/visuals/CompactHeatmap.jsx` grid cells use `aspectRatio:'1'` with width-driven columns and no available-height bound. Host clipping hides the excess.
- Regression: `scripts/qa/review-audit.cjs` retains cell and clipping-ancestor bounds; convert the expected fully-visible-mark policy into an assertion with the eventual fix.

## VIS-SUNBURST-001

- Area/category/severity: Sunburst / Labels, clipping / Medium (P2).
- Reproduce: Standard four categories with values 25/50/75/100, default showLabels and outerRadius, 480×320 card. Wait for all four percentage labels to render.
- Expected: Enabled percentage labels are readable or deliberately repositioned/suppressed with accessible value information.
- Actual: Several percentage labels extend beyond the 220px square Recharts SVG and are cut; the 30% label remains visible. Reproduces after animation completion.
- Evidence: `evidence/review-audit.json` labelBounds and `evidence/screenshots/sunburst-editor-settled.png`; viewer captured separately.
- Root cause: `CompactSunburst.jsx` combines outerRadius 90% with outside labels inside a tightly bounded square SVG and no label-margin calculation.
- Status: Verified for the reproduced standard case in both hosts. Fix: reserve outside-label headroom for column/waterfall; position sunburst percentages inside the ring and fit available height. Evidence: evidence/clipping-fixes-after.json (6/6) and visually inspected after screenshots. Extreme size/large-font acceptance remains tracked separately.
- Regression: `scripts/qa/review-audit.cjs` waits for actual Recharts label completion and records label bounds against SVG bounds.

## Evidence corrections and expected policy

- Earlier standard Sunburst screenshot showed only a total because animation had not finished. This was not a blank-chart bug. The implementation unconditionally animates even with the audit config animation flag false; screenshots must wait for renderer-specific completion.
- Earlier bar screenshots cut the right side because chart resize had not settled. Corrected standard Bar capture contains all four values; no defect was logged from that artifact.
- DOM text measurement alone missed Heatmap entirely because default cells contain no visible text. Add mark bounds to clipping tests.
- Tables may legitimately scroll horizontally; truncated title/legend text may intentionally use ellipsis. Those candidates require accessible full-text/scroll interaction checks before classification.
- Small cards should use a defined compact state when labels cannot remain readable; negative/large values must stay in the plot; tooltips may escape the chart card but must stay in the viewport; neighboring visuals and inspector panels must remain unobscured. Do not solve every case with `overflow:hidden`.
- Current screenshots are diagnostic, not approved visual-regression baselines. DPR and animation readiness need explicit normalization before pixel comparisons.
