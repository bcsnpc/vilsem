# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything exploitable.

- Preferred: open a private advisory at
  https://github.com/bcsnpc/vilsem/security/advisories/new
- We aim to acknowledge reports within a few days.

## Status — beta software

vilsem is early beta (`v1.0.0-beta.2`) and is **not recommended for production or
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

## adm-zip — accepted advisory (conditional)

`adm-zip` is pinned at 0.5.x. A high-severity advisory —
[GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85): a
**crafted ZIP file triggers a ~4GB memory allocation** (a memory-exhaustion
denial of service) — is fixed only in the breaking 0.6.0. We accept the pin
because the exploit is **not reachable** in this app: adm-zip only ever parses
our **own bundled `.pbiviz`** files (shipped read-only, read into memory) — it
never parses a **user-supplied, downloaded, or imported** archive, so an attacker
never controls the ZIP it reads.

**This acceptance is conditional and load-bearing.** If adm-zip is ever passed a
**user-supplied, downloaded, or imported** archive, this reasoning **no longer
holds**, and upgrading to **adm-zip ≥ 0.6.0 becomes mandatory**. The three call
sites in `electron/ipc/powerbi.js` carry a comment pointing to this note so the
constraint is tripped if the input source ever changes.
