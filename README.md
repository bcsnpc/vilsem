# vilsem

**v1.0.0-beta.1** · Apache-2.0

vilsem is an Electron desktop app that turns natural-language prompts into interactive
dashboards on top of **Microsoft Fabric** semantic models. It queries your model with
DAX (`executeQueries`), renders with **ECharts**, and lets you take a dashboard to three
destinations from the same App Spec:

- **Web export** — a self-contained web app (Fastify server + a `window.semantica` HTTP shim)
- **Power BI** — published via a custom `.pbiviz` renderer (`pbiviz-semantica-renderer/`)
- **Microsoft Fabric** — deployed as a Fabric App via the Rayfin CLI (feature-flagged)

Visuals include KPIs and 30+ chart types, plus **interaction plays** — drill-down
(expand-in-place, detail-panel, replace/breadcrumb) and an animated **bar race**
(play/scrub over a time axis) — that behave identically across the canvas, web export,
Fabric, and the Power BI custom visual.

> ⚠️ **Beta.** This is an early public beta — expect rough edges and breaking changes.

## Install (users)

1. Download the latest installer from the **[Releases](../../releases)** page and run it.
2. Launch vilsem and **sign in with your Microsoft account** when prompted — that's how it
   connects to your Fabric / Power BI semantic models. No config files to edit.
3. Add an **LLM API key** (Anthropic, OpenAI, Gemini, or Groq) in the app's AI settings.
   vilsem uses cloud LLM providers; no local model is bundled.

You need access to a Microsoft Fabric / Power BI semantic model, and the **Execute
Queries REST API** enabled for it (a tenant setting your admin controls).

## Develop / build from source (contributors)

Requirements: Node.js ≥ 20 and npm.

```bash
git clone https://github.com/bcsnpc/vilsem.git
cd vilsem
npm install
cd ui && npm install && cd ..

npm run electron:dev   # hot-reload dev (UI + Electron)
npm run build          # package a Windows NSIS installer into release/
npm test               # vitest
```

**Auth modes.** By default vilsem uses **interactive Microsoft sign-in** — nothing to
configure. A **service-principal** mode is available for advanced/headless setups: copy
`.env.example` to `.env` and fill in your app registration + workspace/dataset details.
Most users never need this.

## Repository layout

- `electron/` — Electron main process, IPC, Fabric/LLM/publish handlers
- `src/` — Fastify server + Fabric DAX client (rate-limited queue, cache)
- `ui/` — React app (App Spec renderer, visuals, editor, publish flows)
- `pbiviz-semantica-renderer/` — the Power BI custom visual
- `docs/architecture/` — architecture notes

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
