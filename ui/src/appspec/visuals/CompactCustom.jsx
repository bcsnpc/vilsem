import React, { useMemo } from 'react'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'
import { instantiateVisual, buildThemeContext } from '../../playground/instantiate.js'

// Generic inspector toggles the template doesn't read on its own. Applied as a
// post-step so the standard Legend / Data labels / Grid lines / Animations
// controls work on ANY custom template. Series with their own settings still win
// unless the toggle is explicitly set.
function applyChrome(opt, cfg, theme) {
  if (!opt) return opt
  if (cfg.showLegend === false) {
    if (opt.legend) opt.legend = Array.isArray(opt.legend) ? opt.legend.map(l => ({ ...l, show: false })) : { ...opt.legend, show: false }
  } else if (cfg.showLegend === true && !opt.legend) {
    opt.legend = { show: true, bottom: 0, textStyle: { color: theme.textMuted, fontSize: 10 } }
  }
  if (cfg.animations === false) opt.animation = false
  const series = Array.isArray(opt.series) ? opt.series : (opt.series ? [opt.series] : [])
  if (cfg.dataLabels === true || cfg.dataLabels === false) {
    for (const s of series) if (s && typeof s === 'object') s.label = { ...(s.label || {}), show: cfg.dataLabels }
  }
  if (cfg.gridLines === true || cfg.gridLines === false) {
    for (const ax of ['xAxis', 'yAxis']) {
      const a = opt[ax]
      if (Array.isArray(a)) a.forEach(x => { if (x && typeof x === 'object') x.splitLine = { ...(x.splitLine || {}), show: cfg.gridLines } })
      else if (a && typeof a === 'object') a.splitLine = { ...(a.splitLine || {}), show: cfg.gridLines }
    }
  }
  return opt
}

// Playground Spike — the ONE component behind every custom visual.
//
// It is type-agnostic: the shape of the chart lives entirely in a declarative
// `.vilsem-visual` template (config._customTemplate), resolved to an ECharts
// option by the pure instantiateVisual(). No per-visual code — a KPI card, a
// bullet, and a lollipop are all THIS component with different templates.
//
// The renderer (AppSpecRenderer / standalone export) attaches:
//   config._customTemplate  — the template JSON (from spec.customVisuals[id])
//   config._T               — theme tokens (getThemeTokens)
//   config.colorScheme      — palette selector
//   config.*                — param values (resolveParams reads only declared names)
export default function CompactCustom({ rows, config, loading, error }) {
  const cfg = config || {}
  const template = cfg._customTemplate || null
  const tokens = cfg._T || getThemeTokens('dark')

  const { option, warnings } = useMemo(() => {
    if (!template) return { option: null, warnings: ['no template bound'] }
    const sectionColors = Array.isArray(cfg.sectionColors) ? cfg.sectionColors.filter(Boolean) : null
    const theme = buildThemeContext(tokens, cfg.colorScheme, cfg.titleFontFamily || cfg.fontFamily, sectionColors)
    const result = instantiateVisual({ template, rows: rows || [], params: cfg, theme })
    // The resolved palette (section colours or the scheme) becomes the ECharts root
    // palette, so pie/donut/rose slices and any `colorBy:'data'` series colour
    // per-category. Series with an explicit itemStyle.color still win.
    if (result.option) {
      result.option.color = theme.palette
      applyChrome(result.option, cfg, theme) // legend / data labels / grid lines / animations
    }
    return result
  }, [template, rows, tokens, cfg.colorScheme, cfg.titleFontFamily, cfg.fontFamily, cfg.sectionColors, cfg.showLegend, cfg.dataLabels, cfg.gridLines, cfg.animations, cfg])

  if (loading) return <LoadingShimmer />
  if (error) return <EmptyState error={error} />
  if (!template) return <EmptyState label="No custom template" />
  if (!option || (Array.isArray(option.series) && option.series.length === 0 && !(rows || []).length)) {
    return <EmptyState label={cfg.title || cfg.label || template?.meta?.name} />
  }

  // Dev aid: surface instantiation warnings in the console (never blocks render).
  if (warnings && warnings.length && typeof console !== 'undefined') {
    console.debug('[CompactCustom] template warnings:', warnings)
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas config={config} option={applyTooltipConfig(option, config)} />
    </div>
  )
}

// Attached below in index.js after import; kept here for locality.
export const schema = []
