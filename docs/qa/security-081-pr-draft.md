# Core 0.8.1 / Renderer 4.44: HTML fallback and Desktop bridge hardening

Legacy HTML measures without a visual spec previously went straight to
`innerHTML`. Sanitize both fallback paths through the existing bundled
DOMPurify, with explicit HTML/SVG/data-hook allowlists. Script, event-handler
and navigation/resource markup is removed; styled HTML, chart SVG, count-up,
axis pills and renderer-owned selection listeners remain supported.

Pin local ADOMD discovery to the exact official Desktop Appx name, with the
standard Program Files DLL as fallback. Keep execution-policy bypass only for
the fixed bundled script, with its rationale documented.

- Core 0.8.1, Renderer 4.44.0.0; GUID and `objects.semantica.primitiveSpec`
  unchanged. No MCP, online auth, axios or token-cache changes.
- Public/private full suites: each **1,375 tests PASS**, zero skipped.
- Both production renderer builds PASS; JS/CSS SHA256 match exactly.
- Real-browser malicious HTML and retained interaction tests PASS against the
  actual packaged visual. Bridge discovery uses mocked cmdlets, no live DLLs.
- Archive contents, renderer 4.44 metadata and fresh standalone install PASS;
  fresh consumer npm audit 0.

Existing reports must import the new renderer using **Home > More visuals >
From my files**, accept **Update**, save, close and reopen. Package installation
alone does not update registered renderers; `commit_visual` never silently
replaces them. Live Desktop upgrade/Service re-publication remain manual checks.

See [full evidence, decisions and remaining limitations](security-core-081.md)
and [prepared release notes](../releases/core-v0.8.1.md).

Release artifact SHA256:
`523b36a5bccf555b97d1580e285fc82668a729bba99247d1fadfa8fd5df806f1`.

Publication is approval-gated. For the public PR use branch `security/core-081`
against `bcsnpc/vilsem:main`; separately carry `security/core-081-private` to
`bcsnpc/semantic_app:main`. Do not merge private Git history into the public repo.
