import type { EChartsOption } from 'echarts'
import type { PrimitiveFragment, LegendItem } from './contract'

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

// Deep-merge two values. Later (override) wins for scalar conflicts.
// Objects are merged recursively. Arrays are replaced (series handled separately).
function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base
  if (base === undefined) return override
  if (isObject(base) && isObject(override)) {
    const result: Record<string, unknown> = { ...base }
    for (const key of Object.keys(override)) {
      result[key] = deepMerge(base[key], override[key])
    }
    return result
  }
  return override
}

// Merge an array of PrimitiveFragments into a single EChartsOption.
//
// Rules:
//   option leaves    — deep-merge, later fragment wins on scalar conflicts
//   series           — concatenated across fragments (not replaced)
//   contributions.scales — min-of-mins / max-of-maxes applied to axis min/max
//   contributions.legendItems — aggregated into legend.data
//   contributions.tooltipEntries — reserved for Phase 4+ multi-mark compositions
export function mergeFragments(fragments: PrimitiveFragment[]): EChartsOption {
  if (!fragments.length) return {}

  // Pre-collect series before merge — series must concat, not replace.
  const allSeries: unknown[] = []
  for (const f of fragments) {
    const s = f.option.series
    if (s === undefined) continue
    if (Array.isArray(s)) allSeries.push(...s)
    else allSeries.push(s)
  }

  // Deep-merge all option objects.
  let merged: Record<string, unknown> = {}
  for (const f of fragments) {
    merged = deepMerge(merged, f.option) as Record<string, unknown>
  }

  // Restore concatenated series (overwrites whatever deep-merge left in series).
  if (allSeries.length > 0) {
    merged = { ...merged, series: allSeries }
  }

  // Scale contribution resolution.
  const allScales = fragments.flatMap(f => f.contributions?.scales ?? [])
  if (allScales.length > 0) {
    const xScales = allScales.filter(s => s.axis === 'x')
    const yScales = allScales.filter(s => s.axis === 'y')
    if (xScales.length > 0) {
      merged = {
        ...merged,
        xAxis: deepMerge(merged.xAxis, {
          min: Math.min(...xScales.map(s => s.min)),
          max: Math.max(...xScales.map(s => s.max)),
        }),
      }
    }
    if (yScales.length > 0) {
      merged = {
        ...merged,
        yAxis: deepMerge(merged.yAxis, {
          min: Math.min(...yScales.map(s => s.min)),
          max: Math.max(...yScales.map(s => s.max)),
        }),
      }
    }
  }

  // Legend item aggregation.
  const allLegendItems: LegendItem[] = fragments.flatMap(f => f.contributions?.legendItems ?? [])
  if (allLegendItems.length > 0) {
    const legendData = allLegendItems.map(item =>
      item.color ? { name: item.name, itemStyle: { color: item.color } } : { name: item.name }
    )
    merged = { ...merged, legend: deepMerge(merged.legend, { data: legendData }) }
  }

  return merged as EChartsOption
}
