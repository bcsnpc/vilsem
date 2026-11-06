# Round 3 follow-up: current verification

Updated 2026-11-06. This supersedes the 0.7.0 and 0.7.1 checkpoints; their tags,
assets and earlier failed test logs remain unchanged. Group C is an evaluation
prerelease, not production acceptance. Groups A/B remain published as 0.5/0.6.

## Delivered fixes

- Core 0.7.1 added bounded `viewportWidth`/`viewportHeight` expression operations.
  The Figma example now draws an inset rounded panel that recomputes on resize.
  Its axis spacing was corrected after inspection. Viewport operations require
  renderer 4.41; other original 0.7 expressions retain their 4.40 reader floor.
- Core 0.7.2 / renderer 4.42 preserves authored opacity for explicitly silent
  annotation leaves. Interactive marks still dim on selection/highlight. The
  reader floor covers literal and conditional/parameterized silent annotations.
  The renderer GUID and legacy `semantica.primitiveSpec` property are unchanged.
- MCP 0.7.2 fixes reference-card contrast under a dark report theme and excludes
  proven static viewport decoration from measured-series/palette counts and
  zero-data warnings. Real zeros and data-dependent annotations remain checked.
  An explicit opaque chart background takes precedence in global text-contrast
  feedback. Filled-mark contrast still needs visual review.
- MCP 0.7.3 fixes edits/validation of existing Vilsem visuals whose official
  Microsoft 2.x container declaration advanced beyond the bundled schema. The
  entire payload must fit the known 2.7 contract; unknown fields/malformed data
  are refused. `containerValidation` explicitly discloses that full validation
  against the declared schema was not performed. The declaration, query, layout
  and manual formatting are preserved. New commits still use the bundled
  schema. Native objects remain outside MCP editing/validation scope.

## Test and build evidence

| Check | Result |
|---|---|
| Private app/core | 1,357/1,357 PASS, bounded workers, unchanged deadlines/assertions |
| Public app/core | 1,357/1,357 PASS on the same implementation |
| Full build | Native, UI, Fabric, Electron and NSIS PASS; independent native resource contents match |
| Frozen MCP 0.7.2 with public core | 303/303 PASS, 13 files, 602.13 seconds |
| Frozen MCP 0.7.3 with public core | 311/311 PASS, 14 files, 610.07 seconds |
| Responsive card | Real Chromium: 900x550 -> 320x240 -> 40x24 -> 900x550; exact return bounds and data/decorative click isolation PASS |
| Selection regression | Before: panel opacity 0.25; after: panel 1, bars 0.25/1; blank-area click routing PASS |
| Theme regression | Actual SVG text and model currency formatting PASS in light/dark; authored fixed light palette is intentional |
| Compatibility regression | Eight tests: newer declaration, complete known contract, nonmutation, malformed/unknown-field rejection, no external fetch, edit preservation and custom-only scope PASS |
| Audits | Root 6 moderate; native tooling 13 moderate/4 low; UI/MCP 0; high/critical 0 |
| Model preservation | All 21 owned semantic-model baseline files unchanged; original PBIP untouched |

The tiny-container check proves panel geometry, not readability of an entire
chart at 40x24. Browser mocks/geometry do not certify Power BI interactions.
Earlier failures are retained: loaded test runs timed out or observed an older
module during a late source edit. Fresh frozen runs above passed without
changing assertions or increasing canonical deadlines.

Private logs: `round3-g-core-tests.log` in each app checkout;
MCP `round3-i-tests.log`, `round3-j-tests.log` and focused feedback/browser logs.
The current full app build is `cache/round3-h-app-build.log`.
No new app installer was published; its existing build remains unsigned,
uses the default icon and retains application version 1.0.0-beta.3.

## Live model and distribution

Desktop AS port 62071 was auto-discovered by `process-workspace-port-file`.
The published MCP 0.7.1 connection/schema workflow returned 13 tables and 39
measures. Published 0.7.2 validated/explained/previewed six real country rows,
saved both the reference and interaction-template visual, and left all 15
native fixture files unchanged. Model connection code is unchanged in 0.7.3.

Fresh normal public-URL and Git-tag 0.7.2 installations pass stdio handshake,
19 tools/one prompt, viewport-spec validation and resource checks, with audit 0,
no app-path variable, no development symlink and no dependency override.
Public asset hashes match the tested archives. The original 0.7.2 validator
reported 168/170 custom visuals valid: the other two used Desktop's 2.14.0
declaration, whose official schema URL returned HTTP 404. Both real-data
read/previews passed and their complete field structures passed the known
contract on in-memory clones. This led to PBIR-COMPAT-030 and the 0.7.3 fix.

Final 0.7.3 packaged live-edit/public-install acceptance is recorded below.

## Native acceptance is blocked

Both supported computer-use interfaces fail to connect to the native helper
pipe with OS error 2. No unsupported input workaround was used. Asking the
user to foreground Desktop does not repair this helper. Bridge snapshots had
previously destabilized capture layout, so no further captures were requested.
Guarded state/report-only reload acceptance does not prove paint or gestures.

Six coexistence pages were prepared outside MCP in the owned QA report:
19 new visuals (four Vilsem, 15 native), actual model bindings, explicit
filter/highlight/NoFilter references, drillthrough and standard/report-page
tooltip fixtures. Microsoft schema, bounds and reference checks pass. Existing
pages/visuals/report settings were preserved during fixture creation, and all
21 model files remain unchanged. No fake bookmark state was written.

See [native-interaction-checklist.md](native-interaction-checklist.md) for
click/Ctrl/clear, slicer/highlight, drillthrough, tooltips, bookmarks, keyboard,
resize and export checks. They remain BLOCKED/UNVERIFIED, including the final
native Sankey/currency-axis and PDF/subscription rechecks.

## Performance remains failed

The isolated repeat with an unmodified real clock measured idle 60.42 RAF fps
(p95 16.9ms), canvas 11.22 (266.5ms), dirty-rectangle canvas 12.52 (233.3ms),
and SVG 8.62 (250ms). All 5,000 points and animation remain enabled. These are
pure ECharts browser measurements, not Power BI host measurements. The target
is at least 57 RAF fps and p95 at most 20ms; every chart run FAILS. No point
removal, hidden animation disabling or rejected batching experiment is enabled.

The benchmark bypasses the spec interpreter. ECharts' animation guidance can
reduce/disable animation, but that does not meet the requested animated target.
The latest checked ECharts version is already 6.1.0. Previously rejected batch
and grouped prototypes have unresolved performance/style/interaction/native
parity gates. See [batch-motion.md](../../engineering/batch-motion.md).
The portable synthetic benchmark is MCP `scripts/benchmark-motion.mjs`; the
latest private result is `test-results/stress3/round3-f-performance.json`.

Sources: [ECharts animation guidance](https://echarts.apache.org/handbook/en/how-to/animation/transition/)
and [upstream progressive-data issue](https://github.com/apache/echarts/issues/21434).
Exact area-proportional Euler fitting, unshipped geographic assets and 3D remain
explicit format limits. Schematic Venn circles do not imply exact area fitting.

## MCP 0.7.3 packaged live acceptance

Before publication, the isolated packed candidate connected to Desktop 62071,
read/previewed both actual 2.14-declared QA visuals, performed ETag-protected
title dry runs and saved edits, then restored their original titles. Both
migrated specs, queries, positions, schema declarations and manual formatting
were preserved. A legacy unversioned spec can acquire its normal specVersion
migration during a save; no container-schema retag occurs. The initial overly
strict whole-file equality assertion caught that expected migration and is
retained in the private acceptance log. The corrected check compares migrated
specs and separately requires every surrounding container field unchanged.

`validate_visuals` now returns 170/170 valid Vilsem visuals, with exactly two
explicit known-2.7-contract warnings and zero native objects reported. All 15
native fixture files remain byte-identical. The model's 21 baseline hashes
remain unchanged. The final guarded report-only reload accepted renderer 4.42
with a clean owned report; no capture/input was requested and no native paint
or gesture PASS is inferred.

Core 0.7.2 is published at aba7112; MCP 0.7.3 at a9b31e9. Both public main
branches contain the tested changes; evaluation prereleases do not replace
stable 0.6. The private app source is also pushed. All prior tags/assets remain
immutable. Downloaded assets have these SHA256 values:

| Asset | SHA256 |
|---|---|
| Core 0.7.2 | ad838693fe9531de5be68aea610d29d1ba78d2173eecb402390b2054ab07ddca |
| Renderer 4.42 | 391f271d7976e651caa50544af5527d46e90a8238060725b8c74a9d7cd4a4fbc |
| MCP 0.7.3 | 3bb36a77b9b3fd821bc16617c57eaa553157f888c0bb6cf2d121f68efbb360aa |

Releases: [core-v0.7.2](https://github.com/bcsnpc/vilsem/releases/tag/core-v0.7.2)
and [MCP v0.7.3](https://github.com/bcsnpc/vilsem-mcp/releases/tag/v0.7.3).

Fresh public-URL and documented Git-tag installs of MCP 0.7.3 both PASS:
normal npm install, audit 0, stdio handshake, 19 tools/one prompt, viewport-spec
validation and documentation resources. Both use genuine core 0.7.2 installs
with no app path, development link or dependency override. The actual public-
URL installation connects to Desktop 62071 and validates 170/170 Vilsem visuals,
including the two explicit known-contract warnings. Downloaded archive SHA256
matches the pre-publication candidate above. Raw live-model evidence is private.
