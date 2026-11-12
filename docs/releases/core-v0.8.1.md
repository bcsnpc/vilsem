# Core 0.8.1 / Renderer 4.44

Prepared release notes — **not published**. Tag: `core-v0.8.1`.

## Security fixes

- **S8 / M2 / A6:** HTML-measure fallback content without a Vilsem spec is
  sanitized with the renderer's bundled DOMPurify and explicit tag/attribute
  allowlists before insertion. Scripts and inline event handlers are removed;
  frames, image/resource and navigation markup are not allowed. Styled
  divs/spans, embedded hover/animation styles, inline SVG and supported
  axis/count-up/selection hooks remain functional.
- **S9 / M8:** ADOMD loads from the exact official
  `Microsoft.MicrosoftPowerBIDesktop` package or the standard
  `C:\Program Files\Microsoft Power BI Desktop\bin` installation, rather than
  the first wildcard Appx match. Execution-policy bypass remains scoped to the
  fixed bundled script so unsigned package installs work with default Windows
  execution policy; it does not change user/machine policy.

Core is 0.8.1; renderer is 4.44.0.0. The visual GUID
`semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D` and
`objects.semantica.primitiveSpec` property are unchanged.

## Required upgrade for existing reports

Save Desktop work and resolve pending external changes. Choose **Home > More
visuals > From my files**, import the new `renderer.pbiviz`, accept **Update**,
save, close and reopen. The installed package copy is at
`node_modules/@vilsem/core/assets/renderer.pbiviz`.

**A core/MCP upgrade alone does not fix a renderer already registered in a
report. `commit_visual` never silently replaces it.** Update affected report
resources and re-publish reports to Service as appropriate.

## Verification and limits

Private and public full app/core suites each passed 1,375 tests across 120 files
with zero skips. Both production native builds passed with identical JS/CSS
hashes. Actual packaged-renderer browser tests verify malicious HTML is inert
and retained formatting, SVG, axis pills, count-up, Ctrl-selection and clear.
Bridge discovery tests use mocked PowerShell cmdlets. Packed asset verification
and a fresh standalone archive installation passed (consumer npm audit 0).

Live Desktop import/update/save/reopen and Service re-publication for 4.44 are
not verified by these tests. This patch does not close prior rendering,
performance, interaction or certification limitations. It includes neither
S10 (axios) nor S11 (online token-cache protection), and makes no MCP release or
Electron installer. MCP 0.9.1 dependency/shrinkwrap verification is a separate
follow-up. See [full evidence](../qa/security-core-081.md).

## Downloads after approval

- `https://github.com/bcsnpc/vilsem/releases/download/core-v0.8.1/vilsem-core-0.8.1.tgz`
- `https://github.com/bcsnpc/vilsem/releases/download/core-v0.8.1/renderer.pbiviz`
- `https://github.com/bcsnpc/vilsem/releases/download/core-v0.8.1/SHA256SUMS-core-v0.8.1.txt`

SHA256:

```text
523b36a5bccf555b97d1580e285fc82668a729bba99247d1fadfa8fd5df806f1  vilsem-core-0.8.1.tgz
d384017ae6d0bfeb7996bdaf395d60eace4c9cb42686587b156990d0d58e8256  renderer.pbiviz
```
