import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactFunnel({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />

  // ── Deep customization ──
  const showValues      = config.showValues ?? true
  const showPercentage  = config.showPercentage ?? false
  const barHeight       = config.barHeight ?? 14
  const barRadius       = config.barRadius ?? 3
  const barGap          = config.barGap ?? 6
  const gradient        = config.gradient ?? true
  const showConversion  = config.showConversion ?? false // show % drop between stages
  const labelWidth      = config.labelWidth ?? 50
  const animEnabled     = config.animationEnabled !== false

  const data = rows?.length ? rows : [{ _cat: 'Stage 1', _val: 100 }, { _cat: 'Stage 2', _val: 65 }, { _cat: 'Stage 3', _val: 40 }]
  const maxVal = Math.max(...data.map(r => Math.abs(r._val || 0)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '0 8px' }}>
        {data.map((r, i) => {
          const pct = maxVal > 0 ? (Math.abs(r._val || 0) / maxVal) * 100 : 0
          const convPct = i > 0 && data[i - 1]._val ? ((r._val / data[i - 1]._val) * 100).toFixed(0) : null
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: barGap }}>
                <div style={{ fontSize: 9, color: t.textMuted, width: labelWidth, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._cat}</div>
                <div style={{ flex: 1, height: barHeight, background: t.shimmerBg || 'rgba(255,255,255,0.06)', borderRadius: barRadius, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: gradient ? `linear-gradient(90deg,${p.start},${p.mid || p.start})` : p.start,
                    borderRadius: barRadius,
                    transition: animEnabled ? 'width 0.5s ease-out' : 'none',
                  }} />
                </div>
                {showValues && <div style={{ fontSize: 9, color: p.text, width: 40, flexShrink: 0, fontWeight: 600 }}>{fmtVal(r._val, config.prefix, config.suffix)}</div>}
                {showPercentage && <div style={{ fontSize: 8, color: t.textFaint, width: 28, flexShrink: 0 }}>{pct.toFixed(0)}%</div>}
              </div>
              {showConversion && convPct && (
                <div style={{ fontSize: 8, color: t.textFaint, paddingLeft: labelWidth + barGap, marginTop: 1 }}>↓ {convPct}%</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
