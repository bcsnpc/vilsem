# vilsem

> Natural-language dashboards on top of Microsoft Fabric — generate, explore, and
> publish to the web, Power BI, and Fabric from a single App Spec.

![version](https://img.shields.io/badge/version-1.0.0--beta.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![status](https://img.shields.io/badge/status-public%20beta-orange)

vilsem is an Electron desktop app that turns a plain-English prompt (*"revenue by product
category over the last year, with a KPI row and a bar race"*) into a live, interactive
dashboard built directly on your **Microsoft Fabric / Power BI semantic model**. It
queries the model with DAX (`executeQueries`), renders everything with **Apache ECharts**,
and lets you take the exact same dashboard to three destinations without rebuilding it.

> ⚠️ **Public beta (`v1.0.0-beta.1`).** Expect rough edges and breaking changes. Please
> file issues — that's what the beta is for.

---

## Why vilsem

Building a Fabric/Power BI dashboard usually means dragging fields, wiring measures, and
hand-tuning each visual. vilsem collapses that into a conversation: describe what you want,
get a real dashboard wired to your model, refine it in natural language or a full visual
inspector, then publish. One **App Spec** drives every surface, so a chart you design once
looks and behaves the same on the canvas, on the web, in Power BI, and in Fabric.

## Features

### 🗣️ Natural-language generation & refinement
- Describe a dashboard; vilsem picks the visuals, measures, dimensions, layout, and theme.
- Refine conversationally (*"make the bars teal, top 15, add a profit KPI"*) or with a
  full **5-tab visual inspector** (data, style, text, layout, AI) for pixel-level control.
- Cloud LLMs — **Anthropic, OpenAI, Gemini, or Groq** — you bring the key (no local model).

### 📊 Live data on your semantic model
- Queries your Fabric/Power BI model via the **Execute Queries REST API** (DAX).
- **Rate-limited request queue** + deterministic **cache** so you don't storm the API.
- Measure names validated against model metadata; numbers stay numbers, dates stay ISO.

### 🎨 30+ visual types
KPIs, stat cards, gauges, bar / column / stacked / grouped bars, line / area / stacked
area, donut / pie, scatter / bubble, treemap, radar, funnel, waterfall, lollipop, slope,
bump, heatmap, sunburst, ranked lists, multi-dimension tables — and more.

### ▶️ Interaction plays
- **Drill-down**, three styles: **expand-in-place** (a bar splits into its children with a
  morph animation), **detail panel** (a side drawer of the clicked value's breakdown), and
  **replace / breadcrumb** (drill the axis a level deeper, click back up).
- **Bar race** — an animated, playable ranking with a Play/scrub timeline over a time axis.
- **Cross-filter** (click a bar to filter the page), **slicers**, and an **axis switcher**.
- Every interaction behaves identically on the canvas, the web export, Fabric, and the
  Power BI custom visual — because they all run the same renderer.

### 🚀 Publish anywhere — one App Spec, three destinations
| Destination | How |
|---|---|
| **Web export** | Self-contained web app: a Fastify server + a `window.semantica` HTTP shim feeding the real vilsem renderer. |
| **Power BI** | A custom `.pbiviz` visual (in `pbiviz-semantica-renderer/`) that composes ECharts client-side from a categorical dataView — drill and bar race included. Measures merge into a shared `_SemanticaGenerated` table without clobbering existing report measures. You can also **export any single visual as a self-contained `.pbiviz`** from the inspector, then import it into an existing report (per-report or organization-wide) and bind it to your own model fields. |
| **Microsoft Fabric** | Deployed as a **Fabric App** via the Rayfin CLI (feature-flagged). Runs the identical renderer, re-piping `window.semantica` to the Fabric semantic-model SDK, so the full dashboard — visuals, drill, interactions — shows in Fabric with in-app sign-in. |

### 🧩 Also
- **Multi-page** dashboards with page tabs + nav buttons.
- **Dark / light** theming, per-visual color schemes, and card chrome.
- Deterministic layout (12-column grid) shared across every render path.

## How it works

```
Prompt ──► LLM ──► App Spec (JSON) ──► AppSpecRenderer (React + ECharts)
                                           │  talks only to window.semantica
                                           ▼
                        ┌──────────────────┼───────────────────┐
                   Electron IPC        HTTP shim          Fabric SDK shim
                  (desktop canvas)   (web export)        (Fabric App)
                        │                  │                     │
                        └────────► Execute Queries REST API (DAX) ◄───┘
```

The **App Spec** is the single source of truth. The renderer never talks to a backend
directly — it only calls `window.semantica.queryTable / query / getDistinctValues`, so the
same component tree runs everywhere; only the data transport changes per destination. The
Power BI path is the one exception (a categorical dataView the `.pbiviz` composes from),
kept in visual parity with the web renderer.

## Install (users)

1. Download the latest installer from the **[Releases](../../releases)** page and run it.
   *(Beta builds are unsigned, so Windows SmartScreen may warn — choose "More info → Run
   anyway".)*
2. Launch vilsem and **sign in with your Microsoft account** when prompted — that's how it
   connects to your Fabric / Power BI semantic models. No config files to edit.
3. Add an **LLM API key** (Anthropic, OpenAI, Gemini, or Groq) in the app's AI settings.

**You'll need:** a Microsoft Fabric / Power BI semantic model you can access, with the
**Semantic Model Execute Queries REST API** tenant setting enabled (your Fabric admin
controls this).

## Authentication

- **Interactive Microsoft sign-in (default)** — nothing to configure; sign in when the app
  asks. This is the recommended path for everyone.
- **Service principal (advanced / headless)** — copy `.env.example` to `.env` and provide
  your app-registration + workspace/dataset details. Most users never need this.

## Develop / build from source (contributors)

Requirements: **Node.js ≥ 20** and npm.

```bash
git clone https://github.com/bcsnpc/vilsem.git
cd vilsem
npm install
cd ui && npm install && cd ..

npm run electron:dev     # hot-reload dev (Vite UI + Electron)
npm run build            # package a Windows NSIS installer into release/
npm test                 # vitest

# optional extras
npm run standalone:build    # build the web-export renderer bundle
npm run fabric-embed:build  # build the Fabric-App renderer bundle
```

### Feature flags
Some paths are gated by environment flags (default OFF), e.g. **`FEATURE_FABRIC_EXPORT`**
enables the Deploy-to-Fabric flow. See `ui/src/appspec/shared/feature-flags.js`.

## Tech stack

Electron · React · Apache ECharts · Fastify · SQLite (`better-sqlite3` / `sql.js`) ·
Vite · Vitest · TypeScript where it adds value, plain JS elsewhere ·
Power BI custom-visuals API (`pbiviz`).

## Repository layout

```
electron/                    Electron main process — IPC, Fabric/LLM/publish handlers
  fabric/                    Deploy-to-Fabric (Rayfin) — isolated, feature-flagged
src/                         Fastify server + Fabric DAX client (queue, cache, translator)
ui/                          React app
  src/appspec/              App Spec renderer, visuals, drill engine, inspector
  src/pages/                Generator, Power BI publish, exports
  src/standalone/           Web-export + Fabric-embed entries
pbiviz-semantica-renderer/   Power BI custom visual (.pbiviz)
docs/architecture/           Architecture notes
```

## Status & roadmap

This is an early public beta. Known beta gaps: the installer is **unsigned** and uses the
**default app icon**; the Deploy-to-Fabric path is a **preview** (region-limited by Fabric
itself). Feedback and issues are very welcome.

## Contributing

Issues and PRs are welcome. The project targets permissive-only dependencies — a CI job
(`.github/workflows/license-check.yml`) fails the build if a non-permissive license slips
into production dependencies.

## License

MIT License — see [LICENSE](LICENSE). Third-party attributions (including Apache
ECharts, whose license requires it) are in [NOTICE](NOTICE).
Copyright © 2026 Chiranjeevi Bhogireddy.
