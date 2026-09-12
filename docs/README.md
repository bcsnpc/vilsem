# Semantica — Technical Documentation Index

Organized reference for the architecture, features, and implementation details behind Semantica's app generator, canvas editor, and Power BI publish pipeline.

---

## Core Architecture

The references below include historical Semantica-era implementation notes. For the
2026-09-07 Vilsem baseline, start with the [current audit report](qa/full-audit-report.md),
[current architecture](architecture.md), [product flow](product-flow.md),
[visual inventory](visual-inventory.md), [visual architecture](visual-architecture.md),
[consistency matrix](visual-consistency-matrix.md), and [AI/UI parity index](ai-ui-parity-matrix.md).
Testing evidence, limits, bugs and priorities are indexed in [regression status](qa/regression-status.md).

Latest repair checkpoint: [verified fixes and remaining work](qa/fix-status.md).

- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** — High-level product overview and phase history (Phase 0 → 4)

## Visual System

- **[VISUAL_CONFIG_REFERENCE.md](VISUAL_CONFIG_REFERENCE.md)** — Every config property for all 34 visual types
  - KPI, bar, line, area, donut, pie, gauge, radar, scatter, bubble, treemap, funnel, sankey, table, column, waterfall, lollipop, bullet, progress, heatmap, ranked_list, stat_card, metric_tile, grouped_bar, stacked_area, sparkline_kpi, slope, bump, chord, sunburst, narrative, waffle, stacked_bar
- **[CANVAS_EDITOR.md](CANVAS_EDITOR.md)** — Photoshop-style free-form layout, drag/resize, tabbed inspector, 6 card styles
- **[ANIMATIONS.md](ANIMATIONS.md)** — Entrance animations, counter-up for numbers, hover effects, Recharts data animations

## Power BI Publish

- **[CUSTOM_VISUAL_PUBLISH_BREAKTHROUGH.md](CUSTOM_VISUAL_PUBLISH_BREAKTHROUGH.md)** — The 2026-04-17 investigation log: legacy format + embedded visual binary
- **[SEMANTICA_PBI_PARITY.md](SEMANTICA_PBI_PARITY.md)** — Pixel-perfect parity design (shared chrome helper, font embedding, live DAX)

---

## Quick Reference by Feature

### "How do I change X?"

| Want to change | File |
|---|---|
| Visual's config schema | [ui/src/appspec/schema.js](../ui/src/appspec/schema.js) |
| Visual's rendering | [ui/src/appspec/AppSpecRenderer.jsx](../ui/src/appspec/AppSpecRenderer.jsx) |
| Card chrome (all styles) | `getCardChromeStyle()` in same file |
| Theme tokens | [ui/src/appspec/getThemeTokens.ts](../ui/src/appspec/getThemeTokens.ts) |
| Color schemes | [ui/src/appspec/colorSchemes.ts](../ui/src/appspec/colorSchemes.ts) |
| Inspector UX | [ui/src/appspec/VisualInspector.jsx](../ui/src/appspec/VisualInspector.jsx) |
| Canvas drag/resize | [ui/src/appspec/CanvasEditor.jsx](../ui/src/appspec/CanvasEditor.jsx) |
| LLM system prompts | [electron/ipc/llm.js](../electron/ipc/llm.js) — `APP_GEN_SYSTEM_PROMPT`, `PATCH_SYSTEM_PROMPT` |
| PBI DAX emission | [ui/src/pages/powerbi/daxTemplateBuilder.js](../ui/src/pages/powerbi/daxTemplateBuilder.js) |
| PBI publish pipeline | [ui/src/pages/powerbi/publishCustomVisualFlow.js](../ui/src/pages/powerbi/publishCustomVisualFlow.js) |
| PBI TMDL measure injection | [ui/src/pages/powerbi/tmdlMeasureInjector.js](../ui/src/pages/powerbi/tmdlMeasureInjector.js) |
| Embedded fonts in PBI | [pbiviz-semantica-renderer/style/visual.less](../pbiviz-semantica-renderer/style/visual.less) — regenerate via `scripts/embed-fonts.js` |
| Fabric API wrappers | [src/fabric/*.js](../src/fabric/) |

### "Where are credentials stored?"

| Type | Location |
|---|---|
| Service Principal (MS auth) | `.env` in project root OR Windows Credential Manager |
| LLM API keys | `%APPDATA%\Electron\semantica-ai-keys.json` (encrypted via Electron `safeStorage`) |
| Saved workspaces | `%APPDATA%\Electron\workspaces.json` |
| Refresh tokens (MS Account PKCE) | OS keychain via `safeStorage` |

### "How do render paths differ?"

All read from the same spec JSON, but differ in how they're presented:

| Path | Handles drag | Entry point |
|---|---|---|
| Edit — GridLayout mode | Yes (react-grid-layout) | `<AppSpecRenderer editMode onLayoutChange>` |
| Edit — CanvasEditor mode | Yes (pointer events, pixel-precision) | `<CanvasEditor>` |
| View — section layout | No | `<AppSpecRenderer>` (default) |
| View — freeform | No | When `spec.layout.freeform: true` |
| Power BI Service | No (PBI owns positioning) | DAX measure returns HTML |

All five use `getCardChromeStyle()` for card appearance. No divergence.

---

## Build & Deploy

| Task | Command |
|---|---|
| Run Semantica (Electron dev) | `npm run dev` |
| Build UI bundle | `npm run ui:build` |
| Build standalone web export | `npm run standalone:build` |
| Build Electron .exe | `npm run build` |
| Rebuild PBI custom visual | `cd pbiviz-semantica-renderer && node scripts/embed-fonts.js && npx pbiviz package` |
| Run integration tests | `node test-harness.js` |
| Vitest unit tests | `npx vitest run` |

---

## Roadmap / Not Yet Done

### Near-term
- Apply PBI parity treatment to remaining 33 visuals (bar, line, donut, gauge, funnel, table, etc.)
- Per-element animations (title slides, value counts up, sparkline draws, cascading like Photoshop reveal)
- Counter-up for gauge, progress, stat_card, metric_tile (currently only full KPI)
- Offline font bundling in web export (Google Fonts CDN requires internet)
- Layers panel in canvas editor (show/hide/lock/rename all visuals)

### Medium-term
- Scroll-triggered entrance animations (IntersectionObserver)
- Align & distribute tools in canvas editor (align left/center/right, distribute)
- Keyboard shortcuts (Cmd+D duplicate, nudge with arrows, Delete)
- Undo/redo with timeline scrubber
- Theme editor — customize `getThemeTokens` values without editing code

### Long-term
- Cross-filter reactivity for PBI custom visual (click bar → filter other Semantica visuals on same page)
- Inject Semantica visuals into existing PBI reports (not just standalone published reports)
- Embedded view in a third-party app (iframe SDK)
- Natural-language filter bar ("show only Q1 2024" → applies filter)
- Auto-generate dashboard from a measure list (wizard mode)

---

## Session Memory

Working session logs and decisions live at `C:\Users\chait\.claude\projects\d--semantic-app\memory\`:
- `MEMORY.md` — index
- `session_log.md` — chronological
- `pbi_custom_visual.md` — PBI publish solution reference
- `roadmap.md` — feature priorities
- `user_preferences.md` — working style notes

---

_Last updated: 2026-04-18_
