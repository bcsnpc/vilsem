# Desktop follow-up, 2026-11-05

The owned `Stress3 Theme Light` PBIP was reopened through Microsoft's Desktop
bridge after the user confirmed that the earlier window was closed. Desktop
PID20988 exposes Analysis Services on port62071; discovery used
`process-workspace-port-file`. Store installation discovery required an explicit
`PBI_DESKTOP_PATH` for the bridge CLI. No global environment setting was changed.
The original PBIP was not edited. All21 baseline semantic-model hashes match.

The reopened report reports `hasUnsavedChanges:false`. The bridge reloaded report
definitions with `reloadModelDefinition:false`. Twenty-four owned detail pages
make each exercise independently inspectable at1280x720. These contain copied
vilsem visuals only; no native visuals, slicers, themes or model objects were
created or modified.

## What was inspected

* Eleven expression examples: marks, geometry and readable labels are visible in
  native bridge captures. This is native static rendering evidence for all11,
  separate from their earlier real-data tool and SSR passes. The first beeswarm
  capture timed out; its retry succeeded. An Auto Recovery banner obscures page
  headings, so title/bounds acceptance is partial.
* Ten motion examples: native captures exist for each; the first bar capture
  timed out and its retry succeeded. Bar, bubble, treemap, tile heatmap, KPI,
  stagger and zoom captures show marks. The line's first frame originally had
  labels without visible marks; enabling4px symbols in the shipped example was
  tested with real data, committed to both owned copies and inspected natively.
* Sankey: earlier captures show a partially revealed entry frame. After lifecycle
  changes, the foreground bridge capture returned a blank report surface even
  though the user reported visible charts. This does not establish whether the
  remaining failure is capture-related or in the renderer. Native motion/export
  acceptance remains open; do not mark it verified.
* Morph, Tableau and Figma captures exposed missing currency axes when Cartesian
  series use named value objects. The core formatter now recognizes those bar,
  line and pictorial-bar projections. Automated coverage and real-data previews
  pass; all three currency-axis PNGs were inspected. Fresh native
  verification of this final change is still required.
* Three reference examples show real-model marks/values in native captures.
  Figma outer-card fidelity remains partial; the photographed experiment is not
  represented as actual model data.

Evidence stays private in `cache/round3-d-native-details` and
`cache/round3-d-native-motion-reference`. Original failed captures are retained.
Static captures do not prove autoplay, interaction behavior, PDF exports or
subscriptions.

## Interaction and lifecycle fixes

Aggregate context menus now use an exact shared category scope when one exists.
Irregular contributor sets, partial/segmented identities and stale host failures
fall back to a background context menu; they never use an arbitrary first row.
Single-row marks retain the complete multi-level identity. Host tests cover
event wiring, duplicate suppression and the selector rules.

Animated ECharts updates wait for the current chart's `finished` event and a
painted frame before reporting host completion. Autoplay starts afterwards.
Hidden initial frames explicitly finish trusted display-element animations and
flush the canvas without waiting on a throttled animation frame. Replacing a
visibility controller resumes the clock it owned. Regression tests cover hidden
completion, cancellation, failures and a real retained Chromium canvas tween.
These tests are not native export verification.

The refreshed Computer Use plugin was read and retried, including a kernel
reset and fresh client import. `sky.list_windows()` still fails with native
pipe unavailable, os error2. No guessed keyboard or
mouse input was sent. Physical click/Ctrl-click, native slicer/highlight,
drill-through, native/report-page tooltip, bookmark and Edit Interactions None
checks remain unverified. The user's foreground confirmation is not substituted
for those gestures.

Microsoft's repository has an open, independently reported
[Desktop capture-layout defect](https://github.com/microsoft/skills-for-fabric/issues/106):
successful snapshot calls can leave Desktop stuck in capture layout, including
at scale1 and on Store builds. This is a plausible explanation for some host
symptoms, not proof that our Sankey clip is correct. Repeated bridge captures
were stopped after finding this report. No unsupported window-capture or input
workaround was installed. Our lifecycle behavior follows Microsoft's
[render-event contract](https://learn.microsoft.com/en-us/power-bi/developer/visuals/event-service);
native capture/export still needs independent verification.

## Performance

The5000-point target remains FAIL. A new QA-only grouped-translation experiment
retained5000 individual symbols, per-point styles and click/context identities,
but measured15.67 RAF fps and116.9ms p95. It is not enabled in the product.
Neither this experiment nor the earlier batch prototype measures Power BI host
frame rate. No points were removed and animation was not disabled to claim a pass.
