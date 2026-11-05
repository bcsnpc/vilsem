import { prepareVisualRows, rowsFromCategorical } from '@vilsem/core/dax/rows'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import {migrate} from '@vilsem/core/spec/migrate'
import {applyPaneFormatting,effectivePaneObjects,paneFormattingCards,paneTitleConfig} from '@vilsem/core/formatting/pane'
import { resolveReportTheme, reportThemeFromHost, applyReportTheme } from '@vilsem/core/theme/report'
import { createModelFormatter, scopedMeasureFormat, applyModelFormats } from '@vilsem/core/formatting'
import { nativeTemplateTooltipItems } from '@vilsem/core/templates'
/*
 * vilsem Renderer — Power BI custom visual
 * ─────────────────────────────────────────────────
 * Two modes:
 *   1. KPI mode: Category NOT bound. Reads measure value as HTML string, renders it.
 *   2. Chart mode: Category IS bound. Renders an interactive bar chart with
 *      Selection API for cross-filter/cross-highlight.
 */

import "./../style/visual.less"
import { mountPowerBIDomVisual } from '../generated/powerbiDom.js'

import powerbi from "powerbi-visuals-api"
import IVisual = powerbi.extensibility.visual.IVisual
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions
import ISelectionManager = powerbi.extensibility.ISelectionManager
import IVisualHost = powerbi.extensibility.visual.IVisualHost
import DataView = powerbi.DataView

// Phase 5.1 — ECharts foundation for the new primitive render path.
// Per-module imports keep the bundle minimal (vs the full 'echarts' namespace,
// which would add ~1MB uncompressed). Only chart types Semantica actually uses
// are registered; future visual types added in Phase 4 land here too.
//
// The new render mode (renderPrimitiveChart, see below) is wired into update()
// behind a property guard. It only activates when the published report includes
// a `semanticaPrimitiveSpec` property (set by the new DAX builders in Phase 5.2).
// Existing reports continue on the legacy HTML/Bar/HTML+Selection paths with no
// regression — this commit is purely additive scaffolding.
import * as echarts from "echarts/core"
import {
  RadarChart, BarChart, GaugeChart, ScatterChart, TreemapChart, PieChart, LineChart, SankeyChart, SunburstChart, GraphChart,
  HeatmapChart, TreeChart, BoxplotChart, CandlestickChart, ParallelChart, ThemeRiverChart, PictorialBarChart, FunnelChart, ChordChart,
} from "echarts/charts"
import {
  TooltipComponent, GridComponent, LegendComponent, DataZoomInsideComponent,
  MarkLineComponent, GraphicComponent, TitleComponent, MarkAreaComponent, MarkPointComponent,
  PolarComponent, RadarComponent, CalendarComponent, ParallelComponent, SingleAxisComponent,
  VisualMapContinuousComponent, VisualMapPiecewiseComponent, DataZoomSliderComponent, DatasetComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { LabelLayout } from "echarts/features"

echarts.use([
  RadarChart, BarChart, GaugeChart, ScatterChart, TreemapChart, PieChart, LineChart, SankeyChart, SunburstChart, GraphChart,
  HeatmapChart, TreeChart, BoxplotChart, CandlestickChart, ParallelChart, ThemeRiverChart, PictorialBarChart, FunnelChart, ChordChart,
  TooltipComponent, GridComponent, LegendComponent, DataZoomInsideComponent, DataZoomSliderComponent,
  MarkLineComponent, GraphicComponent, TitleComponent, MarkAreaComponent, MarkPointComponent,
  PolarComponent, RadarComponent, CalendarComponent, ParallelComponent, SingleAxisComponent,
  VisualMapContinuousComponent, VisualMapPiecewiseComponent, DatasetComponent, CanvasRenderer, LabelLayout,
])

import { composeOption } from "./compositions"
import { escapeHtml } from "./primitives/escapeHtml"
// Click-to-drill (interaction-plays) — shared pure helpers copied into the bundle.
// @ts-ignore — plain-JS module, no type declarations
import { shapeExpandInPlace, aggregateDrillLevel } from "./appspec/shared/drill.js"
// @ts-ignore — plain-JS module, no type declarations
import { buildExpandBarOption } from "./appspec/shared/expandBarOption.js"
// Card chrome — the SAME function the web canvas uses, so cardStyle variants,
// bgOpacity, radius and accent border render identically in Power BI.
// @ts-ignore — plain-JS module (copied by copy-primitives), no type declarations
import { getCardChromeStyle } from "./appspec/shared/chrome.js"
import { chartTitleStyle } from "./appspec/shared/chartTitle.js"
import { applyAxisTextConfig } from "./appspec/shared/axisTextConfig.js"
import { secondaryAxisMinimumWidth, scrollableChartTooltip } from "./appspec/shared/secondaryAxis.js"
import { applyTooltipConfig } from "./appspec/shared/applyTooltipConfig.js"
import getThemeTokens from "./appspec/getThemeTokens"

// Theme tokens — lifted from ui/src/appspec/getThemeTokens.ts and trimmed to the
// surface the primitives actually read. PBI doesn't expose a "dark vs light" mode
// directly; we infer from host.colorPalette.background.value (set by report theme).
// Falls back to dark if anything's unavailable.
// Theme tokens — primitives runtime read these. Chrome tokens (CARD_*, headerBorder)
// drive the card wrapper rendered around the chart in renderPrimitiveChart.
const DARK_THEME = {
  textPrimary: 'rgba(255,255,255,0.92)',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.4)',
  textFaint: 'rgba(255,255,255,0.18)',
  gridStroke: 'rgba(255,255,255,0.035)',
  gridStrokeOn: 'rgba(255,255,255,0.08)',
  axisTick: 'rgba(255,255,255,0.35)',
  axisLine: 'rgba(255,255,255,0.08)',
  splitLine: 'rgba(255,255,255,0.04)',
  shimmerBg: 'rgba(255,255,255,0.06)',
  canvasBg: '#0b0b12',
  echartsBg: 'transparent',
  echartsTextColor: 'rgba(255,255,255,0.65)',
  echartsAxisColor: 'rgba(255,255,255,0.12)',
  echartsSplitColor: 'rgba(255,255,255,0.04)',
  echartsTooltipBg: '#0e0e1c',
  echartsTooltipBorder: 'rgba(255,255,255,0.11)',
  echartsTooltipText: '#E5E7EB',
  echartsLegendText: 'rgba(255,255,255,0.55)',
  // Chrome — match getThemeTokens.ts DARK_TOKENS
  CARD_BG: 'linear-gradient(180deg, rgba(20,20,34,0.98) 0%, rgba(11,11,20,0.99) 100%)',
  CARD_BORDER: 'rgba(255,255,255,0.08)',
  CARD_SHADOW: '0 16px 36px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.025)',
  headerBorder: 'rgba(255,255,255,0.04)',
}
const LIGHT_THEME = {
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textFaint: '#CBD5E1',
  gridStroke: 'rgba(0,0,0,0.06)',
  gridStrokeOn: 'rgba(0,0,0,0.1)',
  axisTick: 'rgba(0,0,0,0.4)',
  axisLine: 'rgba(0,0,0,0.1)',
  splitLine: 'rgba(0,0,0,0.06)',
  shimmerBg: 'rgba(0,0,0,0.04)',
  canvasBg: '#F1F5F9',
  echartsBg: 'transparent',
  echartsTextColor: '#475569',
  echartsAxisColor: 'rgba(0,0,0,0.12)',
  echartsSplitColor: 'rgba(0,0,0,0.06)',
  echartsTooltipBg: '#FFFFFF',
  echartsTooltipBorder: '#E2E8F0',
  echartsTooltipText: '#1E293B',
  echartsLegendText: '#64748B',
  // Chrome — match getThemeTokens.ts LIGHT_TOKENS
  CARD_BG: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
  CARD_BORDER: 'rgba(0,0,0,0.08)',
  CARD_SHADOW: '0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)',
  headerBorder: 'rgba(0,0,0,0.06)',
}

// Minimal palette inline — same scheme keys as ui/src/appspec/shared/palettes.js's pal().
// Used to derive colorVal (the per-visual accent color driving the left accent strip
// + top border accent on the card chrome).
const SCHEME_START: Record<string, string> = {
  teal: '#14B8A6', blue: '#3B82F6', gold: '#F59E0B', green: '#22C55E',
  purple: '#A855F7', violet: '#8B5CF6', rose: '#F43F5E', red: '#EF4444',
  orange: '#F97316', amber: '#F59E0B',
}
function colorValFor(scheme: unknown): string {
  if (typeof scheme === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(scheme)) return scheme
  return SCHEME_START[String(scheme)] || SCHEME_START.teal
}

// Chrome accent gradient (mirrors getThemeTokens.ts accentBgFn). The card border-top
// now comes from getCardChromeStyle (chrome.js), same as the web canvas.
function accentBg(c: string): string { return `linear-gradient(180deg, ${c} 0%, ${c}50 100%)` }

export class Visual implements IVisual {
  private root: HTMLElement
  private host: IVisualHost
  private selectionManager: ISelectionManager
  // Remembers the last animated value per-element so slicer changes count
  // from previous → new instead of 0 → new every re-render.
  private prevCountValues: Map<string, number> = new Map()
  private rafHandles: number[] = []
  // Tracks whether a non-primary-axis filter is currently applied, so we
  // don't spam applyJsonFilter(null) on every bar/background click (each
  // call causes PBI to re-route the report state).
  private hasAppliedAxisFilter: boolean = false
  // Phase 5.1: ECharts instance for the new primitive render path. Created
  // lazily on first renderPrimitiveChart call, disposed when the visual is
  // destroyed or when switching back to a legacy render mode (cleanup in
  // both paths to avoid memory leaks during PBI's frequent re-renders).
  private chart: echarts.ECharts | null = null
  private domVisual: { dispose(): void } | null = null
  // Phase 5.3 polish: keep the un-mutated composed option around so we can
  // re-derive a selection-aware option (per-item opacity overrides) without
  // re-running composeOption() — selection should be a render-state shim,
  // not a recomposition.
  private lastOption: any = null
  private hierarchyNavigation = new Map<string, any>()
  private treeCollapsed = new Map<string, Map<string, boolean>>()
  private hierarchyBindingKey = ""
  private primitiveCategoryNames: string[] = []
  private primitiveRowNames: string[] = []
  private primitiveVisualType = ""
  private currentSelectionIds: powerbi.visuals.ISelectionId[] = []
  private highlightIndexes: Set<number> | null = null
  private keyboardIndex = 0
  private templateRowSources: number[] | null = null
  private radarHoveredIndex = -1
  // Click-to-drill state (interaction-plays).
  private drillExpanded: string | null = null // expand-in-place: which parent is open
  private replacePath: string[] = []          // replace: the drilled path
  private panelValue: string | null = null    // detail panel: which value's drawer is open
  private raceTimer: number | null = null     // bar race: playback interval handle

  constructor(options: VisualConstructorOptions) {
    this.root = options.element
    this.host = options.host
    this.selectionManager = this.host.createSelectionManager()
    this.selectionManager.registerOnSelectCallback?.((ids) => {
      this.applyChartSelection(this.currentSelectionIds, (ids || []) as powerbi.visuals.ISelectionId[])
    })
    this.root.setAttribute("tabindex", "0")
    this.root.setAttribute("role", "group")
    this.root.setAttribute("aria-label", "vilsem visual. Use arrow keys to choose a point, Enter to select, Escape to clear.")
    this.root.addEventListener("keydown", (event: KeyboardEvent) => {
      const ids = this.currentSelectionIds
      if (event.key === "Escape") {
        this.selectionManager.clear().then(() => this.applyChartSelection(ids, []))
      } else if (ids.length && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault()
        this.keyboardIndex = (this.keyboardIndex + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length
      } else if (ids.length && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault()
        this.selectionManager.select(ids[this.keyboardIndex % ids.length], event.ctrlKey || event.metaKey)
          .then(selected => this.applyChartSelection(ids, selected as powerbi.visuals.ISelectionId[]))
      }
    })
    this.root.style.width = "100%"
    this.root.style.height = "100%"
    this.root.style.overflow = "hidden"
    this.root.style.position = "relative"
  }

  // Dispose any existing ECharts instance. Called before switching render
  // modes (HTML <-> primitive) and on destroy(). Safe to call when chart is null.
  private disposeChart(): void {
    this.currentSelectionIds = []
    this.highlightIndexes = null
    this.host.tooltipService?.hide({ isTouchEvent: false, immediately: true })
    this.root.onclick = null
    this.clearTooltipHideTimer()
    this.tooltipEl?.remove()
    this.tooltipEl = null
    if (this.domVisual) {
      this.domVisual.dispose()
      this.domVisual = null
    }
    if (this.raceTimer != null) {
      clearInterval(this.raceTimer)
      this.raceTimer = null
    }
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
  }

  public destroy(): void {
    this.disposeChart()
  }

  // ── Counter-up animation ─────────────────────────────────────────────
  // Scans the just-rendered HTML for [data-countup] elements and animates
  // their text content from the previously-stored value (or 0 on first
  // render) to the data-countup target. Preserves prefix/suffix (e.g. $, M).
  // Respects prefers-reduced-motion.
  private animateCountUp(): void {
    // Cancel any still-running frames from the previous update()
    this.rafHandles.forEach(h => cancelAnimationFrame(h))
    this.rafHandles = []

    const reduceMotion = typeof window !== "undefined" &&
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) return

    const nodes = this.root.querySelectorAll("[data-countup]")
    if (!nodes.length) return

    nodes.forEach((node, idx) => {
      const el = node as HTMLElement
      const targetStr = el.getAttribute("data-countup") || "0"
      const target = parseFloat(targetStr)
      if (!isFinite(target)) return

      const finalText = el.textContent || ""
      const prefix = el.getAttribute("data-prefix") || ""
      const suffix = el.getAttribute("data-suffix") || ""

      // Unique key per element position for prev-value tracking
      const key = `countup-${idx}-${prefix}-${suffix}`
      const from = this.prevCountValues.get(key) ?? 0
      if (from === target) { return }  // No change, skip animation

      const duration = 900
      const start = performance.now()
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)  // ease-out cubic

      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1)
        const current = from + (target - from) * ease(t)
        el.textContent = this.formatCountValue(current, prefix, suffix)
        if (t < 1) {
          this.rafHandles.push(requestAnimationFrame(step))
        } else {
          // Snap to exact final text (prevents floating-point formatting drift)
          el.textContent = finalText
          this.prevCountValues.set(key, target)
        }
      }
      el.style.fontVariantNumeric = "tabular-nums"  // prevent digit jitter
      this.rafHandles.push(requestAnimationFrame(step))
    })
  }

  private formatCountValue(n: number, prefix: string, suffix: string): string {
    const abs = Math.abs(n)
    let body: string
    if (abs >= 1e9) body = (n / 1e9).toFixed(1) + "B"
    else if (abs >= 1e6) body = (n / 1e6).toFixed(1) + "M"
    else if (abs >= 1e3) body = (n / 1e3).toFixed(1) + "k"
    else body = Math.round(n).toLocaleString()
    return `${prefix}${body}${suffix}`
  }

  private specReadError: string | null = null

  public update(options: VisualUpdateOptions): void {
    const dv = options?.dataViews?.[0]
    if (!dv) {
      const spec = this.readPrimitiveSpec({} as DataView)
      if(this.specReadError){this.disposeChart();this.renderError(this.specReadError,'specification');return}
      if (spec && ['shape', 'divider'].includes(String(spec.type))) this.renderPrimitiveChart({} as DataView, spec)
      else { this.disposeChart(); this.renderEmpty() }
      return
    }
    const cat = dv.categorical
    const hasCategory = cat?.categories && cat.categories.length > 0 && cat.categories[0].values.length > 0

    // Phase 5.1 — primitive-spec render path (additive). Reports published by
    // Phase 5.2+ DAX builders include a `semanticaPrimitiveSpec` property
    // carrying the visual's primitive composition as JSON. When present, we
    // render via the same primitive runtime as the web app for visual parity.
    // When absent (any pre-Phase-5 report), fall through to the legacy paths
    // below — full backward compatibility.
    const primitiveSpec = this.readPrimitiveSpec(dv)
    if(this.specReadError){this.disposeChart();this.renderError(this.specReadError,'specification');return}
    if (primitiveSpec) {
      this.renderPrimitiveChart(dv, primitiveSpec)
      return
    }

    // Switching back to a legacy mode? Clean up any echarts instance from a
    // previous primitive render so it doesn't leak DOM nodes.
    this.disposeChart()

    // Detect "HTML with selection" mode: if the measure value starts with `<`
    // it's Semantica-generated HTML. If we ALSO have a category bound, we
    // render the HTML and wire click-to-filter via selectionManager.
    const firstVal = cat?.values?.[0]?.values?.[0]
    const looksLikeHtml = typeof firstVal === "string" && (firstVal as string).trimStart().startsWith("<")

    if (hasCategory && looksLikeHtml) {
      this.renderHtmlWithSelection(dv, cat!, firstVal as string)
    } else if (hasCategory) {
      this.renderBarChart(dv, cat!)
    } else {
      this.renderHtml(dv)
    }
  }

  // ── Phase 5.1: primitive-spec extraction ─────────────────────────────────
  // The new DAX builders (Phase 5.2) embed the primitive composition spec into
  // a custom property. The shape on the wire:
  //   dataView.metadata.objects.semantica.primitiveSpec = "<JSON string>"
  // Returns the parsed object, or null if not present (caller falls through
  // to the legacy render path, preserving backward compatibility).
  private readPrimitiveSpec(dv: DataView): Record<string, unknown> | null {
    this.specReadError = null
    const objects = dv?.metadata?.objects as Record<string, Record<string, unknown>> | undefined
    const fromReport = objects?.semantica?.primitiveSpec
    // Prefer the report-set spec (new-project publish / inject). Otherwise fall
    // back to a spec BAKED into this package at export time: vilsem's "Export to
    // Power BI" repackages this .pbiviz and replaces the placeholder in
    // bakedSpecRaw() with the exported visual's spec, so an imported .pbiviz
    // renders that exact chart with only the fields bound (no report property).
    const raw = (typeof fromReport === "string" && fromReport.length > 0)
      ? fromReport
      : this.bakedSpecRaw()
    if (typeof raw !== "string" || raw.length === 0) return null
    // Generic (un-exported) build: the placeholder was never replaced → not JSON.
    if (raw.indexOf("__SEMANTICA_BAKED") === 0) return null
    try {
      const parsed = JSON.parse(raw)
      if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed))throw Error('Visual specification must be a JSON object')
      return migrate(parsed)
    } catch (e) {
      console.error("[Semantica] primitiveSpec JSON parse failed:", (e as Error).message, "raw:", raw.slice(0, 200))
      this.specReadError = `Cannot read this visual specification: ${(e as Error).message}`
      return null
    }
  }

  // Export-baked spec. vilsem "Export to Power BI" repackages this .pbiviz and
  // replaces the placeholder string below with the exported visual's primitiveSpec
  // JSON. Left unreplaced in the generic build (still the placeholder), so
  // readPrimitiveSpec falls through to normal report-driven behaviour.
  private bakedSpecRaw(): string { return "__SEMANTICA_BAKED_SPEC__" }

  // ── Phase 5.2: primitive render path ──────────────────────────────────────
  // Builds an ECharts option from the spec + the dataView's raw categorical data,
  // composing it via the same primitives runtime as the web app (compositions.ts
  // is a TS port of the React wrapper composition logic).
  //
  // Data shape on the wire:
  //   spec = { type: 'bar' | 'line' | 'donut' | …, config: { ...all visual.config } }
  //   dataView.categorical.categories[0].values = [_cat per row]
  //   dataView.categorical.values[0..N].values  = [_val, _val2, _val3 per row]
  //
  // Phase 5.3: chart.on('click') wires SelectionIds via the bound category column
  // so click-to-filter and cross-highlight work the same as legacy mode.
  private renderPrimitiveChart(dv: DataView, spec: Record<string, unknown>): void {
    // Reset root + dispose any prior chart instance
    this.disposeChart()
    this.root.textContent = ""

    // ── Phase 5.3 polish: card chrome wrapper ────────────────────────────
    // Mirrors AppSpecRenderer's tile look so the PBI render matches Semantica's
    // canvas: rounded card + top-border accent + optional left accent strip +
    // optional title header. config.cardStyle === 'plain' opts out for users
    // who want a bare chart (PBI's own visualHeader/border are already hidden
    // via vcObjects so 'plain' truly is bare).
    const paneObjects = effectivePaneObjects(spec,dv?.metadata?.objects as any)
    ;(this as any).formattingObjects = paneObjects
    const config        = paneTitleConfig({ ...((spec as any).config ?? {}) },paneObjects) as Record<string, unknown>
    ;(this as any).formattingConfig = config
    ;(this as any).formattingOption = undefined
    // Match the positional measure mapping used by buildRowsFromDataView.
    // Bound display names are automatic defaults; explicit user labels win.
    if (!config.measureName) config.measureName = dv?.categorical?.values?.[0]?.source?.displayName
    if (!config.secondaryMeasureName) config.secondaryMeasureName = dv?.categorical?.values?.[1]?.source?.displayName
    const visualType    = String((spec as any).type ?? "bar")
    ;(this as any).formattingDom = !(spec as any).template && ['waffle', 'bullet', 'progress', 'stat_card', 'metric_tile', 'funnel', 'waterfall', 'heatmap', 'ranked_list', 'chord', 'sankey', 'sunburst', 'narrative', 'insight', 'shape', 'divider'].includes(visualType)
    if (!["shape", "divider"].includes(visualType) &&
        dv?.categorical?.categories?.length && !dv.categorical.categories[0].values.length) {
      this.renderEmpty("No data matches the current filters")
      return
    }
    const appearance = paneObjects.appearance || {}
    ;(this as any).formattingAppearance = appearance
    ;(this as any).formattingCanvasTheme = spec.canvasTheme
    const measureMetadata = (dv?.categorical?.values || []).map(column => ({ name: column.source?.displayName || column.source?.queryName || '', formatString: column.source?.format }))
    const themeContext = { theme: reportThemeFromHost(this.host), useReportTheme: appearance.useReportTheme, locale: this.host.locale, measures: measureMetadata }
    const reportTheme = resolveReportTheme(spec, themeContext)
    const themeMode     = reportTheme.mode
    const isDark        = themeMode === "dark"
    const theme         = { ...(isDark ? DARK_THEME : LIGHT_THEME), ...reportTheme.tokens }
    const cardStyle     = String(config.cardStyle || "plain")
    const isPlain       = cardStyle === "plain" || ["shape", "divider"].includes(visualType)
    const colorVal      = config.colorScheme ? colorValFor(config.colorScheme) : reportTheme.palette[0]
    const showAccent    = config.showAccentStrip !== false
    const titleText     = String(config.title || config.label || "")
    const hasTitle      = titleText.length > 0 && config.showTitle !== false
    const titleColor    = String(config.titleColor || theme.textPrimary)
    const titleSize     = Number(config.titleFontSize || 12)
    const titleFamily   = String(config.titleFontFamily || "Inter, 'Segoe UI', sans-serif")

    // Outer card. Absolute-positioned children (accent strip) and stacked
    // header + chart inside. When 'plain', skip card styling and just render
    // the chart full-bleed.
    const card = document.createElement("div")
    if (!isPlain) {
      // Full card-chrome parity with the web canvas: cardStyle (minimal/filled/glass/
      // glossy/accent/bordered), bgOpacity, borderRadius, cardOpacity — via the shared
      // getCardChromeStyle. getThemeTokens supplies the full token set it reads.
      const fullT = getThemeTokens(themeMode)
      const chrome = getCardChromeStyle({ config, colorVal, T: fullT, isKpi: false })
      chrome.background = 'transparent'
      Object.assign(card.style, {
        position: "absolute", inset: "0",
        overflow: "hidden", display: "flex", flexDirection: "column", boxSizing: "border-box",
        ...chrome,
        borderRadius: `${chrome.borderRadius ?? 14}px`,
        opacity: String(chrome.opacity ?? 1),
      })
    } else {
      card.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;box-sizing:border-box"
    }
    this.root.appendChild(card)
    const border = paneObjects.border || {}
    if(border.show){card.style.border=`${Math.max(1,Math.min(200,Number(border.width)||1))}px solid ${border.color?.solid?.color || '#cccccc'}`;card.style.borderRadius=`${Math.max(0,Math.min(100,Number(border.radius)||0))}px`}
    const background = appearance.backgroundColor?.solid?.color
    const requestedTransparency = Number(appearance.transparency ?? 100)
    const transparency = Number.isFinite(requestedTransparency) ? Math.min(100, Math.max(0, requestedTransparency)) : 100
    if (typeof background === 'string' && /^#[\da-f]{6}$/i.test(background)) {
      const rgb = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16))
      card.style.background = `rgba(${rgb.join(',')},${1 - transparency / 100})`
    }

    // Left accent strip — full-card height, 3px wide, gradient. Skipped on plain.
    if (!isPlain && showAccent) {
      const strip = document.createElement("div")
      strip.style.cssText = [
        "position:absolute", "left:0", "top:0", "bottom:0", "width:3px",
        "border-radius:14px 0 0 14px",
        `background:${accentBg(colorVal)}`,
        "z-index:3", "pointer-events:none",
      ].join(";")
      card.appendChild(strip)
    }

    // Title header — only when title/label present and not plain.
    if ((!isPlain || (this as any).formattingDom && paneObjects.title) && hasTitle) {
      const header = document.createElement("div")
      header.style.cssText = [
        "height:36px", "flex-shrink:0",
        "display:flex", "align-items:center",
        "padding:0 14px",
        `border-bottom:1px solid ${theme.headerBorder}`,
        "gap:8px", "position:relative", "z-index:2",
      ].join(";")
      if (showAccent) {
        const innerStrip = document.createElement("div")
        innerStrip.style.cssText = [
          "position:absolute", "left:0", "top:9px", "bottom:9px", "width:2.5px",
          "border-radius:2px",
          `background:${accentBg(colorVal)}`,
        ].join(";")
        header.appendChild(innerStrip)
      }
      const titleSpan = document.createElement("span")
      const titleStyle = chartTitleStyle({ ...config, titleFontFamily: titleFamily }, titleColor)
      Object.assign(titleSpan.style, titleStyle, {
        fontSize: `${titleSize}px`, fontWeight: String(titleStyle.fontWeight),
        textAlign: String(config.titleAlign || 'left'),
        flex: String(titleStyle.flex), minWidth: "0",
      })
      titleSpan.textContent = titleText
      header.appendChild(titleSpan)
      card.appendChild(header)
    }

    // Chart fills the remaining card area. Padding mirrors AppSpecRenderer
    // (6px 12px 10px) for chart visuals so the chart breathes off the borders.
    const chartArea = document.createElement("div")
    chartArea.style.cssText = isPlain
      ? "flex:1;min-height:0;width:100%;height:100%;position:relative"
      : "flex:1;min-height:0;padding:6px 12px 10px;position:relative;box-sizing:border-box"
    card.appendChild(chartArea)

    // Table visual — render HTML table instead of ECharts
    if (visualType === 'table') {
      this.renderTableIntoArea(chartArea, dv, spec, config, theme, isDark, colorVal)
      return
    }

    const chartRoot = document.createElement("div")
    chartRoot.style.cssText = "width:100%;height:100%;position:relative"
    chartArea.appendChild(chartRoot)

    // Bar race (interaction · playback). The dataView is bound at 2-category grain
    // (category[0] = time frame, category[1] = racing category, values[0] = measure);
    // the visual builds frames + animates the rank changes with a Play/scrub control —
    // the same renderer behaviour as the web canvas, just imperative here.
    if (visualType === "bar_race") {
      this.renderBarRace(chartArea, chartRoot, dv, config, theme, isDark, colorVal)
      return
    }

    // Click-to-drill · expand-in-place (interaction-plays). When the spec carries a
    // ≥2-level drill hierarchy (bound to category1..N at publish), the visual holds
    // the finest grain and re-aggregates client-side on click — no re-query. Guarded
    // to bar-family + drillStyle 'expand'; every other visual is unchanged.
    const drillSpec = Array.isArray((spec as any).drill) ? (spec as any).drill : null
    const drillStyle = String((config as any).drillStyle || (drillSpec ? "expand" : ""))
    const isBarFamily = visualType === "bar" || visualType === "column" ||
                        visualType === "grouped_bar" || visualType === "stacked_bar"
    const nCats = dv?.categorical?.categories?.length ?? 0
    if (isBarFamily && drillSpec?.length >= 2 && drillStyle !== 'off' && nCats < drillSpec.length) {
      this.renderError(`Bind all ${drillSpec.length} category fields in hierarchy order to enable drill.`, visualType, true)
      return
    }
    const drillBound = !!(drillSpec && drillSpec.length >= 2 && isBarFamily && nCats >= 2)
    if (drillBound && drillStyle === "expand") {
      this.renderExpandDrill(chartArea, chartRoot, dv, config, theme, colorVal, visualType, drillSpec)
      return
    }
    if (drillBound && drillStyle === "replace") {
      this.renderReplaceDrill(chartArea, chartRoot, dv, config, theme, colorVal, visualType, drillSpec)
      return
    }
    if (drillBound && drillStyle === "panel") {
      this.renderPanelDrill(chartArea, chartRoot, dv, config, theme, isDark, colorVal, visualType, drillSpec)
      return
    }

    // Pull rows out of the dataView. PBI's categorical mapping gives us:
    //   categories[0].values = primary dimension values (→ _cat)
    //   values[i].values     = each measure column (→ _val, _val2, _val3 by source role)
    // When a drill hierarchy is bound but we're not expanding (replace/panel/off —
    // PBI interaction for those is a follow-up), collapse the finest (parent,child)
    // grain to the base level so the chart shows correct totals, not duplicated
    // parents (the bug where every parent repeated once per child).
    let rows = drillBound ? this.buildBaseRowsFromDataView(dv) : this.buildRowsFromDataView(dv)

    rows = prepareVisualRows(rows, visualType, config, (spec as any).template)
    this.templateRowSources = (spec as any).template ? rows.map((r: any, i: number)=>r._sourceIndex ?? i) : null
    this.primitiveVisualType = visualType
    this.primitiveCategoryNames = (dv?.categorical?.categories?.[0]?.values || []).map(v => String(this.normalizeCat(v) ?? ''))
    this.primitiveRowNames = rows.map(r => String(r._cat ?? ''))
    this.radarHoveredIndex = -1

    if (!(spec as any).template && ['waffle', 'bullet', 'progress', 'stat_card', 'metric_tile', 'funnel', 'waterfall', 'heatmap', 'ranked_list', 'chord', 'sankey', 'sunburst', 'narrative', 'insight', 'shape', 'divider'].includes(visualType)) {
      this.domVisual = mountPowerBIDomVisual(chartRoot, visualType, rows, {
        // AppSpecRenderer owns chart titles and removes them from component config.
        ...config, title: undefined, label: undefined, _T: theme,
      })
      return
    }

    // Compose through shared core using the current host/report theme. Pane
    // overrides and explicit spec themes have already been resolved above.
    let option: any
    try {
      option = ((spec as any).template ? resolveVisualSpec(spec, rows, themeContext) : applyModelFormats(applyReportTheme(composeOption(visualType, rows, { ...config, colorScheme: config.colorScheme || reportTheme.palette[0] }, theme), reportTheme, { palette: !config.colorScheme && !config.sectionColors }), spec, measureMetadata, {locale:this.host.locale,rows,width:chartRoot.clientWidth,measureText:(text,font)=>echarts.format.getTextRect(text,font).width}))
    } catch (err) {
      // Composition errors shouldn't bring down the visual — render a small
      // diagnostic so it's obvious in PBI Service which visual went wrong.
      this.renderError(`Composition failed: ${(err as Error).message}`, visualType)
      return
    }

    // A composer returns null when it can't build a chart (no rows, or a required
    // measure is missing — e.g. slope needs a 2nd measure). Render an empty state
    // instead of dereferencing null below.
    if (!option) {
      this.renderError('No data matches the current filters.', visualType, true)
      return
    }

    // Phase 5.3 polish: global option overrides for parity with Semantica.
    // - backgroundColor: transparent so we don't get a white strip behind the
    //   chart (visible in treemap, donut, gauge where the chart bleeds to the
    //   container edge). The page-level background already paints the canvas.
    // - textStyle.fontFamily: same stack as the web canvas (Inter primary).
    //   ECharts' default sans-serif looks visibly different, esp. for axis
    //   labels and tooltip text.
    option.backgroundColor ??= "transparent"
    if (typeof background === 'string' && /^#[\da-f]{6}$/i.test(background)) {
      option.backgroundColor = card.style.background
      card.style.background = 'transparent'
    }
    option.textStyle = {
      fontFamily: "Inter, 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      ...(option.textStyle || {}),
    }

    // Per-visual tooltip config (show/hide + trigger) — same helper the web canvas
    // uses, so tooltip behaviour matches on canvas, web export and PBI.
    option = applyTooltipConfig(option, config as any)
    option = applyPaneFormatting(option,paneObjects,{locale:this.host.locale,width:chartRoot.clientWidth,height:chartRoot.clientHeight,skipBorder:true,skipTitle:!isPlain&&hasTitle})
    ;(this as any).formattingOption = option
    const bindingKey = JSON.stringify([(spec as any).template?.meta?.id || visualType,
      (dv?.categorical?.categories || []).map(c=>c.source?.queryName || c.source?.displayName),
      (dv?.categorical?.values || []).map(c=>c.source?.queryName || c.source?.displayName)])
    if(bindingKey !== this.hierarchyBindingKey) {this.hierarchyNavigation.clear();this.treeCollapsed.clear()}
    this.hierarchyBindingKey = bindingKey
    for(const [index,series] of (Array.isArray(option.series)?option.series:[]).entries()) {
      if(['treemap','sunburst','tree'].includes(series.type))series.id ||= `vilsem-hierarchy-${index}`
      if(series.type==='tree') {
        const identify=(nodes:any[],path:string[]=[])=>nodes.map((node,index)=>{
          const next=[...path,JSON.stringify([node?.name ?? null,index])]
          return {...node,id:node.id ?? JSON.stringify(next),...(Array.isArray(node.children)?{children:identify(node.children,next)}:{})}
        })
        series.data=identify(series.data || [])
      }
    }

    // Save the composed option so applyChartSelection can derive selection-
    // aware overrides without recomposing.
    if (secondaryAxisMinimumWidth(option, config)) option = scrollableChartTooltip(option, chartRoot)
    this.lastOption = option

    // Render
    const minimumWidth = secondaryAxisMinimumWidth(option, config)
    if (minimumWidth) {
      chartArea.style.overflowX = 'auto'
      chartArea.tabIndex = 0
      chartArea.setAttribute('aria-label', 'Chart; scroll horizontally to view both axes')
      chartRoot.style.minWidth = `${minimumWidth}px`
    }
    this.chart = echarts.init(chartRoot)
    this.chart.setOption(this.withTreeState(option))
    this.chart.on('treeexpandandcollapse',(payload:any)=>{
      const series=this.lastOption?.series?.find(s=>s.id===payload?.seriesId && s.type==='tree')
      if(!series)return
      const pending=(series.data || []).map(node=>({node,depth:1})).reverse();let index=0
      while(pending.length && index<10000) {
        const entry=pending.pop()!;index++
        if(index===payload.dataIndex) {
          const states=this.treeCollapsed.get(series.id) || new Map<string,boolean>()
          const limit=series.initialTreeDepth ?? 2
          const collapsed=states.get(entry.node.id) ?? entry.node.collapsed ?? (limit>=0 && entry.depth>limit)
          states.set(entry.node.id,!collapsed);this.treeCollapsed.set(series.id,states);break
        }
        if(Array.isArray(entry.node.children))pending.push(...entry.node.children.map(node=>({node,depth:entry.depth+1})).reverse())
      }
    })
    for(const type of ['treemapRootToNode','treemapZoomToNode','sunburstRootToNode']) {
      this.chart.on(type.toLowerCase(),(payload:any)=>{
        const seriesId=payload?.seriesId, node=payload?.targetNode
        const targetNodeId=payload?.targetNodeId ?? node?.getId?.()
        if(typeof seriesId!=='string')return
        if(type!=='treemapZoomToNode') {
          for(const [key,action] of this.hierarchyNavigation)if(action.seriesId===seriesId)this.hierarchyNavigation.delete(key)
          if(node?.depth===0)return // breadcrumb returned to the virtual root
        }
        if(typeof targetNodeId==='string')this.hierarchyNavigation.set(`${seriesId}:${type}`,{type,seriesId,targetNodeId})
      })
    }

    // ── Radar: per-indicator tooltip via ZR mousemove ──────────────────────
    // ECharts radar always shows all indicators in one tooltip. Wire ZR mousemove
    // to track which spoke the cursor is nearest to, then override the formatter
    // so only that indicator's value is shown — same technique as the web canvas.
    if (visualType === 'radar') {
      const indicators: any[] = (option as any)?.radar?.indicator ?? []
      let hoveredIdx = -1
      const zr = this.chart.getZr()
      zr.on('mousemove', (e: any) => {
        const N = indicators.length
        if (!N) { hoveredIdx = this.radarHoveredIndex = -1; return }
        const { clientWidth: W, clientHeight: H } = chartRoot
        const cx = W / 2, cy = H / 2
        const dx = (e.offsetX as number) - cx
        const dy = (e.offsetY as number) - cy
        if (Math.sqrt(dx * dx + dy * dy) < 12) { hoveredIdx = this.radarHoveredIndex = -1; return }
        const mouseAngle = (((Math.atan2(-dy, dx) * 180 / Math.PI) % 360) + 360) % 360
        let closest = 0, minDiff = Infinity
        for (let i = 0; i < N; i++) {
          const iAngle = (((90 + (i / N) * 360) % 360) + 360) % 360
          let diff = Math.abs(mouseAngle - iAngle)
          if (diff > 180) diff = 360 - diff
          if (diff < minDiff) { minDiff = diff; closest = i }
        }
        hoveredIdx = this.radarHoveredIndex = closest
      })
      zr.on('mouseout', () => { hoveredIdx = this.radarHoveredIndex = -1 })

      const accentColor = colorValFor(config.colorScheme)
      const pre = config.prefix as string | undefined
      const suf = config.suffix as string | undefined
      const fmtV = (v: unknown): string => {
        if (v == null) return '–'
        const n = Number(v)
        if (isNaN(n)) return String(v)
        const abs = Math.abs(n)
        let body: string
        if (abs >= 1e9) body = (n / 1e9).toFixed(1) + 'B'
        else if (abs >= 1e6) body = (n / 1e6).toFixed(1) + 'M'
        else if (abs >= 1e3) body = (n / 1e3).toFixed(1) + 'K'
        else body = n.toLocaleString('en-US', { maximumFractionDigits: 2 })
        return (pre || '') + body + (suf || '')
      }
      const shadow = isDark ? '0 12px 28px rgba(0,0,0,0.48)' : '0 8px 24px rgba(0,0,0,0.12)'
      const wrapFn = (inner: string) =>
        `<div style="background:${theme.echartsTooltipBg};border:1px solid ${theme.echartsTooltipBorder};border-radius:10px;padding:10px 13px;min-width:140px;box-shadow:${shadow};color:${theme.echartsTooltipText}">${inner}</div>`
      const mkRow = (name: string, v: unknown) =>
        `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;padding:2px 0">` +
        `<span style="color:${theme.echartsLegendText}">${escapeHtml(name)}</span>` +
        `<span style="color:${accentColor};font-weight:700">${escapeHtml(fmtV(v))}</span></div>`

      const radarFormatter = (params: any) => {
        const vals: unknown[] = Array.isArray(params.value) ? params.value : [params.value]
        const idx = hoveredIdx
        if (idx >= 0 && idx < vals.length && indicators[idx]) {
          return wrapFn(mkRow(indicators[idx].name, vals[idx]))
        }
        return wrapFn(vals.map((v, i) => mkRow(indicators[i]?.name ?? '', v)).join(''))
      }
      this.chart.setOption({
        tooltip: { ...((option as any).tooltip || {}), formatter: radarFormatter },
      }, false)
      // Keep lastOption in sync with our custom formatter so applyChartSelection
      // (called at end of renderPrimitiveChart with no selection) restores the
      // chart with the ZR-based formatter and not the RadarMarks default that
      // shows all indicator values at once.
      this.lastOption = {
        ...option,
        tooltip: { ...((option as any).tooltip || {}), formatter: radarFormatter },
      }
    }

    // ── Phase 5.3: click → selection (cross-filter) ────────────────────────
    // Only wire when a category is bound — KPI-style spec without categories
    // has nothing to select against.
    const cat = dv?.categorical
    const categories = cat?.categories?.[0]
    if (categories && Array.isArray(categories.values) && categories.values.length > 0) {
      const selectionIds: powerbi.visuals.ISelectionId[] = []
      for (let i = 0; i < categories.values.length; i++) {
        selectionIds.push(
          (cat?.categories || []).reduce((builder, column) => builder.withCategory(column, i), this.host.createSelectionIdBuilder()).createSelectionId()
        )
      }

      this.currentSelectionIds = selectionIds
      const highlighted = (cat?.values || []).filter(column => Array.isArray(column.highlights))
      this.highlightIndexes = highlighted.length ? new Set<number>() : null
      highlighted.forEach(column => column.highlights!.forEach((value, index) => {
        if (value !== null && value !== undefined) this.highlightIndexes!.add(index)
      }))
      this.chart.on("contextmenu", (params: any) => {
        const indexes = this.primitiveCategoryIndexes(params)
        const index = indexes[0]
        const event = params?.event?.event
        event?.preventDefault?.()
        if (selectionIds[index]) this.selectionManager.showContextMenu(selectionIds[index], { x: event?.clientX || 0, y: event?.clientY || 0 })
      })
      const tooltip = this.host.tooltipService
      if (tooltip?.enabled() && option?.tooltip?.show !== false) {
        this.chart.setOption({ tooltip: { show: false } }, false)
        this.lastOption = { ...this.lastOption, tooltip: { ...this.lastOption?.tooltip, show: false } }
        const showTooltip = (params: any) => {
          const indexes = this.primitiveCategoryIndexes(params)
          const index = indexes[0]
          if (!selectionIds[index]) return
          const event = params?.event?.event
          const series=this.lastOption?.series?.[params?.seriesIndex ?? 0]
          const radar=series?.type==='radar' ? (Array.isArray(this.lastOption?.radar)?this.lastOption.radar[series.radarIndex ?? 0]:this.lastOption?.radar) : null
          const modelFormatter = series?.tooltip?.valueFormatter
          const boundFields=series?.type==='heatmap' && modelFormatter?.vilsemDirectBinding!==false ? [...(cat?.categories || []),...(cat?.values || [])].map(column=>({name:column.source?.displayName || column.source?.queryName || 'Value',value:column.values[index],isDate:column.source?.type?.dateTime===true,format:scopedMeasureFormat(spec,column.source?.displayName) ?? column.source?.format,locale:this.host.locale})) : undefined
          const seriesFormatter = series?.tooltip?.formatter || (typeof series?.tooltip?.valueFormatter==='function' ? p=>series.tooltip.valueFormatter(Array.isArray(p?.value)?p.value[series.tooltip.valueFormatter.vilsemValueIndex ?? p.value.length-1]:p?.value) : this.lastOption?.tooltip?.formatter)
          const categoryItems = modelFormatter?.vilsemDirectBinding===false
            ? [{displayName:'Group',value:String(params?.data?.label ?? params?.name ?? params?.seriesName ?? 'Value')}]
            : (cat?.categories || []).map(column => ({ displayName: column.source?.displayName || 'Category', value: column.values[index] == null ? '(Blank)' : String(column.values[index]) }))
          const modelItems=Array.isArray(params?.value) && Array.isArray(modelFormatter?.vilsemTupleFields)
            ? modelFormatter.vilsemTupleFields.flatMap((field,index)=>field?[{displayName:field.name,value:field.format(params.value[index])}]:[])
            : modelFormatter?.vilsemMeasureName && !Array.isArray(params?.value) ? [{displayName:modelFormatter.vilsemMeasureName,value:modelFormatter(params?.value)}] : []
          const dataItems = this.templateRowSources !== null
            ? (radar && modelFormatter && !series?.tooltip?.formatter && !this.lastOption?.tooltip?.formatter
              ? nativeTemplateTooltipItems(params,undefined,radar.indicator,undefined,modelFormatter)
              : boundFields && !series?.tooltip?.formatter && !this.lastOption?.tooltip?.formatter
              ? nativeTemplateTooltipItems(params,undefined,undefined,boundFields)
              : !series?.tooltip?.formatter && modelItems.length
              ? [...categoryItems, ...modelItems]
              : nativeTemplateTooltipItems(params,seriesFormatter,radar?.indicator,boundFields))
            : [...categoryItems, ...(cat?.values || []).map(column => ({ displayName: column.source?.displayName || "Value", value: createModelFormatter(scopedMeasureFormat(spec,column.source?.displayName) ?? column.source?.format,{locale:this.host.locale})(column.values[index]) }))]
          tooltip.show({ coordinates: [event?.clientX || 0, event?.clientY || 0], isTouchEvent: false, identities: indexes.map(i=>selectionIds[i]).filter(Boolean), dataItems })
        }
        this.chart.on("mouseover", showTooltip)
        this.chart.on("mousemove", showTooltip)
        this.chart.on("mouseout", () => tooltip.hide({ isTouchEvent: false, immediately: true }))
      }
      this.chart.on("click", (params: any) => {
        const indexes = this.primitiveCategoryIndexes(params)
        const idx = indexes[0]
        if (idx == null || idx < 0 || idx >= selectionIds.length) return
        const ev = params?.event?.event as MouseEvent | undefined
        const multi = !!(ev && (ev.ctrlKey || ev.metaKey))
        this.selectionManager.select(indexes.length > 1 ? indexes.map(i=>selectionIds[i]) : selectionIds[idx], multi).then((selected) => {
          this.applyChartSelection(selectionIds, selected as powerbi.visuals.ISelectionId[])
        })
      })

      // Click on empty chart area (not on a data point) clears selection.
      // ECharts emits 'click' on zr (the canvas) for background clicks where
      // params is undefined; chart.getZr().on works for the raw canvas.
      this.chart.getZr().on("click", (zrEvent: any) => {
        if (zrEvent?.target) return  // click landed on a series item; series.on already handled it
        this.selectionManager.clear().then(() => {
          this.applyChartSelection(selectionIds, [])
        })
      })

      // Re-apply current selection after re-render (cross-highlight from other visuals).
      this.applyChartSelection(
        selectionIds,
        this.selectionManager.getSelectionIds() as powerbi.visuals.ISelectionId[],
      )
    }
  }

  // ECharts indexes marks, whereas SelectionIds index the original DataView.
  // Sorting, treemap's virtual root and slope endpoints make these different.
  private primitiveCategoryIndexes(params: any): number[] {
    if(this.templateRowSources !== null) {
      if(['tree','treemap','sunburst'].includes(params?.seriesType) && !Array.isArray(params?.data?.rowIndexes))return []
      const indexes = Array.isArray(params?.data?.rowIndexes) ? params.data.rowIndexes : [params?.dataIndex]
      return [...new Set<number>(indexes.filter((i: any)=>Number.isInteger(i)&&i>=0).map((i: number)=>this.templateRowSources![i]).filter((i: number)=>i!=null))]
    }
    const index=this.primitiveCategoryIndex(params)
    return index<0?[]:[index]
  }

  private primitiveCategoryIndex(params: any): number {
    let name: unknown
    if (this.primitiveVisualType === 'slope') name = params?.seriesName
    else if (this.primitiveVisualType === 'radar') {
      if (this.radarHoveredIndex < 0) return -1
      name = this.primitiveRowNames[this.radarHoveredIndex]
    } else {
      name = params?.data?.name ?? params?.name
      if (name == null || !this.primitiveCategoryNames.includes(String(name))) {
        if (this.primitiveVisualType === 'lollipop' && Array.isArray(params?.value)) {
          const axis = this.lastOption?.xAxis
          const xAxis = Array.isArray(axis) ? axis[0] : axis
          name = params.value[xAxis?.type === 'category' ? 0 : 1]
        } else name = this.primitiveRowNames[params?.dataIndex]
      }
    }
    return name == null ? -1 : this.primitiveCategoryNames.indexOf(String(name))
  }

  // Update chart visual emphasis based on current selection. Mirrors PBI's
  // native dim-others behavior: selected items render at full alpha, the rest
  // dim to ~25% opacity. We mutate per-item itemStyle on a CLONE of the
  // composed option — the original (this.lastOption) stays pristine so
  // re-renders without selection (or with a different selection) restore
  // cleanly.
  //
  // Why not dispatchAction({type:'highlight'}): ECharts highlight EMPHASIZES
  // selected (slight bolder/larger) but doesn't dim others by default, so
  // selection didn't read as PBI-native. Per-item opacity is the same approach
  // the web canvas uses (BarMarks itemStyle.opacity computation).
  private applyChartSelection(
    selectionIds: powerbi.visuals.ISelectionId[],
    selected: powerbi.visuals.ISelectionId[],
  ): void {
    if (!this.chart || !this.lastOption) return

    if (!selected.length && this.highlightIndexes === null) {
      // No selection — restore the pristine composed option.
      this.setSelectionOption(this.lastOption)
      return
    }

    const selectedSet = new Set<number>()
    selectionIds.forEach((selId, i) => {
      if (selected.some((s) => s.equals(selId))) selectedSet.add(i)
    })
    // A bookmark/local selection may reference rows removed by a slicer or
    // rebound field. Keep the host's selection, but do not dim the entire new
    // result when no current identity matches it.
    const hasVisibleSelection = selectedSet.size > 0
    if (this.highlightIndexes !== null) {
      if (!hasVisibleSelection) this.highlightIndexes.forEach(index => selectedSet.add(index))
      else selectedSet.forEach(index => { if (!this.highlightIndexes!.has(index)) selectedSet.delete(index) })
    }
    if (selectedSet.size === 0 && this.highlightIndexes === null) {
      this.setSelectionOption(this.lastOption)
      return
    }

    // Clone the branches we change. JSON cloning loses formatter/symbolSize
    // functions and changes chart semantics merely because a user selected it.
    const cloned = { ...this.lastOption, series: (this.lastOption.series || []).map((s: any) => ({ ...s })) }
    const series = Array.isArray(cloned.series) ? cloned.series : []
    for (const s of series) {
      if (!Array.isArray(s.data)) continue
      // Radar has one polygon spanning all categories, not one mark per row.
      if (this.primitiveVisualType === 'radar') continue
      if (this.primitiveVisualType === 'slope') {
        const selectedSeries = selectedSet.has(this.primitiveCategoryIndex({ seriesName: s.name }))
        s.lineStyle = { ...s.lineStyle, opacity: selectedSeries ? (s.lineStyle?.opacity ?? 1) : 0.25 }
      }
      const styleDatum=(d:any,i:number):any=>{
        const categoryIndex = this.primitiveCategoryIndex({ dataIndex: i, data: d, name: d?.name, value: Array.isArray(d) ? d : d?.value, seriesName: s.name })
        const structural = this.templateRowSources !== null && Array.isArray(d?.children) && !d?.rowIndexes?.length
        const isSelected = structural || (this.templateRowSources !== null ? this.primitiveCategoryIndexes({dataIndex:i,data:d}).some(index=>selectedSet.has(index)) : selectedSet.has(categoryIndex))
        const factor = isSelected ? 1 : 0.25
        const item = d != null && typeof d === 'object' && !Array.isArray(d) ? d : null
        const baseOpacity = item?.itemStyle?.opacity ?? s.itemStyle?.opacity ?? 1
        const opacity = baseOpacity * factor
        const labelStyle = item?.label && typeof item.label === 'object' ? item.label : null
        const label = labelStyle || s.label?.show
          ? { label: { ...labelStyle, opacity: (labelStyle?.opacity ?? s.label?.opacity ?? 1) * factor } }
          : {}
        // Data items can be raw values (number/string) or objects with
        // {value, itemStyle, ...}. Normalize to the object form so we can
        // attach itemStyle.opacity without losing the existing fields.
        if (Array.isArray(d)) return { value: [...d], itemStyle: { opacity }, ...label }
        if (d != null && typeof d === "object") {
          const existing = d.itemStyle && typeof d.itemStyle === "object" ? d.itemStyle : {}
          return { ...d, itemStyle: { ...existing, opacity }, ...label,...(Array.isArray(d.children)?{children:d.children.map(styleDatum)}:{}) }
        }
        return { value: d, itemStyle: { opacity }, ...label }
      }
      s.data = s.data.map(styleDatum)
      for(const key of ['links','edges']) if(Array.isArray(s[key])) {
        s[key]=s[key].map((edge:any,index:number)=>{
          if(!Array.isArray(edge?.rowIndexes))return edge
          const active=this.primitiveCategoryIndexes({dataIndex:index,data:edge}).some(i=>selectedSet.has(i))
          const base=edge.lineStyle?.opacity ?? s.lineStyle?.opacity ?? 1
          return {...edge,lineStyle:{...edge.lineStyle,opacity:base*(active?1:0.25)}}
        })
      }
    }
    // `notMerge: true` so ECharts replaces the option wholesale — avoids
    // leftover styles from the previous selection state bleeding through.
    this.setSelectionOption(cloned)

  }

  private setSelectionOption(option:any): void {
    this.chart!.setOption(this.withTreeState(option),true)
    // Replacing selection styles rebuilds ECharts' tree nodes. Restore only
    // stable ids still present in the new data, using public navigation actions.
    // Silent dispatch avoids recording our own restore as new user navigation.
    for(const [key,action] of this.hierarchyNavigation) {
      const series=(Array.isArray(option.series)?option.series:[]).find(s=>s.id===action.seriesId)
      const pending=[...(series?.data || [])];let found=false,visited=0
      while(pending.length && visited++<10000) {
        const node=pending.pop()
        if(String(node?.id ?? node?.name ?? '')===action.targetNodeId){found=true;break}
        if(Array.isArray(node?.children))pending.push(...node.children)
      }
      if(found)this.chart!.dispatchAction(action,{silent:true})
      else this.hierarchyNavigation.delete(key)
    }
  }

  private withTreeState(option:any): any {
    if(!Array.isArray(option.series) || !this.treeCollapsed.size)return option
    return {...option,series:option.series.map((series:any)=>{
      const states=this.treeCollapsed.get(series.id)
      if(series.type!=='tree' || !states)return series
      const seen=new Set<string>()
      const apply=(nodes:any[])=>nodes.map(node=>{
        seen.add(node.id)
        return {...node,...(states.has(node.id)?{collapsed:states.get(node.id)}:{}),...(Array.isArray(node.children)?{children:apply(node.children)}:{})}
      })
      const data=apply(series.data || [])
      for(const id of states.keys())if(!seen.has(id))states.delete(id)
      return {...series,data}
    })}
  }

  // Expand-in-place drill (pattern 02) for a PBI visual. The multi-category dataView
  // holds the finest (parent,child) grain; we aggregate to parents when collapsed and
  // shape to children beside greyed siblings when expanded — recomposing the ECharts
  // option on click (no re-query, since a PBI visual can't). A pill shows the level +
  // a Collapse button. Reuses the exact shared builder the web canvas uses.
  private renderExpandDrill(
    chartArea: HTMLElement,
    chartRoot: HTMLElement,
    dv: DataView,
    config: Record<string, unknown>,
    theme: typeof DARK_THEME,
    colorVal: string,
    visualType: string,
    drillSpec: Array<{ table: string; column: string }>,
  ): void {
    const cat = dv?.categorical
    const parentVals = cat?.categories?.[0]?.values ?? []
    const childVals  = cat?.categories?.[1]?.values ?? []
    const measure0   = cat?.values?.[0]?.values ?? []
    const finest: Array<{ _cat: string; _cat2: string; _val: number }> = []
    for (let i = 0; i < parentVals.length; i++) {
      finest.push({
        _cat:  String(this.normalizeCat(parentVals[i])),
        _cat2: String(this.normalizeCat(childVals[i])),
        _val:  Number(measure0[i]) || 0,
      })
    }

    const isHorizontal = String(config.orientation || (visualType === "bar" ? "horizontal" : "vertical")) === "horizontal"
    const maxBarWidth = Number(config.maxBarSize ?? 26)
    const showDataLabels = config.dataLabels !== false

    const sumByParent = (rows: Array<{ _cat: string; _val: number }>) => {
      const m = new Map<string, number>()
      for (const r of rows) m.set(r._cat, (m.get(r._cat) || 0) + (Number(r._val) || 0))
      return Array.from(m, ([_cat, _val]) => ({ _cat, _val })).sort((a, b) => b._val - a._val)
    }

    // Stack a pill above the chart (collapse control). chartArea becomes a column.
    chartArea.style.display = "flex"
    chartArea.style.flexDirection = "column"
    chartRoot.style.cssText = "flex:1;min-height:0;width:100%;position:relative"
    const pill = document.createElement("div")
    pill.style.cssText = "display:none;align-items:center;gap:8px;padding:0 2px 6px;flex-shrink:0"
    chartArea.insertBefore(pill, chartRoot)

    this.chart = echarts.init(chartRoot)

    const draw = () => {
      const expanded = this.drillExpanded
      const displayRows = expanded ? shapeExpandInPlace(finest, expanded) : sumByParent(finest)
      const option = buildExpandBarOption(displayRows, {
        isHorizontal, palStart: colorVal, t: theme, maxBarWidth, showDataLabels, expandedValue: expanded,
      })
      option.backgroundColor = "transparent"
      option.textStyle = { fontFamily: "Inter, 'Segoe UI', -apple-system, sans-serif", ...(option.textStyle || {}) }
      this.chart!.setOption(option, true) // notMerge → universalTransition morph
      if (expanded) {
        const childLabel = drillSpec[1]?.column || "detail"
        pill.style.display = "flex"
        pill.replaceChildren()
        const tag = document.createElement("span")
        tag.style.cssText = `font-size:10.5px;font-family:monospace;letter-spacing:.04em;color:${theme.textPrimary};border:1px solid ${theme.headerBorder};border-radius:999px;padding:3px 9px;white-space:nowrap`
        tag.textContent = `Level: ${childLabel} · ${expanded}`
        const collapse = document.createElement("button")
        collapse.style.cssText = `font:inherit;font-size:11px;color:${theme.textMuted};background:none;border:1px solid ${theme.headerBorder};border-radius:7px;padding:3px 10px;cursor:pointer`
        collapse.textContent = "Collapse"
        collapse.onclick = () => { this.drillExpanded = null; draw() }
        pill.appendChild(tag)
        pill.appendChild(collapse)
      } else {
        pill.style.display = "none"
      }
    }

    this.chart.on("click", (params: any) => {
      const name = params?.name
      if (name != null && this.drillExpanded == null) { this.drillExpanded = String(name); draw() }
    })

    draw()
  }

  // Bar race (interaction · playback). 2-category dataView (category[0] = time frame,
  // category[1] = racing category, values[0] = measure). Builds chronological frames
  // and animates rank changes via a MERGE setOption (bars slide to new positions),
  // driven by a Play/Pause + scrub control. Mirrors CompactBarRaceEcharts on the web.
  private renderBarRace(
    chartArea: HTMLElement,
    chartRoot: HTMLElement,
    dv: DataView,
    config: Record<string, unknown>,
    theme: typeof DARK_THEME,
    isDark: boolean,
    colorVal: string,
  ): void {
    const cat = dv?.categorical
    const timeVals = cat?.categories?.[0]?.values ?? []
    const catVals  = cat?.categories?.[1]?.values ?? []
    const measure0 = cat?.values?.[0]?.values ?? []

    // Group into frames keyed by the time value; each frame holds {name, value}.
    const byFrame = new Map<string, Array<{ name: string; value: number }>>()
    for (let i = 0; i < timeVals.length; i++) {
      const frame = String(this.normalizeCat(timeVals[i]))
      const name = String(this.normalizeCat(catVals[i]))
      const value = Number(measure0[i]) || 0
      if (!byFrame.has(frame)) byFrame.set(frame, [])
      byFrame.get(frame)!.push({ name, value })
    }
    const frameKeys = Array.from(byFrame.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    const baseFrames = frameKeys.map(k => ({ label: k, items: byFrame.get(k)! }))

    // Cumulative mode — running total per category across the play axis (mirrors
    // CompactBarRaceEcharts.accumulateFrames). Bars only ever grow; a category that
    // skips a frame keeps its accumulated total.
    const accumulate = (sourceFrames: Array<{ label: string; items: Array<{ name: string; value: number }> }>) => {
      const running = new Map<string, number>()
      return sourceFrames.map(f => {
        for (const it of f.items) running.set(it.name, (running.get(it.name) || 0) + it.value)
        return { label: f.label, items: Array.from(running.entries()).map(([name, value]) => ({ name, value })) }
      })
    }
    const frames = String(config.raceMode) === "cumulative" ? accumulate(baseFrames) : baseFrames

    if (!frames.length) { this.renderError('No data matches the current filters.', 'bar_race', true); return }

    const topN = Number(config.limit) || 8
    const speed = Number(config.playSpeed) || 620
    const showLabels = config.dataLabels !== false
    const prefix = String(config.valuePrefix || "")
    const suffix = String(config.valueSuffix || "")
    const perCat = String(config.barColorMode || "category") === "category"
    const palette = ["#58AECB", "#5FBF9B", "#E0A458", "#9B8AC4", "#C97B84", "#7FA8D9", "#8BCF7F", "#D98CC0", "#6FD3C7", "#E8B15E"]
    const colorMap: Record<string, string> = {}
    let ci = 0
    for (const f of frames) for (const it of f.items) if (!(it.name in colorMap)) colorMap[it.name] = palette[ci++ % palette.length]
    // Explicit per-category colours (config.categoryColors) win over the auto palette,
    // matching the web renderer's colorFor.
    const catColors = (config.categoryColors ?? null) as Record<string, string> | null
    const colorFor = (name: string) => (catColors && catColors[name]) || (perCat ? (colorMap[name] || colorVal) : colorVal)
    const fmt = (n: number): string => {
      const a = Math.abs(n)
      if (a >= 1e9) return (n / 1e9).toFixed(1) + "B"
      if (a >= 1e6) return (n / 1e6).toFixed(1) + "M"
      if (a >= 1e3) return (n / 1e3).toFixed(1) + "k"
      return String(Math.round(n))
    }

    // Play bar above the chart.
    chartArea.style.display = "flex"
    chartArea.style.flexDirection = "column"
    chartRoot.style.cssText = "flex:1;min-height:0;width:100%;position:relative"
    const ctrls = document.createElement("div")
    ctrls.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:2px 2px 8px;flex-shrink:0;max-height:100%;overflow-y:auto;box-sizing:border-box"
    const btn = document.createElement("button")
    const scrub = document.createElement("input")
    scrub.type = "range"; scrub.min = "0"; scrub.max = String(Math.max(0, frames.length - 1)); scrub.step = "1"; scrub.value = "0"
    scrub.ariaLabel = "Playback timeline"
    scrub.style.cssText = `flex:1 1 64px;width:64px;min-width:0;max-width:100%;cursor:pointer;accent-color:${colorVal}`
    const tick = document.createElement("div")
    tick.style.cssText = `font-family:monospace;font-size:11px;color:${theme.textMuted};min-width:0;max-width:100%;margin-left:auto;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`
    ctrls.appendChild(btn); ctrls.appendChild(scrub); ctrls.appendChild(tick)
    chartArea.insertBefore(ctrls, chartRoot)

    this.chart = echarts.init(chartRoot)
    let idx = 0
    let playing = false
    const anim = Math.max(200, Math.min(560, speed - 60))

    const setBtn = () => {
      btn.style.cssText = `font:inherit;font-size:11px;font-weight:600;cursor:pointer;padding:4px 12px;border-radius:6px;white-space:nowrap;border:1px solid ${playing ? colorVal : theme.headerBorder};background:${playing ? colorVal : "transparent"};color:${playing ? "#0b0b12" : theme.textMuted}`
      btn.textContent = playing ? "❚❚ Pause" : "▶ Play"
    }
    const draw = () => {
      const fr = frames[Math.min(idx, frames.length - 1)]
      if (!fr) return
      const items = [...fr.items].sort((a, b) => a.value - b.value).slice(-topN)
      this.chart!.setOption(applyTooltipConfig(applyAxisTextConfig({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, 'Segoe UI', sans-serif" },
        grid: { left: 8, right: 74, top: 8, bottom: 16, containLabel: true },
        tooltip: { trigger: "item", confine: true },
        xAxis: { type: "value", axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, animationDurationUpdate: anim },
        yAxis: { type: "category", data: items.map(d => d.name), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: theme.textMuted, fontSize: 12 }, animationDurationUpdate: anim },
        series: [{
          type: "bar", barMaxWidth: 26,
          data: items.map(d => ({ value: d.value, itemStyle: { color: colorFor(d.name), borderRadius: [0, 4, 4, 0] } })),
          label: showLabels ? { show: true, position: "right", color: theme.textMuted, fontSize: 11, formatter: (x: any) => prefix + fmt(x.value) + suffix } : { show: false },
          animationDurationUpdate: anim, animationEasingUpdate: "linear",
        }],
        animationDurationUpdate: anim, animationEasingUpdate: "linear",
      }, config), config))
      tick.textContent = fr.label
      tick.title = fr.label
      scrub.value = String(idx)
    }
    const stop = () => {
      if (this.raceTimer != null) { clearInterval(this.raceTimer); this.raceTimer = null }
      playing = false; setBtn()
    }
    const play = () => {
      if (frames.length < 2) return
      if (idx >= frames.length - 1) idx = 0
      playing = true; setBtn()
      this.raceTimer = window.setInterval(() => {
        idx++
        draw()
        if (idx >= frames.length - 1) stop()
      }, speed)
    }
    btn.onclick = () => { playing ? stop() : play() }
    scrub.oninput = () => { stop(); idx = Number(scrub.value); draw() }
    setBtn()
    draw()
  }

  // dataView.categorical → primitive rows. Each row is the column-aligned slice
  // across categories[0] + values[0..N]. Skips rows where _val is null.
  //
  // PBI delivers Date columns as native JavaScript Date objects in
  // categories[i].values. The web app's queryTable returns ISO date strings
  // ("2020-01-01") because that's what the primitive formatters (formatAxisLabel)
  // expect. If we left Date objects in place, ECharts category-axis tick labels
  // would render as `Date.toString()` (e.g. "Wed Jan 01 2020 00:00:00 GMT-0600
  // (Central Standard Time)") — visible across all line/area visuals.
  // Normalize to ISO date string so formatAxisLabel matches.
  // Finest (parent,child) rows keyed by each level's COLUMN name so the shared
  // aggregateDrillLevel's colOf can read r[level.column]; measures on _val/_val2/_val3.
  private buildFinestDrillRows(
    dv: DataView, levels: Array<{ table: string; column: string }>,
  ): { rows: any[]; measureKeys: string[]; colOf: (r: any, l: any) => unknown } {
    const cat = dv?.categorical
    const c0 = cat?.categories?.[0]?.values ?? []
    const v0 = cat?.values?.[0]?.values ?? []
    const v1 = cat?.values?.[1]?.values ?? []
    const v2 = cat?.values?.[2]?.values ?? []
    const has2 = v1.length > 0, has3 = v2.length > 0
    const fieldKey = (level: { table: string; column: string }) => `${level.table}[${level.column}]`
    const rows: any[] = []
    for (let i = 0; i < c0.length; i++) {
      const r: any = { _val: Number(v0[i]) || 0 }
      if (has2) r._val2 = Number(v1[i]) || 0
      if (has3) r._val3 = Number(v2[i]) || 0
      levels.forEach((level, index) => {
        r[fieldKey(level)] = String(this.normalizeCat(cat?.categories?.[index]?.values?.[i]))
      })
      rows.push(r)
    }
    const measureKeys = has3 ? ["_val", "_val2", "_val3"] : has2 ? ["_val", "_val2"] : ["_val"]
    return { rows, measureKeys, colOf: (r: any, l: any) => r[fieldKey(l)] }
  }

  private styleChartOption(option: any, theme: typeof DARK_THEME, config: Record<string, unknown>): any {
    if (!option) return option
    option.backgroundColor = "transparent"
    option.textStyle = { fontFamily: "Inter, 'Segoe UI', -apple-system, sans-serif", ...(option.textStyle || {}) }
    return applyTooltipConfig(applyAxisTextConfig(option, config), config)
  }

  // Replace drill (pattern 03·replace): click drills a level deeper in place —
  // re-aggregate the finest grain to the current path, render via composeOption,
  // with a breadcrumb to pop back. Client-side (no re-query).
  private renderReplaceDrill(
    chartArea: HTMLElement, chartRoot: HTMLElement, dv: DataView,
    config: Record<string, unknown>, theme: typeof DARK_THEME, colorVal: string,
    visualType: string, levels: Array<{ table: string; column: string }>,
  ): void {
    const { rows: finest, measureKeys, colOf } = this.buildFinestDrillRows(dv, levels)
    const maxDepth = levels.length - 1
    const isHorizontal = String(config.orientation || (visualType === "bar" ? "horizontal" : "vertical")) === "horizontal"
    const maxBarWidth = Number(config.maxBarSize ?? 26)
    const showDataLabels = config.dataLabels !== false
    chartArea.style.display = "flex"; chartArea.style.flexDirection = "column"
    chartRoot.style.cssText = "flex:1;min-height:0;width:100%;position:relative"
    const bar = document.createElement("div")
    bar.style.cssText = "display:none;align-items:center;gap:5px;flex-wrap:wrap;padding:0 2px 5px;flex-shrink:0;font-size:11px"
    chartArea.insertBefore(bar, chartRoot)
    this.chart = echarts.init(chartRoot)

    const crumb = (label: string, toDepth: number, active: boolean): HTMLElement => {
      if (active) {
        const s = document.createElement("span")
        s.style.cssText = `color:${theme.textPrimary};font-weight:600`
        s.textContent = label
        return s
      }
      const b = document.createElement("button")
      b.style.cssText = `background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:11px;color:${theme.textMuted};text-decoration:underline;text-underline-offset:2px`
      b.textContent = label
      b.onclick = () => { this.replacePath = this.replacePath.slice(0, toDepth); draw() }
      return b
    }
    const draw = () => {
      const rows = aggregateDrillLevel(finest, levels, this.replacePath, measureKeys, colOf)
      rows.sort((a: any, b: any) => (Number(b._val) || 0) - (Number(a._val) || 0))
      const option = buildExpandBarOption(rows, { isHorizontal, palStart: colorVal, t: theme, maxBarWidth, showDataLabels, expandedValue: null })
      this.chart!.setOption(this.styleChartOption(option, theme, config), true)
      if (this.replacePath.length > 0) {
        bar.style.display = "flex"; bar.replaceChildren()
        const up = document.createElement("button")
        up.style.cssText = `background:none;border:none;padding:0 4px 0 0;cursor:pointer;font-size:13px;color:${theme.textMuted}`
        up.textContent = "↰"
        up.onclick = () => { this.replacePath = this.replacePath.slice(0, -1); draw() }
        bar.appendChild(up)
        bar.appendChild(crumb(levels[0].column, 0, false))
        this.replacePath.forEach((v, i) => {
          const sep = document.createElement("span"); sep.style.opacity = "0.45"; sep.textContent = "›"; bar.appendChild(sep)
          bar.appendChild(crumb(v, i + 1, i === this.replacePath.length - 1))
        })
      } else bar.style.display = "none"
    }
    this.chart.on("click", (params: any) => {
      const name = params?.name
      if (name != null && this.replacePath.length < maxDepth) { this.replacePath = [...this.replacePath, String(name)]; draw() }
    })
    draw()
  }

  // Detail panel (pattern 01): click a bar → a drawer beside the chart lists that
  // value's children as a table. Chart stays at base level. Client-side.
  private renderPanelDrill(
    chartArea: HTMLElement, chartRoot: HTMLElement, dv: DataView,
    config: Record<string, unknown>, theme: typeof DARK_THEME, isDark: boolean, colorVal: string,
    visualType: string, levels: Array<{ table: string; column: string }>,
  ): void {
    const { rows: finest, measureKeys, colOf } = this.buildFinestDrillRows(dv, levels)
    const isHorizontal = String(config.orientation || (visualType === "bar" ? "horizontal" : "vertical")) === "horizontal"
    const maxBarWidth = Number(config.maxBarSize ?? 26)
    const showDataLabels = config.dataLabels !== false
    chartArea.style.display = "flex"; chartArea.style.flexDirection = "row"; chartArea.style.gap = "0px"
    chartRoot.style.cssText = "flex:1;min-width:0;height:100%;position:relative"
    const drawer = document.createElement("div")
    drawer.style.cssText = "width:0;overflow:hidden;flex-shrink:0"
    chartArea.appendChild(drawer)
    this.chart = echarts.init(chartRoot)

    const fmt = (n: number): string => {
      const a = Math.abs(n)
      if (a >= 1e9) return (n / 1e9).toFixed(1) + "B"
      if (a >= 1e6) return (n / 1e6).toFixed(1) + "M"
      if (a >= 1e3) return (n / 1e3).toFixed(1) + "k"
      return String(Math.round(n))
    }
    const drawChart = () => {
      const rows = aggregateDrillLevel(finest, levels, [], measureKeys, colOf)
      rows.sort((a: any, b: any) => (Number(b._val) || 0) - (Number(a._val) || 0))
      const option = buildExpandBarOption(rows, { isHorizontal, palStart: colorVal, t: theme, maxBarWidth, showDataLabels, expandedValue: null })
      this.chart!.setOption(this.styleChartOption(option, theme, config), true)
    }
    const drawDrawer = () => {
      if (!this.panelValue) { drawer.style.width = "0"; drawer.style.padding = "0"; chartArea.style.gap = "0px"; drawer.replaceChildren(); return }
      const childRows = aggregateDrillLevel(finest, levels, [this.panelValue], measureKeys, colOf)
      childRows.sort((a: any, b: any) => (Number(b._val) || 0) - (Number(a._val) || 0))
      const total = childRows.reduce((s: number, r: any) => s + (Number(r._val) || 0), 0)
      const max = Math.max(1, ...childRows.map((r: any) => Math.abs(Number(r._val) || 0)))
      const drawerW = Math.max(170, Math.min(300, Math.round((chartArea.clientWidth || 600) * 0.48)))
      drawer.style.width = drawerW + "px"; drawer.style.padding = "14px"; chartArea.style.gap = "12px"
      drawer.style.background = theme.CARD_BG as string; drawer.style.border = `1px solid ${theme.CARD_BORDER}`; drawer.style.borderRadius = "10px"
      drawer.style.boxSizing = "border-box"; drawer.style.display = "flex"; drawer.style.flexDirection = "column"
      drawer.replaceChildren()
      const head = document.createElement("div")
      head.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:2px"
      const title = document.createElement("div")
      title.style.cssText = `font-size:14px;font-weight:600;color:${theme.textPrimary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`
      title.textContent = this.panelValue
      const close = document.createElement("button")
      close.style.cssText = `background:none;border:none;color:${theme.textMuted};cursor:pointer;font-size:15px;line-height:1;padding:2px;flex-shrink:0`
      close.textContent = "✕"; close.onclick = () => { this.panelValue = null; drawChart(); drawDrawer(); this.chart!.resize() }
      head.appendChild(title); head.appendChild(close); drawer.appendChild(head)
      const meta = document.createElement("div")
      meta.style.cssText = `font-size:10px;font-family:monospace;color:${theme.textMuted};margin-bottom:10px;text-transform:uppercase`
      meta.textContent = `${childRows.length} ${levels[1].column} · ${fmt(total)} total`
      drawer.appendChild(meta)
      const list = document.createElement("div"); list.style.cssText = "flex:1;min-height:0;overflow:auto"
      for (const r of childRows) {
        const row = document.createElement("div"); row.style.cssText = `padding:7px 0;border-bottom:1px solid ${theme.headerBorder}`
        const top = document.createElement("div"); top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:baseline"
        const nm = document.createElement("span"); nm.style.cssText = `font-size:12px;color:${theme.textPrimary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`; nm.textContent = String(r._cat)
        const val = document.createElement("span"); val.style.cssText = `font-size:12px;font-family:monospace;color:${theme.textPrimary};flex-shrink:0`; val.textContent = fmt(Number(r._val) || 0)
        top.appendChild(nm); top.appendChild(val); row.appendChild(top)
        const track = document.createElement("div")
        track.style.cssText = `height:3px;border-radius:2px;margin-top:4px;background:${colorVal};width:${Math.max(2, Math.round(Math.abs(Number(r._val) || 0) / max * 100))}%`
        row.appendChild(track); list.appendChild(row)
      }
      drawer.appendChild(list)
    }
    this.chart.on("click", (params: any) => {
      const name = params?.name
      if (name == null) return
      this.panelValue = this.panelValue === String(name) ? null : String(name)
      drawChart(); drawDrawer(); this.chart!.resize() // chart shrinks beside the drawer
    })
    drawChart(); drawDrawer()
  }

  // Drill hierarchy bound but not expanding: the dataView is at (parent,child) grain,
  // so sum each measure by the base (parent) level to get correct base-level rows.
  private buildBaseRowsFromDataView(dv: DataView): Array<{ _cat?: unknown; _val?: unknown; _val2?: unknown; _val3?: unknown }> {
    const cat = dv?.categorical
    const parents = cat?.categories?.[0]?.values ?? []
    const v0 = cat?.values?.[0]?.values ?? []
    const v1 = cat?.values?.[1]?.values ?? []
    const v2 = cat?.values?.[2]?.values ?? []
    const has2 = v1.length > 0
    const has3 = v2.length > 0
    const acc = new Map<string, { _cat: string; _val: number; _val2: number; _val3: number }>()
    const order: string[] = []
    for (let i = 0; i < parents.length; i++) {
      const key = String(this.normalizeCat(parents[i]))
      let r = acc.get(key)
      if (!r) { r = { _cat: key, _val: 0, _val2: 0, _val3: 0 }; acc.set(key, r); order.push(key) }
      r._val  += Number(v0[i]) || 0
      if (has2) r._val2 += Number(v1[i]) || 0
      if (has3) r._val3 += Number(v2[i]) || 0
    }
    return order.map(k => {
      const r = acc.get(k)!
      const out: { _cat?: unknown; _val?: unknown; _val2?: unknown; _val3?: unknown } = { _cat: r._cat, _val: r._val }
      if (has2) out._val2 = r._val2
      if (has3) out._val3 = r._val3
      return out
    })
  }

  private buildRowsFromDataView(dv: DataView): Array<{ _cat?: unknown; _val?: unknown; _val2?: unknown; _val3?: unknown }> {
    return rowsFromCategorical(dv?.categorical, value => this.normalizeCat(value))
  }

  // Convert raw category values into something the primitives can format. Date
  // → ISO yyyy-mm-dd (formatAxisLabel handles 'date' grain from there). Other
  // values pass through unchanged.
  //
  // Cross-realm check: Power BI runs custom visuals inside an iframe, so a Date
  // object created in PBI's outer realm won't satisfy `v instanceof Date`
  // evaluated inside the visual. Object.prototype.toString.call() inspects the
  // [[Class]] internal slot which is realm-independent — works for Dates from
  // any realm.
  private normalizeCat(v: unknown): unknown {
    if (v == null) return v
    const isDate = Object.prototype.toString.call(v) === "[object Date]"
    if (isDate || v instanceof Date) {
      const d = v as Date
      const t = d.getTime?.()
      if (typeof t === "number" && !isNaN(t)) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${day}`
      }
    }
    // Defensive: some PBI delivery paths stringify Dates eagerly. Match the
    // verbose Date.toString() shape ("Wed Jan 01 2020 00:00:00 GMT-0600 ...")
    // and re-parse to ISO.
    if (typeof v === "string" && /^\w{3} \w{3} \d{1,2} \d{4}/.test(v)) {
      const parsed = new Date(v)
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear()
        const m = String(parsed.getMonth() + 1).padStart(2, "0")
        const day = String(parsed.getDate()).padStart(2, "0")
        return `${y}-${m}-${day}`
      }
    }
    return v
  }

  // Detect theme. Power BI custom visuals don't get a clean "dark/light" string;
  // we sample colorPalette.background. If it's empty or appears dark, assume dark.
  private detectTheme(): typeof DARK_THEME {
    try {
      const palette = (this.host as any)?.colorPalette
      const bg = palette?.background?.value ?? palette?.background ?? ""
      if (typeof bg === "string" && bg.length > 0) {
        // Parse rgb/hex and check perceived luminance
        const isLight = this.isLightColor(bg)
        return isLight ? LIGHT_THEME : DARK_THEME
      }
    } catch { /* fall through */ }
    return DARK_THEME
  }

  private isLightColor(color: string): boolean {
    // Accept '#RRGGBB' or 'rgb(r,g,b)' / 'rgba(...)'. Returns true if YIQ luminance > 128.
    let r = 0, g = 0, b = 0
    const hex = color.match(/^#([0-9a-fA-F]{6})$/)
    if (hex) {
      const n = parseInt(hex[1], 16)
      r = (n >> 16) & 0xff; g = (n >> 8) & 0xff; b = n & 0xff
    } else {
      const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
      if (!rgb) return false
      r = +rgb[1]; g = +rgb[2]; b = +rgb[3]
    }
    return (r * 299 + g * 587 + b * 114) / 1000 > 128
  }

  private tableSort: { kind: 'dim' | 'val'; idx: number; dir: 'asc' | 'desc' } | null = null
  private tableWidths: Record<string, number> = {}
  private tableBinding = ''

  private renderTableIntoArea(
    container: HTMLElement,
    dv: DataView,
    spec: Record<string, unknown>,
    config: Record<string, unknown>,
    theme: typeof DARK_THEME,
    isDark: boolean,
    colorVal: string,
  ): void {
    container.style.padding = "0"
    container.style.overflow = "hidden"

    const cat       = dv?.categorical
    // All bound category columns — each element is one dimension column.
    // PBI returns only the actually-bound roles in order, so indexes are dense.
    const catCols   = (cat?.categories ?? []).filter(c => c?.values?.length > 0)
    const valueCols = cat?.values ?? []
    const nRows = Math.max(0, ...catCols.map(c => c.values.length), ...valueCols.map(c => c.values.length))

    const binding = JSON.stringify([catCols, valueCols].map(columns =>
      columns.map(column => column.source?.queryName || column.source?.displayName || '')))
    if (this.tableBinding !== binding) {
      this.tableBinding = binding
      this.tableSort = null
      this.tableWidths = {}
    }
    const rowOrder = Array.from({ length: nRows }, (_, i) => i)
    const sort = this.tableSort
    if (sort) {
      const values = sort.kind === 'dim' ? catCols[sort.idx]?.values : valueCols[sort.idx]?.values
      rowOrder.sort((a, b) => {
        const comparison = sort.kind === 'dim'
          ? String(values?.[a] ?? '').localeCompare(String(values?.[b] ?? ''))
          : (Number(values?.[a]) || 0) - (Number(values?.[b]) || 0)
        return (sort.dir === 'asc' ? 1 : -1) * comparison || a - b
      })
    }

    // Dimension labels from PBI's model binding (displayName = the column name).
    const dimLabels = catCols.map(c => c.source?.displayName || "Category")

    // Real measure names from primitiveSpec (strips brackets). Falls back to
    // PBI's source.displayName which is the internal slug name (not user-friendly).
    const stripBrackets = (s: string | null | undefined): string | null =>
      s ? s.replace(/^\[|\]$/g, "").trim() : null
    const specMeasures = (spec as any)?.measures ?? {}
    // Prefer spec.measures.all (set by new publish path for table visuals with N measures).
    // Fall back to [primary, secondary, tertiary] for older published reports.
    const specNames: (string | null)[] = Array.isArray(specMeasures.all) && specMeasures.all.length > 0
      ? specMeasures.all
      : [specMeasures.primary, specMeasures.secondary, specMeasures.tertiary]
    const measureLabels = valueCols.map((vc, vi) =>
      stripBrackets(specNames[vi]) || vc.source?.displayName || "Value"
    )

    const showRank    = config.rankColumn !== false
    const showMiniBar = config.miniBars  !== false
    const showHeatmap = !!config.heatmap
    const prefix      = String(config.prefix || "")
    const suffix      = String(config.suffix || "")

    const maxVals = valueCols.map(vc => {
      const nums = (vc.values as unknown[]).map(v => Number(v) || 0)
      return Math.max(...nums, 1)
    })

    const fmtV = (v: unknown, applyPfxSfx: boolean): string => {
      if (v == null) return "—"
      const n = Number(v)
      if (isNaN(n)) return String(v)
      const abs = Math.abs(n)
      let body: string
      if (abs >= 1e9)      body = (n / 1e9).toFixed(1) + "B"
      else if (abs >= 1e6) body = (n / 1e6).toFixed(1) + "M"
      else if (abs >= 1e3) body = (n / 1e3).toFixed(1) + "K"
      else                 body = n.toLocaleString("en-US", { maximumFractionDigits: 2 })
      return applyPfxSfx ? prefix + body + suffix : body
    }

    const esc = (s: string): string =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    const hexRgb = (hex: string): string => {
      const m = (hex || "#888").match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
      return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : "136,136,136"
    }
    const rgb          = hexRgb(colorVal)
    const divider      = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
    const rowAlt       = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)"
    const rowHoverBg   = isDark ? "rgba(255,255,255,0.05)"  : "rgba(0,0,0,0.04)"
    const MEDALS       = ["🥇", "🥈", "🥉"]
    const ff           = "Inter,'Segoe UI',sans-serif"

    // Header
    let hdrCols = ""
    if (showRank) {
      hdrCols += `<div style="width:28px;flex-shrink:0;text-align:center;font-size:9px;font-weight:700;color:${theme.textMuted};text-transform:uppercase;">#</div>`
    }
    // One header cell per bound dimension column
    dimLabels.forEach((dl, di) => {
      const flex = di === 0 ? "flex:2" : "flex:1.5"
      hdrCols += `<div style="${flex};min-width:0;font-size:9px;font-weight:700;color:${theme.textMuted};text-transform:uppercase;letter-spacing:0.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px 0 4px;">${esc(dl)}</div>`
    })
    measureLabels.forEach((ml) => {
      hdrCols += `<div style="flex:1;min-width:60px;font-size:9px;font-weight:700;color:${theme.textMuted};text-transform:uppercase;letter-spacing:0.05em;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px;">${esc(ml)}</div>`
    })

    // Rows
    let rowsHtml = ""
    for (let rank = 0; rank < rowOrder.length; rank++) {
      const i = rowOrder[rank]
      const top3  = rank < 3
      const rowBg = rank % 2 === 0 ? "transparent" : rowAlt

      let rowCols = ""
      if (showRank) {
        const badge = top3
          ? `<span style="font-size:13px;line-height:1">${MEDALS[rank]}</span>`
          : `<span style="font-size:9px;font-weight:700;color:${theme.textFaint}">${rank + 1}</span>`
        rowCols += `<div style="width:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${badge}</div>`
      }
      // One cell per bound dimension column
      catCols.forEach((cc, di) => {
        const catVal = String((cc.values as unknown[])[i] ?? "—")
        const isPrimary = di === 0
        const flex = isPrimary ? "flex:2" : "flex:1.5"
        rowCols += `<div style="${flex};min-width:0;display:flex;align-items:center;padding:4px 8px 4px 4px;">
          <span style="font-size:11px;font-weight:${isPrimary && top3 ? 600 : 400};color:${isPrimary && top3 ? theme.textPrimary : theme.textSecondary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(catVal)}</span>
        </div>`
      })

      valueCols.forEach((vc, vi) => {
        const val   = vc.values[i]
        const n     = Number(val)
        const pct   = (!isNaN(n) && maxVals[vi] > 0) ? Math.max(0, Math.min(100, (n / maxVals[vi]) * 100)) : 0
        let cellBg  = ""
        if (showHeatmap) {
          cellBg = `background:rgba(${rgb},${(0.06 + (pct / 100) * 0.22).toFixed(3)});`
        } else if (showMiniBar && val != null) {
          cellBg = `background:linear-gradient(to right,rgba(${rgb},0.18) ${pct.toFixed(1)}%,transparent ${pct.toFixed(1)}%);`
        }
        const txtColor = vi === 0 ? (top3 ? colorVal : theme.textSecondary) : theme.textMuted
        const fw       = vi === 0 ? 600 : 500
        rowCols += `<div style="flex:1;min-width:60px;display:flex;align-items:center;justify-content:flex-end;padding:4px 6px;${cellBg}">
          <span style="font-size:11px;font-weight:${fw};color:${txtColor};font-variant-numeric:tabular-nums;white-space:nowrap;">${esc(fmtV(val, vi === 0))}</span>
        </div>`
      })

      rowsHtml += `<div data-table-row="${i}"
        style="display:flex;gap:0;background:${rowBg};border-bottom:1px solid ${divider};align-items:stretch;min-height:28px;"
        onmouseenter="this.style.background='${rowHoverBg}'"
        onmouseleave="this.style.background='${rowBg}'"
      >${rowCols}</div>`
    }

    // eslint-disable-next-line powerbi-visuals/no-inner-outer-html
    container.innerHTML = `
      <div data-table-grid style="height:100%;overflow:auto;font-family:${ff};">
        <div data-table-header style="position:sticky;top:0;z-index:1;background:${isDark ? "#101520" : "#fff"};gap:0;padding:0 0 6px;border-bottom:1px solid ${divider};flex-shrink:0;">
          ${hdrCols}
        </div>
        <div>
          ${rowsHtml}
        </div>
      </div>`
    const columns = [
      ...dimLabels.map((label, idx) => ({ kind: 'dim' as const, idx, label })),
      ...measureLabels.map((label, idx) => ({ kind: 'val' as const, idx, label })),
    ]
    const width = (key: string) => this.tableWidths[key] ?? (key.startsWith('dim-') ? 150 : 120)
    const applyWidths = () => {
      const sizes = [...(showRank ? [28] : []), ...columns.map(c => width(`${c.kind}-${c.idx}`))]
      container.querySelectorAll<HTMLElement>('[data-table-header], [data-table-row]').forEach(row => {
        row.style.display = 'grid'
        row.style.gridTemplateColumns = sizes.map(size => `${size}px`).join(' ')
        row.style.minWidth = `${sizes.reduce((sum, size) => sum + size, 0)}px`
        Array.from(row.children).forEach(cell => {
          const el = cell as HTMLElement
          el.style.minWidth = '0'
          el.style.overflow = 'hidden'
        })
      })
      container.querySelectorAll<HTMLElement>('[data-table-resize]').forEach(handle => {
        handle.setAttribute('aria-valuenow', String(width(handle.dataset.tableResize!)))
      })
    }
    const header = container.querySelector<HTMLElement>('[data-table-header]')!
    columns.forEach(({ kind, idx, label }, columnIndex) => {
      const key = `${kind}-${idx}`
      const cell = header.children[columnIndex + (showRank ? 1 : 0)] as HTMLElement
      const active = this.tableSort?.kind === kind && this.tableSort.idx === idx
      cell.dataset.tableSort = key
      cell.setAttribute('role', 'columnheader')
      cell.setAttribute('aria-sort', active ? (this.tableSort!.dir === 'asc' ? 'ascending' : 'descending') : 'none')
      cell.tabIndex = 0
      cell.style.position = 'relative'
      cell.style.cursor = 'pointer'
      cell.style.paddingRight = '14px'
      cell.textContent = `${label} ${active ? (this.tableSort!.dir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}`
      const toggle = () => {
        const previous = this.tableSort
        this.tableSort = previous?.kind === kind && previous.idx === idx
          ? (previous.dir === 'desc' ? { kind, idx, dir: 'asc' } : null)
          : { kind, idx, dir: 'desc' }
        const scroll = container.querySelector<HTMLElement>('[data-table-grid]')!
        const { scrollTop, scrollLeft } = scroll
        this.renderTableIntoArea(container, dv, spec, config, theme, isDark, colorVal)
        const next = container.querySelector<HTMLElement>('[data-table-grid]')!
        next.scrollTop = scrollTop
        next.scrollLeft = scrollLeft
        container.querySelector<HTMLElement>(`[data-table-sort="${key}"]`)?.focus({ preventScroll: true })
      }
      cell.onclick = event => { event.stopPropagation(); toggle() }
      cell.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle() }
      }
      const handle = document.createElement('span')
      handle.dataset.tableResize = key
      handle.setAttribute('role', 'separator')
      handle.setAttribute('aria-label', `Resize ${label}`)
      handle.setAttribute('aria-orientation', 'vertical')
      handle.setAttribute('aria-valuemin', '40')
      handle.tabIndex = 0
      handle.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:8px;cursor:col-resize;touch-action:none;border-right:1px solid currentColor;'
      handle.onclick = event => event.stopPropagation()
      handle.onkeydown = event => {
        event.stopPropagation()
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          this.tableWidths[key] = Math.max(40, width(key) + (event.key === 'ArrowRight' ? 10 : -10))
          applyWidths()
        }
      }
      handle.onpointerdown = event => {
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX, startWidth = width(key)
        handle.setPointerCapture(event.pointerId)
        handle.onpointermove = move => {
          this.tableWidths[key] = Math.max(40, startWidth + move.clientX - startX)
          applyWidths()
        }
        const stop = () => { handle.onpointermove = null }
        handle.onpointerup = stop
        handle.onpointercancel = stop
        handle.onlostpointercapture = stop
      }
      cell.appendChild(handle)
    })
    applyWidths()
  }

  private renderError(message: string, visualType: string, empty = false): void {
    this.disposeChart()
    this.root.textContent = ""
    const div = document.createElement("div")
    div.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#F87171;font-family:system-ui,sans-serif;font-size:11px;text-align:center;padding:16px"
    div.style.boxSizing = 'border-box'
    if (empty) div.style.color = '#94A3B8'
    div.setAttribute('role', empty ? 'status' : 'alert')
    div.textContent = empty ? message : `Semantica renderer error (${visualType}): ${message}`
    this.root.appendChild(div)
  }

  // ── Axis-switcher pills ──────────────────────────────────────────────
  // The DAX measure emits HTML containing all axes' bars at once, each
  // wrapped in <div data-axis-section="N">. Pills at .sbar-axis-pills button
  // toggle which section is visible on click (no re-query — DAX is static).
  // Active/inactive pill colors come from data-active-* / data-inactive-*
  // attributes set by the DAX emitter so nothing is hardcoded here — the
  // colors track the user's chosen colorScheme.
  private wireAxisPills(): void {
    const pills = this.root.querySelectorAll(".sbar-axis-pills button[data-axis-idx]")
    if (!pills.length) return
    const sections = this.root.querySelectorAll("[data-axis-section]") as NodeListOf<HTMLElement>
    if (!sections.length) return

    const applyPillState = (pill: HTMLElement, isActive: boolean) => {
      const bg     = pill.getAttribute(isActive ? "data-active-bg"     : "data-inactive-bg")     || ""
      const border = pill.getAttribute(isActive ? "data-active-border" : "data-inactive-border") || ""
      const color  = pill.getAttribute(isActive ? "data-active-color"  : "data-inactive-color")  || ""
      pill.style.background = bg
      pill.style.border = border
      pill.style.color = color
      pill.setAttribute("data-axis-active", isActive ? "1" : "0")
    }

    pills.forEach((pillEl) => {
      const pill = pillEl as HTMLElement
      pill.addEventListener("click", (ev) => {
        ev.stopPropagation()
        const targetIdx = pill.getAttribute("data-axis-idx") || "0"
        sections.forEach((s) => {
          const match = s.getAttribute("data-axis-section") === targetIdx
          s.style.display = match ? "flex" : "none"
          // Clear stale per-section DOM-only bar selections when switching
          // axes so a click-dim from axis N doesn't persist when axis M shows.
          if (!match) {
            const staleBars = s.querySelectorAll('[data-sbar-local-selected]')
            staleBars.forEach((b) => {
              (b as HTMLElement).setAttribute("data-sbar-local-selected", "0")
              ;(b as HTMLElement).style.opacity = ""
            })
          }
        })
        pills.forEach((otherEl) => {
          const other = otherEl as HTMLElement
          applyPillState(other, other.getAttribute("data-axis-idx") === targetIdx)
        })
        // No filter clearing needed — we no longer use applyJsonFilter.
      })
    })
  }

  // ── Mode 3: HTML content with click-to-filter via category binding ───
  // Used for bar/line/donut/etc. — the measure returns rich HTML and the
  // category binding drives SelectionIds, so clicking a bar filters other
  // visuals on the same page.
  // Resolve alternate-axis identities only from an exact bound field. A label
  // shared by two dimensions must never select the primary dimension by accident.
  private boundHtmlAxisSelection(cat: powerbi.DataViewCategorical, section: HTMLElement, name: string): powerbi.visuals.ISelectionId | null {
    const table = section.getAttribute('data-axis-table')
    const column = section.getAttribute('data-axis-column')
    if (!table || !column) return null
    const matches = (cat.categories || []).filter(c => c.source?.queryName === `${table}.${column}`)
    if (matches.length !== 1) return null
    const category = matches[0]
    const index = category.values.findIndex(value => value != null && String(value) === name)
    if (index < 0) return null
    return this.host.createSelectionIdBuilder().withCategory(category, index).createSelectionId()
  }

  private renderHtmlWithSelection(dv: DataView, cat: powerbi.DataViewCategorical, html: string): void {
    try {
      // eslint-disable-next-line powerbi-visuals/no-inner-outer-html
      this.root.innerHTML = html
      this.animateCountUp()
      this.wireAxisPills()
    } catch { this.renderEmpty(); return }

    const categories = cat.categories![0]
    const catValues = categories.values as any[]

    // Build a SelectionId per category value
    const selectionIds: powerbi.visuals.ISelectionId[] = catValues.map((_, i) =>
      this.host.createSelectionIdBuilder().withCategory(categories, i).createSelectionId()
    )

    // Name → SelectionId map so click + dim work regardless of DOM order
    // (DAX sorts bars by value; dataView order is different).
    const catLookupMap = new Map<string, powerbi.visuals.ISelectionId>()
    catValues.forEach((v, i) => { catLookupMap.set(String(v), selectionIds[i]) })

    // Find clickable elements — each bar/slice emits data-sbar-cat="<value>"
    const clickables = this.root.querySelectorAll("[data-sbar-cat]")
    // Singleton cursor-following tooltip — positioned with position:fixed so
    // it escapes any parent overflow clipping and never gets cut off at the
    // top/bottom of the card.
    const tooltipEl = this.ensureTooltipEl()
    const markIds = new Map<Element, powerbi.visuals.ISelectionId>()

    clickables.forEach((el) => {
      const catName = el.getAttribute("data-sbar-cat")
      if (!catName) return
      // Split path: primary axis uses Selection API (how it was working before
      // the multi-axis changes); bound alternate axes use their own field identity.
      const sectionEl = el.closest("[data-axis-section]") as HTMLElement | null
      const axisIdx = sectionEl?.getAttribute("data-axis-section") ?? "0"
      const isPrimaryAxisBar = axisIdx === "0"
      const selId = isPrimaryAxisBar ? (catLookupMap.get(catName) || null) : this.boundHtmlAxisSelection(cat, sectionEl!, catName)
      if (selId) markIds.set(el, selId)

      ;(el as HTMLElement).addEventListener("click", (e) => {
        e.stopPropagation()
        const multi = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey

        if (selId) {
          // Primary axis — Selection API (the restored, working path)
          this.selectionManager.select(selId, multi).then((selected) => {
            this.updateHtmlSelection(clickables, selectionIds, selected as powerbi.visuals.ISelectionId[], catLookupMap, markIds)
          })
          return
        }

        // Non-primary axis — DOM-only dim within the section. Cross-filter to
        // other visuals for non-primary axes is a follow-up; premature capabilities
        // changes broke PBI's native slicer routing, so reverting to local dim
        // until we implement a proper multi-role binding approach.
        if (!sectionEl) return
        const siblings = Array.from(sectionEl.querySelectorAll("[data-sbar-cat]")) as HTMLElement[]
        const selected = new Set(siblings.filter(s => s.getAttribute("data-sbar-local-selected") === "1"))
        if (multi) {
          if (selected.has(el as HTMLElement)) selected.delete(el as HTMLElement)
          else selected.add(el as HTMLElement)
        } else {
          const clear = selected.size === 1 && selected.has(el as HTMLElement)
          selected.clear()
          if (!clear) selected.add(el as HTMLElement)
        }
        siblings.forEach(s => {
          const active = selected.has(s)
          s.setAttribute("data-sbar-local-selected", active ? "1" : "0")
          s.style.opacity = selected.size ? (active ? "1" : "0.35") : ""
        })
      })
      ;(el as HTMLElement).addEventListener("mouseenter", (e) => {
        this.clearTooltipHideTimer()
        tooltipEl.scrollTop = 0
        tooltipEl.scrollLeft = 0
        ;(el as HTMLElement).style.background = "rgba(255,255,255,0.05)"
        // Hide the inline CSS-only tooltip (we use the floating one instead)
        const innerTt = (el as HTMLElement).querySelector(".sbar-tt") as HTMLElement | null
        if (innerTt) innerTt.style.display = "none"
        // Populate and show floating tooltip
        if (innerTt?.hasChildNodes()) {
          tooltipEl.replaceChildren(...Array.from(innerTt.childNodes, child => child.cloneNode(true)))
        } else {
          tooltipEl.textContent = catName
        }
        tooltipEl.style.display = "block"
        this.positionTooltip(tooltipEl, e as MouseEvent)
      })
      ;(el as HTMLElement).addEventListener("mousemove", (e) => {
        this.positionTooltip(tooltipEl, e as MouseEvent)
      })
      ;(el as HTMLElement).addEventListener("mouseleave", () => {
        (el as HTMLElement).style.background = ""
        this.scheduleTooltipHide()
      })
    })

    // Clear selection when clicking empty card background.
    this.root.onclick = () => {
      this.selectionManager.clear().then(() => {
        clickables.forEach((el) => {
          (el as HTMLElement).style.opacity = ""
          ;(el as HTMLElement).setAttribute("data-sbar-local-selected", "0")
        })
      })
    }

    // Apply current filter state (for cross-highlight when other visuals filter us)
    this.updateHtmlSelection(clickables, selectionIds, this.selectionManager.getSelectionIds() as powerbi.visuals.ISelectionId[], catLookupMap, markIds)
  }

  // ── Cursor-following tooltip helpers ────────────────────────────────
  private tooltipEl: HTMLElement | null = null
  private tooltipHideTimer: ReturnType<typeof setTimeout> | null = null

  private clearTooltipHideTimer(): void {
    if (this.tooltipHideTimer != null) clearTimeout(this.tooltipHideTimer)
    this.tooltipHideTimer = null
  }

  private scheduleTooltipHide(): void {
    this.clearTooltipHideTimer()
    this.tooltipHideTimer = setTimeout(() => {
      if (this.tooltipEl) this.tooltipEl.style.display = "none"
      this.tooltipHideTimer = null
    }, 250)
  }

  private ensureTooltipEl(): HTMLElement {
    if (this.tooltipEl && document.body.contains(this.tooltipEl)) return this.tooltipEl
    const el = document.createElement("div")
    el.className = "semantica-cursor-tt"
    el.style.cssText = "position:fixed;display:none;pointer-events:auto;z-index:99999;" +
      "background:#0e0e1c;color:#E5E7EB;padding:8px 12px;border-radius:6px;" +
      "font-size:11px;font-family:Inter,'Segoe UI',sans-serif;white-space:normal;overflow-wrap:anywhere;box-sizing:border-box;width:max-content;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;" +
      "box-shadow:0 8px 24px rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.08);" +
      "transition:opacity 80ms;"
    el.tabIndex = 0
    el.setAttribute('role', 'tooltip')
    el.addEventListener('mouseenter', () => this.clearTooltipHideTimer())
    el.addEventListener('focus', () => this.clearTooltipHideTimer())
    el.addEventListener('mouseleave', () => this.scheduleTooltipHide())
    el.addEventListener('blur', () => this.scheduleTooltipHide())
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.clearTooltipHideTimer()
        el.style.display = 'none'
      }
    })
    document.body.appendChild(el)
    this.tooltipEl = el
    return el
  }

  private positionTooltip(el: HTMLElement, e: MouseEvent): void {
    const offset = 14
    // Default: above-right of cursor
    let left = e.clientX + offset
    let top  = e.clientY - el.offsetHeight - offset
    // Flip left if near right edge
    if (left + el.offsetWidth > window.innerWidth - 8) {
      left = e.clientX - el.offsetWidth - offset
    }
    // Flip down if near top edge
    if (top < 8) {
      top = e.clientY + offset
    }
    el.style.left = `${Math.max(8, Math.min(left, window.innerWidth - el.offsetWidth - 8))}px`
    el.style.top  = `${Math.max(8, Math.min(top, window.innerHeight - el.offsetHeight - 8))}px`
  }

  // Updates dim/highlight on each clickable. CRITICAL: clickables is the
  // DOM order (sorted by bar value after DAX sorts), while selectionIds is
  // the category-insertion order from the dataView. Parallel indexing between
  // the two breaks when axis switcher emits multi-axis bars (clickables has
  // bars for every axis section, selectionIds only for the bound primary),
  // and even on a single axis when the DAX sort reorders bars away from the
  // dataView order. The fix: look up each clickable's category name against
  // the original categories.values[] (catLookupMap) to find its selectionId.
  private updateHtmlSelection(
    clickables: NodeListOf<Element>,
    selectionIds: powerbi.visuals.ISelectionId[],
    selected: powerbi.visuals.ISelectionId[],
    catLookupMap?: Map<string, powerbi.visuals.ISelectionId>,
    markIds?: Map<Element, powerbi.visuals.ISelectionId>,
  ): void {
    if (!selected.length) {
      clickables.forEach((el) => { (el as HTMLElement).style.opacity = "" })
      return
    }
    clickables.forEach((el) => {
      const name = el.getAttribute("data-sbar-cat")
      let selId: powerbi.visuals.ISelectionId | undefined
      if (markIds) selId = markIds.get(el)
      else if (name && catLookupMap) selId = catLookupMap.get(name)
      const isSel = !!selId && selected.some((s) => s.equals(selId))
      ;(el as HTMLElement).style.opacity = isSel ? "1" : "0.35"
    })
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return {cards:paneFormattingCards((this as any).formattingObjects || {},{dom:(this as any).formattingDom,canvasTheme:(this as any).formattingCanvasTheme,option:(this as any).formattingOption,config:(this as any).formattingConfig})} as any
  }

  // ── Mode 1: KPI / HTML render ────────────────────────────────────────

  private renderHtml(dv: DataView): void {
    let html = ""

    // Try single value
    if (dv?.single?.value != null && typeof dv.single.value === "string") {
      html = dv.single.value
    }

    // Try categorical values (single row, no category)
    if (!html && dv?.categorical?.values?.length) {
      const v = dv.categorical.values[0].values?.[0]
      if (typeof v === "string") html = v as string
    }

    if (!html) { this.renderEmpty(); return }

    try {
      // eslint-disable-next-line powerbi-visuals/no-inner-outer-html
      this.root.innerHTML = html
      this.animateCountUp()
      this.wireAxisPills()
    } catch {
      this.renderEmpty()
    }
  }

  // ── Mode 2: Interactive bar chart with Selection API ─────────────────

  private renderBarChart(dv: DataView, cat: powerbi.DataViewCategorical): void {
    const categories = cat.categories![0]
    const values = cat.values?.[0]?.values || []
    const labels = categories.values as any[]
    const measureName = cat.values?.[0]?.source?.displayName || "Value"

    // Build selection IDs for each data point
    const selectionIds: powerbi.visuals.ISelectionId[] = []
    for (let i = 0; i < labels.length; i++) {
      selectionIds.push(
        this.host.createSelectionIdBuilder()
          .withCategory(categories, i)
          .createSelectionId()
      )
    }

    // Find max for scaling
    const nums = values.map(v => Math.abs(Number(v) || 0))
    const maxVal = Math.max(...nums, 1)

    // Colors
    const colors = ["#14B8A6", "#3B82F6", "#A855F7", "#F59E0B", "#22C55E", "#F43F5E", "#8B5CF6", "#F97316"]

    // Build HTML
    const barRows = labels.map((label, i) => {
      const val = Number(values[i]) || 0
      const pct = (Math.abs(val) / maxVal) * 100
      const color = colors[i % colors.length]
      const formatted = this.formatNumber(val)
      return `<div class="sr-bar-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;cursor:pointer;transition:background 0.15s;">
        <div style="width:80px;font-size:10px;color:rgba(255,255,255,0.6);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">${this.escHtml(String(label))}</div>
        <div style="flex:1;height:18px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
        </div>
        <div style="width:60px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.85);text-align:right;flex-shrink:0;">${formatted}</div>
      </div>`
    }).join("")

    const html = `
      <div style="width:100%;height:100%;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(20,20,34,0.98),rgba(11,11,20,0.99));border:1px solid rgba(255,255,255,0.08);border-radius:12px;font-family:Inter,'Segoe UI',sans-serif;overflow:hidden;">
        <div style="padding:12px 16px 8px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);letter-spacing:0.03em;">${this.escHtml(measureName)} by ${this.escHtml(categories.source?.displayName || "Category")}</div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:4px 8px 12px;gap:2px;overflow-y:auto;">
          ${barRows}
        </div>
      </div>
      <style>
        .sr-bar-row:hover { background: rgba(255,255,255,0.06) !important; }
        .sr-bar-row.sr-selected { background: rgba(99,102,241,0.15) !important; border: 1px solid rgba(99,102,241,0.3); }
        .sr-bar-row.sr-dimmed { opacity: 0.3; }
      </style>`

    // eslint-disable-next-line powerbi-visuals/no-inner-outer-html
    this.root.innerHTML = html

    // Attach click handlers for cross-filter
    const rows = this.root.querySelectorAll(".sr-bar-row")
    rows.forEach((row, i) => {
      (row as HTMLElement).addEventListener("click", (e) => {
        e.stopPropagation()
        const multiSelect = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey
        this.selectionManager.select(selectionIds[i], multiSelect).then(() => {
          this.updateSelectionStyle(rows, selectionIds)
        })
      })
    })

    // Click on empty space to clear selection
    this.root.onclick = () => {
      this.selectionManager.clear().then(() => {
        rows.forEach(r => {
          (r as HTMLElement).classList.remove("sr-selected", "sr-dimmed")
        })
      })
    }

    // Apply current selection state (for cross-highlight from other visuals)
    this.updateSelectionStyle(rows, selectionIds)
  }

  private updateSelectionStyle(rows: NodeListOf<Element>, selectionIds: powerbi.visuals.ISelectionId[]): void {
    const selected = this.selectionManager.getSelectionIds() as powerbi.visuals.ISelectionId[]
    if (!selected.length) {
      rows.forEach(r => (r as HTMLElement).classList.remove("sr-selected", "sr-dimmed"))
      return
    }
    rows.forEach((r, i) => {
      const isSelected = selected.some(s => s.equals(selectionIds[i]))
      ;(r as HTMLElement).classList.toggle("sr-selected", isSelected)
      ;(r as HTMLElement).classList.toggle("sr-dimmed", !isSelected)
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private renderEmpty(message = "Bind a measure to Content"): void {
    const theme = resolveReportTheme({}, { theme: reportThemeFromHost(this.host) })
    // eslint-disable-next-line powerbi-visuals/no-inner-outer-html
    this.root.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,sans-serif;font-size:11px;color:${theme.foreground};background:transparent;border:1px dashed rgba(148,163,184,0.25);border-radius:8px;text-align:center;"><div><div style="font-size:22px;margin-bottom:8px;">✦</div><div style="font-weight:600;color:${theme.palette[0]};">vilsem Renderer</div><div>${this.escHtml(message)}</div></div></div>`
  }

  private formatNumber(n: number): string {
    const abs = Math.abs(n)
    if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B"
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M"
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K"
    return n.toFixed(0)
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }
}
