// Single source of truth for a visual's EFFECTIVE config — the exact values the
// renderer uses. Its defaults are copied verbatim from the current renderer
// fallbacks (chrome.js getCardChromeStyle, CompactKpi, AppSpecRenderer chart
// headers), so resolving a config never changes rendered output — it only lets
// the inspector display what actually renders (fixing "opacity says 100% but the
// card is transparent" and "card is black but the font-color field shows teal").
import getThemeTokens from '../getThemeTokens'
import { pal } from './palettes.js'

// Centralised KPI-type set (was duplicated ~6×). KPI-family visuals render a
// value card rather than a chart, so several defaults differ from charts.
export const KPI_TYPES = new Set([
  'kpi', 'stat_card', 'metric_tile', 'sparkline_kpi', 'bullet', 'progress', 'gauge',
])
export const isKpiType = (type) => KPI_TYPES.has(type)

// True when the user has explicitly set a config key (vs. relying on the default).
export function isExplicit(config, key) {
  return config != null && config[key] !== undefined && config[key] !== null && config[key] !== ''
}

// Effective config for a visual. `theme` is the canvas/dashboard theme (dark|light).
// Keep every default identical to the renderer's fallback.
export function resolveVisualConfig(visual = {}, { theme = 'dark' } = {}) {
  const cfg = visual?.config || {}
  const t = getThemeTokens(theme)
  const p = pal(cfg.colorScheme)
  const kpi = isKpiType(visual?.type)
  return {
    ...cfg,
    // ── card chrome (mirror chrome.js) ──
    cardStyle:    cfg.cardStyle || 'minimal',
    bgOpacity:    cfg.bgOpacity ?? null,   // null = theme tint ("Auto"), not a solid fill
    cardOpacity:  cfg.cardOpacity ?? 1,
    borderRadius: cfg.borderRadius ?? 14,
    // ── title (KPI header → textMuted; chart header → textPrimary) ──
    titleColor:      cfg.titleColor || (kpi ? t.textMuted : t.textPrimary),
    titleFontSize:   cfg.titleFontSize ?? 11,
    titleFontWeight: cfg.titleFontWeight ?? 500,
    // ── value (KPI) — colour follows the visual's colorScheme (theme-independent) ──
    valueColor:      cfg.valueColor || p.text,
    valueFontSize:   typeof cfg.valueFontSize === 'number' ? cfg.valueFontSize : 32,
    valueFontWeight: cfg.valueFontWeight ?? 800,
    // convenience: the resolved accent for this visual
    _accent: p.start,
  }
}

// ── Per-type inspector honesty (display-only; never changes what renders) ─────────
// Several visuals share one primitive schema (bar/column/stacked_bar/grouped_bar all
// use bar-marks; line/area/stacked_area/bump all use line-marks), but each Compact*
// renderer applies its OWN fallback when a config key is unset — so a single shared
// `schema.default` can't be honest for every type. These maps hold the ACTUAL default
// each renderer uses, so the inspector shows "what the chart is doing" without a nudge.
// Every value below mirrors a renderer fallback verified against the Compact*Echarts
// source — changing display only, no render path touched.
export const TYPE_FIELD_DEFAULTS = {
  bar:          { dataLabels: true,  labelPosition: 'right', rankOpacity: true,  gridLines: false },
  column:       { dataLabels: true,  labelPosition: 'top',   rankOpacity: true,  gridLines: false },
  stacked_bar:  { dataLabels: true,  labelPosition: 'right', stacked: true,      gridLines: false, showBarBackground: true },
  grouped_bar:  { dataLabels: false, labelPosition: 'top',   rankOpacity: false, gridLines: true,  showBarBackground: false, barRadius: 3, maxBarSize: 24 },
  lollipop:     { dataLabels: true },
  bar_race:     { dataLabels: true },
  line:         { smooth: false, gridLines: false, chartType: 'line' },
  area:         { smooth: false, gridLines: false, chartType: 'area' },
  stacked_area: { smooth: false, gridLines: false, chartType: 'area' },
  bump:         { invertY: true, showYAxis: true },
  scatter:      { gridLines: true },
  bubble:       { gridLines: true, dotSize: 8 },
}

// Fields to HIDE per type — controls the renderer can't honor for that type. Hiding a
// dead control is more honest than showing a toggle that does nothing. The config key
// (if somehow set) is still respected by the renderer; we just don't offer the control.
export const TYPE_FIELD_HIDE = {
  // showLegend/legendPosition are owned by the dedicated Legend panel (Text tab) for
  // pie/donut, so hide the pie-marks schema duplicates.
  pie:          ['innerRadius', 'showCenterText', 'showLegend', 'legendPosition'],  // pie forces innerRadius:0 (donut-only)
  donut:        ['showLegend', 'legendPosition'],
  bar:          ['stacked', 'secondaryColor'],       // single-series path — no secondary measure
  column:       ['stacked', 'secondaryColor'],
  line:         ['showGrid', 'stacked'],             // showGrid is dead (renderer reads gridLines)
  area:         ['showGrid'],
  stacked_area: ['showGrid', 'stacked'],             // always stacked internally
  bump:         ['showGrid', 'stacked'],
  scatter:      ['showGrid'],
  bubble:       ['showGrid'],
  stacked_bar:  ['showAvgLine', 'avgLineColor', 'avgLineStyle'],  // avg line not wired
  grouped_bar:  ['showAvgLine', 'avgLineColor', 'avgLineStyle'],
}

// Effective inspector default for (type, key): the renderer's real fallback if we know
// it, else the schema's own default. Use for placeholders/toggle positions only.
export function fieldDefault(type, key, schemaDefault) {
  const t = TYPE_FIELD_DEFAULTS[type]
  if (t && key in t) return t[key]
  return schemaDefault
}

export function isFieldHidden(type, key) {
  const h = TYPE_FIELD_HIDE[type]
  return Array.isArray(h) && h.includes(key)
}
