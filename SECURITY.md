# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything exploitable.

- Preferred: open a private advisory at
  https://github.com/bcsnpc/vilsem/security/advisories/new
- We aim to acknowledge reports within a few days.

## Status — beta software

vilsem is early beta (`v1.0.0-beta.3`) and is **not recommended for production or
sensitive data**. It ships unsigned (Windows SmartScreen will warn), the App Spec
format may still change, and the hardening below is a first pass — not a
completed audit.

## What was hardened (security pass, 2026-08)

- **Power BI bearer token never reaches the renderer.** The main process holds
  the token; the renderer can only ask for a boolean auth state
  (`pbi-auth-state`). The former `pbi-get-access-token` bridge is removed, closing
  the exfiltration path in the threat model (injected string → `innerHTML` →
  `fetch` the token out). The injector's live Power BI embed backdrop was dropped
  for the same reason (it required a token in the renderer).
- **HTML sinks sanitized with DOMPurify.** The narrative visual uses a strict
  allowlist (`span, b, i, em, strong, br` + `class`); the rich-text box uses
  DOMPurify's safe defaults — blocks `<script>`, event handlers, and `javascript:`
  URLs while keeping legitimate formatting and live-value tokens. Exported and
  Fabric-embedded output render through the same components, so they are covered
  too.
- **Content Security Policy.**
  - Desktop renderer: a strict CSP via `session.defaultSession.webRequest.onHeadersReceived`
    — `script-src 'self'` (no `unsafe-inline`), `object-src 'none'`,
    `frame-src 'none'`, and `connect-src` limited to the app's own API hosts.
    The dev-only relaxations Vite requires are gated on `VITE_DEV_SERVER` so they
    can never apply to a packaged build.
  - Exported web app: its own CSP — a meta tag for the policy (`connect-src 'self'`,
    since the exported renderer only talks to its own bundled server) plus a
    `frame-ancestors 'none'` / `X-Frame-Options: DENY` response header from the
    exported server (a meta tag cannot carry `frame-ancestors`).
- **Dependency vulnerabilities.** `npm audit fix` cleared the production
  advisories in fastify, find-my-way, follow-redirects, form-data, and
  fast-xml-parser.
- **Chromium sandbox re-enabled.** The `no-sandbox` switch and `sandbox: false`
  were removed; the renderer now runs fully sandboxed. It uses no Node APIs —
  every OS/native operation (file dialogs, save dialogs, child-process spawns, the
  Microsoft sign-in window) runs in the main process via IPC, and image upload
  uses the browser `FileReader`.

## What leaves the machine

vilsem has no backend of its own — there is **no vilsem server and no
telemetry**. The only outbound traffic goes to services you already use:

- **LLM calls** go **directly** from your machine to the provider you configured
  (Anthropic / OpenAI / Gemini / Groq), authenticated with **your own API key**.
  They carry **model metadata** — measure, table, and dimension **names** — so the
  model can choose fields. They do **not** send query results or row-level data.
- **DAX queries** run against your Power BI / Fabric semantic model via the
  Execute Queries REST API, issued from the **main process** (never the renderer).
- Nothing else is sent anywhere.

## Dependency audit checkpoint (Round 3, 2026-11-03)

The previous conditional acceptance of adm-zip 0.5.x is retired: the app now
uses **adm-zip 0.6.1**. Electron is **45.2.2**, electron-builder **26.18.0**,
Vitest **5.1.0**, Vite **8.3.5**, and UI/native ECharts **6.1.0**.
Build and runtime acceptance are recorded separately in the QA work log;
installing a patched dependency is not proof that the app still works.

Fresh `npm audit --json` results for the installed lockfiles:

| Tree | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Desktop root | 0 | 0 | 15 | 0 |
| UI | 0 | 0 | 0 | 0 |
| Native visual tooling | 0 | 0 | 16 | 4 |
| MCP | 0 | 0 | 0 | 0 |

The root's remaining moderate chain originates in **minimatch**
([globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249))
through electron-builder's build tools. npm proposes a downgrade to builder
20.23.1, rather than a compatible upgrade; it is not applied. Run builds only
against the controlled repository and do not accept untrusted glob patterns.
This is a development/build dependency exposure, not a reason to claim an
entire distribution has no vulnerabilities.

Native build tooling retains these advisory origins and their dependent chains:

- **minimatch**: globparts amplification, as above. Controlled build inputs;
  do not expose the packaging tool to arbitrary user globs.
- **ajv**: [ReDoS with `$data`](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6).
  Do not enable `$data` for attacker-provided schemas. Report specs use the
  shipped validation grammar, not arbitrary caller schemas.
- **qs**: comma/array parsing and stringify denial-of-service advisories
  (including [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26)).
  Keep the pbiviz development server private/local and do not expose it to
  untrusted requests. A compatible patch is still being evaluated.
- **uuid**: [buffer bounds checking](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
  No caller-provided output buffer is accepted by our visual runtime.
- **elliptic** (low): [risky primitive](https://github.com/advisories/GHSA-848j-6mx2-7j84).
  This toolchain is not used to implement product authentication or signing.

For the non-qs native chains npm currently proposes powerbi-visuals-tools 7.2.1,
a breaking toolchain change. This has not been silently forced. These
mitigations reduce exposure; they do not fix the advisory. Re-audit at release,
and replace these counts if lockfiles or the advisory database change.
Private machine audit snapshots: `cache/round3-{root,ui,native,mcp}-audit-current.json`.

## MCP data boundary

The MCP itself makes no LLM calls and requires no LLM API key. It queries the
connected model with the configured identity and returns metadata, query
results and rendered images to the calling MCP client. That client may be a
cloud-backed agent; its data handling is a separate trust boundary. Review
which model and report you expose to it. Query-scoped measures do not write
model definitions. Model-enforced permissions and RLS depend on the connecting
identity, including the different privileges of a service principal.

Committed bindings refer to model fields. Arbitrary author-supplied JSON can
still contain literal text, constants or data, so a blanket claim that every
possible spec contains no embedded information would be incorrect. Native
report permissions, labels and refresh are owned by Power BI; the MCP does
not create or modify their policy. Report connection strings are parsed for
targets only: embedded passwords and impersonation properties are not used.
