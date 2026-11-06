# Round3 release readiness

> Current checkpoint: core 0.7.2 / renderer 4.42 and MCP 0.7.3 are published
> evaluation patches. App-core 1,357 tests per checkout and MCP 311 tests pass.
> Real-data compatibility edits and 170/170 custom-visual validation pass; two
> known-contract warnings remain explicit. Native acceptance is blocked; the
> animated 5,000-point target fails. See [current follow-up](round3-follow-up.md).
> Earlier version-specific results below are historical.


Groups A and B are published as0.5 and0.6. Group C is published as a0.7
**evaluation prerelease**, preserving the stable0.6 release channel. A prerelease
does not convert a failed or blocked check into PASS.

The full private app/core suite passes1353 tests after the final hidden-Sankey
fix. Source/host tests and real-data tool workflows remain distinct from native
acceptance. Final public/MCP/build/package counts are recorded in the candidate
ledger after their frozen-source runs.

## Final correctness fix

`stopAnimation(true)` forwards values but aborts completion callbacks. ECharts
removes Sankey's temporary entry clip in a completion callback. Keeping that
clip cropped the right label even after its width reached the final value.
Renderer4.40 now completes trusted engine clips normally and snapshots elements
before callbacks can remove siblings. It does not delete permanent plot clips.
A real Chromium canvas regression fails before the fix and then exactly matches
the static, non-animated frame after the fix. Unit tests cover callback order,
permanent clips and sibling-removal safety. Native Desktop PDF/subscription
behavior remains unverified.

## Failed or blocked acceptance

* Native click/Ctrl-click, slicer/highlight, configured drill-through,
  native/report-page tooltip, bookmark and Edit Interactions None gestures:
  BLOCKED by Computer Use's unavailable native pipe, os error2. The current
  report is open and clean; repeatedly asking the user to restore it does not
  repair that helper. No unsupported input workaround is used.
* Native Sankey/motion/export and final currency-axis recheck: UNVERIFIED.
  Bridge snapshots are partial/blank and can destabilize capture layout;
  static native captures and browser regressions are retained separately.
*5000-point60fps: FAIL. Regular, batch, grouped-translation, dirty-rectangle and
  SVG experiments do not meet the target with all required semantics. No point
  dropping or hidden animation disabling is used to claim a pass.
* Reference mockup outer-card styling: PARTIAL. The reference workflow is
  complete, with actual model values rather than copied reference numbers;
  the reported styling mismatch remains an enhancement.

The original report/model is untouched;21 owned QA model-definition hashes must
remain identical. Arbitrary exact area-proportional Euler fitting, map assets
and3D remain documented limitations, not promises of this release.

## Publication sequence

1. Finish public/core tests, matching renderer build and package checks.
2. Fast-forward public main from its own sanitized feature branch; publish
   `core-v0.7.0` as a GitHub prerelease with the tested core and renderer assets.
3. Change MCP to the actual core0.7 URL; install it without a development link,
   run the full suite, and verify an isolated public-URL install/live model.
4. Fast-forward MCP main; publish `v0.7.0` as a GitHub prerelease and verify its
   downloaded artifact. Push private source/docs without merging private
   history into the public app repository.

Keep the failed/blocked acceptance list in READMEs and release notes. The final
report must say what shipped and what remains unverified.

Publication completed: core-v0.7.0 at87458f3 and MCPv0.7.0 atc9f887c,
both GitHub prereleases, with tested source fast-forwarded to public main.
Downloaded asset hashes match. Fresh normal installs from the actual release
URLs and from the documented MCP Git tag pass with audit0 and no app link or
dependency override. The release-URL install also passes real Desktop model
queries/preview/commit and installed final-frame pixel checks. Full MCP299tests
pass against the downloaded core. Source/installer checks do not complete the
failed/blocked native and FPS acceptance listed above.
