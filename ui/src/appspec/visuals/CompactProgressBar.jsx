import { progressFormatting } from '../shared/detailedCardSchemas.js'
import React from 'react'
import { pal } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

// Progress is a single-value card visual (big number + gradient bar + %), not an
// ECharts chart — ECharts has no native linear progress bar and the DOM/CSS
// version is crisper. This schema lets the VisualInspector surface its controls.
export const schema = [
  ...progressFormatting,
  { key: 'maxValue',       label: 'Target value',     type: 'number',  default: 100, group: 'Scale' },
  { key: 'barHeight',      label: 'Bar height (px)',  type: 'range',   default: 8,  min: 2,  max: 40, step: 1, group: 'Appearance' },
  { key: 'barRadius',      label: 'Bar roundness',    type: 'range',   default: 20, min: 0,  max: 40, step: 1, group: 'Appearance' },
  { key: 'showPercentage', label: 'Show percentage',  type: 'boolean', default: true,                        group: 'Labels' },
  { key: 'valueFontSize',  label: 'Value font size',  type: 'range',   default: 28, min: 12, max: 60, step: 1, group: 'Labels' },
]

export default function CompactProgressBar({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  const val = rows?.[0]?._val ?? 0
  const max = config.maxValue || 100
  const pct = Math.min(Math.max((val / max) * 100, 0), 100)
  const barH = config.barHeight ?? 8
  const showPct = config.showPercentage ?? true
  const barRadius = config.barRadius ?? 20

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', gap: config.contentGap ?? 8, padding: '0 16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', gap: 6, maxWidth: '100%', flexShrink: 0 }}>
        <div style={{ fontSize: config.valueFontSize || 28, fontWeight: config.valueFontWeight ?? 800, color: config.valueColor || p.text, fontFamily: config.valueFontFamily || 'inherit', maxWidth: '100%', overflowWrap: 'anywhere', textAlign: 'center' }}>{fmtVal(val, config.prefix, config.suffix)}</div>
        {showPct && <div data-format-target="percentage" style={{ fontSize: config.percentageFontSize ?? 12, fontWeight: 600, color: config.percentageColor || t.textMuted }}>{pct.toFixed(0)}%</div>}
      </div>
      <div data-format-target="track" style={{ width: '100%', maxWidth: 300, height: barH, background: config.trackColor || t.shimmerBg || 'rgba(255,255,255,0.06)', borderRadius: barRadius, overflow: 'hidden', flexShrink: 0 }}>
        <div data-format-target="value-bar" style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${config.barColor || p.start}, ${config.barEndColor || p.mid || p.start})`, borderRadius: barRadius, transition: 'width 0.6s ease-out' }} />
      </div>
      {(config.title || config.label) && <div style={{ fontSize: 10, color: t.textMuted, maxWidth: '100%', overflowWrap: 'anywhere', textAlign: 'center', flexShrink: 0 }}>{config.title || config.label}</div>}
    </div>
    </div>
  )
}
