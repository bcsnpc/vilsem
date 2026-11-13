# Core 0.8.2 / Renderer 4.45

Fixes from a fresh-install test of vilsem-mcp 0.9.1 on a 10M-row model.

## Compact number formatting (renderer 4.45)

- New `formatterTemplate` token **`{value:compact}`**: `950`, `14.6K`, `$9.9B`, `1.2T`.
  - It keeps only the bound measure's **currency symbol** (`$`, `€`, `£`, `₹`) and never its unit literals, so units don't double.
  - Percent, date and text measures keep their own format.
  - Whole units read without a decimal (`$2B` axis ticks). Other values keep one decimal below 100 of a unit (`$2.0B` next to `$2.3B`).
  - Works with tuple components: `{value.0:compact}`.
- **Value axes:** an authored `axisLabel.formatterTemplate` now receives the measure format, instead of being replaced by it. `{value}` gives the same output as before; `{value:compact}` can scale it.
- **Version floor:** specs that use `compact` require Renderer **4.45**. `commit_visual` refuses a report whose registered renderer is older, with an upgrade message, rather than writing a visual that would fail.
- **Why it matters:** a visual can show `$9.9B` from a model measure without a scaled visual-scoped measure, so it stays Publish-to-web safe.

## Bounded schema profiling (agent context)

`enrichSchema` (used by `get_schema`) accepts:

- **`profile:false`:** fields, measures and formats with **no queries**. Measured at 18 ms on a 10M-row model, versus about 110 s for full profiling.
- **`samples:false`:** sample queries are now skipped, not run and then hidden.
- **`tables:[...]`:** profile only the named tables (case-insensitive).
- **A default 20-second budget:** no new profiling queries start after it. Unreached columns are marked `profileSkipped`, and `profileIncomplete` explains.

## Desktop connection errors

- **Several open sessions:** connecting without a port now lists each open session's port and `.pbip` path, and suggests `kind:"report"`, which matches the right window.
- **Model still loading:** instead of `Desktop must expose exactly one model`, the error says the session has no model loaded yet and to retry once it has loaded.

## Compatibility

- Renderer GUID `semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D` and `objects.semantica.primitiveSpec` are unchanged.
- Existing visuals render identically.
- Existing reports keep their registered renderer. To use `{value:compact}`, import the new `renderer.pbiviz` (Home > More visuals > From my files), accept **Update**, save, close and reopen.

## Verification

- **Tests:** the full public and private suites each pass (1,390 tests, none skipped). They include new tests for the compact formatter, the version floor, the schema options and the connect messages.
  - The renderer HTML-security browser tests now follow the built renderer version instead of a hard-coded 4.44.
  - The PowerShell bridge test has a realistic timeout for parallel runs.
- **Builds:** independent public and private production builds produce identical renderer JS and CSS hashes.
- **Live checks** on a 10M-row Contoso model, with three Power BI Desktop windows open:
  - report-binding connect matched the right window;
  - `profile:false` returned in 18 ms;
  - a `{value:compact}` preview from the plain `$#,0.00` model measure showed `$9.9B` / `$611M` labels and `$0 … $10B` axis ticks.
