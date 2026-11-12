# Core 0.8.1 / Renderer 4.44 — S8/S9 verification

Prepared 2026-11-12. **Not pushed, tagged, merged or published.** Scope is S8
(raw HTML-measure fallback) and S9 (Desktop ADOMD discovery) only. S10, S11,
Electron security findings and MCP 0.9.1 dependency/release changes are deferred.

## Source of truth

- Public release: `bcsnpc/vilsem`, `core-v0.8.0`, Core 0.8.0 / Renderer 4.43.
  Downloaded baseline archive SHA256:
  `3bc7df2c045bf4dab4cf6c54c2207cf575efd76aabccd064f492a9b8da79ecfb`.
- All 118 shipped core source files match public `main` at `db44ceb`, ignoring
  checkout line endings. Private `origin/main` is `147536d`. Core/renderer source
  trees match between these bases; their old renderer ZIP containers differ but
  their JS/CSS payloads match. The public baseline asset matches the release hash
  `b95654e2d3b3aef93ba9b5ce0b80180f19eef21d0af63e5df88ab16aa105029f`.
- Previous packaging is documented in `docs/qa/skill-sharpness-080.md` and the
  public release notes: independently build/test private and public trees,
  compare native JS/CSS, publish the public archive/renderer. Public history
  deliberately excludes private history; never merge the private branch into it.
- Worktrees: `D:/vilsem-security-private` (`security/core-081-private`, based on
  private `origin/main`) and `D:/vilsem-security-public` (`security/core-081`,
  based on public `main`). Both are separate worktrees of the existing Git
  repository using its existing `origin` and `public` remotes. No edits, commits,
  stashes or discards occurred in `D:/semantic_app` or `D:/vilsem-mcp`.

## Changes by file

| File | Change |
| --- | --- |
| `ui/src/standalone/sanitizeMeasureHtml.js` | Explicit DOMPurify HTML/SVG tag and attribute allowlist; retain inline CSS, embedded styles, chart geometry and specific renderer data hooks; reject scripts, event-handler attributes, images, frames, forms and navigation/resource attributes. Arbitrary `data-*` attributes are disabled. |
| `ui/src/standalone/powerbi-dom.jsx` | Export the sanitizer from the existing DOM adapter, reusing its already-bundled DOMPurify rather than adding a renderer dependency/copy. |
| `vilsem-renderer/src/visual.ts` | Both `renderHtml` and `renderHtmlWithSelection` sanitize before assigning `innerHTML`; count-up, pills and selection wiring remain afterward. |
| `tests/renderer-html-security.test.ts` | Real packaged-renderer Chrome/Edge tests: three malicious fallback routes (single value, categorical value, category selection), plus retained formatting/SVG/CSS/count-up/pills/Ctrl-selection/clear. Browser network blocked; controlled clock; release fails if browser unavailable. |
| `tests/power-bi-selection-runtime.test.ts` | Explicit identity sanitizer stub for its deliberately minimal fake DOM; actual sanitation is covered in the packaged browser suite. |
| `packages/core/src/connect/localBridge.ps1` | Exact `Microsoft.MicrosoftPowerBIDesktop` Appx lookup; fallback to `C:\Program Files\Microsoft Power BI Desktop\bin\Microsoft.PowerBI.AdomdClient.dll` if no package or package DLL missing. |
| `packages/core/src/connect/localRuntime.cjs` | Explain why `-ExecutionPolicy Bypass` remains scoped to the fixed bundled `-File` script. No global/user policy changes or caller-provided script. |
| `packages/core/src/connect/bridge-security.test.ts` | Execute discovery with mocked PowerShell cmdlets: official package, absent package, missing package DLL; guard fixed script invocation. No DLL/model/network accessed. |
| `package.json`, `package-lock.json` | Pin test-only Playwright Core 1.64.1; align root workspace core dependency and lock metadata to 0.8.1. No production dependency upgrades. |
| `packages/core/package.json`, `vilsem-renderer/pbiviz.json` | Core 0.8.1; Renderer 4.44.0.0. Renderer GUID and `objects.semantica.primitiveSpec` unchanged. |
| `packages/core/assets/renderer.pbiviz`, `vilsem-renderer/dist/*.4.44.0.0.pbiviz`, `vilsem-renderer/dist/package.json` | Independently built native packages, copied through the existing post-build hook; generated manifest now matches 4.44. |
| `README.md`, `packages/core/README.md` | Scope, prepared version/install URL and required manual upgrade of existing reports. Prior evaluation limitations retained. |
| `docs/qa/security-081-pr-draft.md`, `docs/releases/core-v0.8.1.md`, this file | Prepared PR description, release notes and evidence ledger. |

Allowlist decision: the HTML generators explicitly use self-contained inline
CSS, embedded hover/keyframe styles and inline SVG. These remain supported.
Inline JavaScript handlers are intentionally removed; renderer-owned listeners
wire supported selection/pill/count-up interactions after sanitation. This is
HTML sanitization, not a CSS isolation engine or a broader report certification.

## Verification

| Check | Result |
| --- | --- |
| Public `npm test` (includes `pretest` core build) | **1,375/1,375 PASS**, 120 files, zero skipped; 56.17 s. Includes 225 core-package tests across 19 files. |
| Private `npm test` | **1,375/1,375 PASS**, 120 files, zero skipped; 56.95 s. Includes the same 225 core-package tests. |
| Targeted sanitizer/bridge/selection run | **110/110 PASS**, three files. |
| Public and private `npm run powerbi:build` | **PASS**, both production native builds; lint, shared DOM build, webpack packaging and core asset-copy hook complete. |
| Renderer JS/CSS comparison | **Exact match** between independent builds (hashes below). CSS also unchanged from 4.43. |
| Packed archive checks | **PASS**: core version 0.8.1; bundled renderer 4.44.0.0; GUID/property preserved; extracted renderer, bridge script and runtime equal tested source assets byte-for-byte. |
| Fresh archive installation | **PASS**, 39 packages installed, audit 0; no development link or Electron dependency. Standalone imports, mocked Desktop auto-discovery/query and spec resolution pass. |
| Actual local Appx name | Exact official package found. DLL fallback and connection behavior covered by mocks; no live model query claimed. |
| Hygiene | Original private checkout preserved. No pushes, PR creation, merge, tag or release. |

Initial bridge test run passed all three discovery cases but failed a brittle
comment-text assertion because the comment wrapped across lines. The assertion
was corrected before the targeted and full green runs. One dependency install
hit ECONNRESET and succeeded on retry. Neither is hidden as a product failure.

Build/tool warnings remain: Vite future config-loader warning, SDK missing
source map, existing optional Power BI certification-feature warnings and
Node fs.existsSync deprecation. Dependency installs report existing root
1 low / 6 moderate and renderer 4 low / 12 moderate development-tree advisories;
UI and fresh core consumer audit report 0. No unrelated dependency remediation
or certification claims are included.

## Artifact hashes

- JS, both builds:
  `04305a1ca2a5ef8f34b89deb56e2b2133ea780393eccf1f1ca957ca872fce106`
- CSS, both builds:
  `c498f88cec998754b251dcef0edb3daf3daa93551f9ab1621abc9d4f72e9d8a2`
- Public renderer ZIP (published candidate, embedded in public core archive):
  `d384017ae6d0bfeb7996bdaf395d60eace4c9cb42686587b156990d0d58e8256`
- Private renderer ZIP:
  `cbeba64451a64b114fdf5619ef346c09d23ad797a8c235a3b7517052f89fe6ce`
- Core archive `vilsem-core-0.8.1.tgz`:
  `523b36a5bccf555b97d1580e285fc82668a729bba99247d1fadfa8fd5df806f1`

ZIP container hashes differ between builds; JS/CSS match. Release candidate
artifacts are in `D:/vilsem-security-public/cache/security-081/artifacts/`:
`vilsem-core-0.8.1.tgz`, `renderer.pbiviz`, `SHA256SUMS-core-v0.8.1.txt`.
Raw build/test/pack/fresh-install evidence is under the adjacent ignored cache
folders in each worktree. The tarball is not committed into Git.

Reserved download URL (not live until approved publication):
`https://github.com/bcsnpc/vilsem/releases/download/core-v0.8.1/vilsem-core-0.8.1.tgz`

## Manual steps and remaining scope

- Owner approval required before pushing either branch, opening PRs, merging,
  tagging or publishing. Public PR targets public `main`; private patch PR
  targets private `main` separately, with no private-history merge into public.
- After release: bump MCP to the actual core 0.8.1 URL, regenerate shrinkwrap,
  run its complete suite/fresh-install checks, then prepare MCP 0.9.1. Not done
  in this core/renderer task.
- Existing reports: save and resolve pending external changes; **Home > More
  visuals > From my files**, choose the new renderer, accept **Update**, save,
  close and reopen. `commit_visual` never silently replaces a registered
  renderer. Installing a new core/MCP package alone does not repair old reports.
- Live Desktop import/update/save/reopen and Service re-publication were **not
  run for 4.44**. The automated browser tests are real bundle/DOM tests with a
  host fixture, not native Desktop/Service certification. All broader 0.8
  interaction/performance/formatting/export limits remain.
- S10 (axios), S11 (online token-cache protection), app audit findings and
  supply-chain CI/provenance expansion in the app repository are out of scope.
