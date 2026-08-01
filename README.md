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

## Requirements

- Node.js ≥ 20 and npm
- A Microsoft Fabric / Power BI semantic model you can query
- An LLM API key (Anthropic, OpenAI, Gemini, or Groq) — set in the app's AI settings.
  The app uses **cloud LLM providers**; no local model is bundled.

## Quick start

```bash
npm install
cd ui && npm install && cd ..

# copy the env template and fill in your Fabric connection
cp .env.example .env

# dev (hot-reload UI + Electron)
npm run electron:dev
```

## Build the desktop app

```bash
npm run build        # builds the UI, then packages a Windows NSIS installer into release/
```

## Tests

```bash
npm test             # vitest
```

## Repository layout

- `electron/` — Electron main process, IPC, Fabric/LLM/publish handlers
- `src/` — Fastify server + Fabric DAX client (rate-limited queue, cache)
- `ui/` — React app (App Spec renderer, visuals, editor, publish flows)
- `pbiviz-semantica-renderer/` — the Power BI custom visual
- `docs/architecture/` — architecture notes

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
