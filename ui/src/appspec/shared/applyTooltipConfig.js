// Shared post-build tooltip overrides for every ECharts visual.
//
// Tooltips are built per-primitive (bar-family via the shared Tooltip primitive; line/
// pie/point/radar/treemap each build their own inline tooltip block). Rather than edit
// each primitive, every Compact*Echarts wrapper runs its finished `option` through this
// helper right before render, so per-visual tooltip controls behave IDENTICALLY across
// all chart types:
//   - config.tooltipEnabled === false  → tooltip hidden (show:false)
//   - config.tooltipTrigger 'item'|'axis' → overrides the primitive's default trigger
//     ('auto' or unset = keep the primitive's own choice)
//
// IMPORTANT: this returns a NEW option object (never mutates) whenever it changes the
// tooltip, so EChartsCanvas — which re-applies setOption only when the `option` reference
// changes — actually picks up the toggle. In the default state (visible + auto trigger)
// it returns the SAME reference so memoization is preserved. EChartsCanvas must include
// 'tooltip' in its setOption replaceMerge list so show/trigger fully replace (a plain
// merge leaves a prior show:false stuck when toggling back on).
export function applyTooltipConfig(option, config = {}) {
  if (!option) return option
  const enabled = config.tooltipEnabled !== false
  const trig = (config.tooltipTrigger && config.tooltipTrigger !== 'auto') ? config.tooltipTrigger : null
  // Default (visible, auto trigger) → leave untouched so the primitive's own tooltip
  // renders as built and the option reference stays stable (memo-friendly).
  if (enabled && !trig) return option
  const base = (option.tooltip && typeof option.tooltip === 'object') ? option.tooltip : {}
  return { ...option, tooltip: { ...base, show: enabled, ...(trig ? { trigger: trig } : {}) } }
}
