import React from 'react'
import { fmtVal } from './formatters.js'

// Shared presentational atoms used across Compact* visuals. Verbatim extract
// from AppSpecRenderer.jsx (pre-Phase-1).

export function AppBarTooltip({ active, payload, prefix, suffix, accent, measureName }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload || {}
  return (
    <div style={{
      background: '#0e0e1c',
      border: '1px solid rgba(255,255,255,0.11)',
      borderRadius: 10,
      padding: '10px 13px',
      minWidth: 160,
      boxShadow: '0 12px 28px rgba(0,0,0,0.48)',
      color: '#E5E7EB',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC', marginBottom: 6 }}>
        {point._cat}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>{measureName || 'Value'}</span>
        <span style={{ color: accent, fontWeight: 700 }}>{fmtVal(point._val, prefix, suffix)}</span>
      </div>
    </div>
  )
}

export function LoadingShimmer() {
  const bars = [72, 48, 64, 38, 56]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: '12px 16px', height: '100%' }}>
      {bars.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ height: 8, width: `${w}%`, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: `spec-pulse 1.6s ${i * 0.1}s ease-in-out infinite` }} />
          <div style={{ height: 8, width: 28, background: 'rgba(255,255,255,0.04)', borderRadius: 4, animation: `spec-pulse 1.6s ${i * 0.1}s ease-in-out infinite` }} />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ label, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
      {error
        ? <div style={{ fontSize: 10, color: '#F87171', textAlign: 'center', padding: '0 8px', lineHeight: 1.5 }}>⚠ {error}</div>
        : <>
            <div style={{ fontSize: 18, opacity: 0.15 }}>◌</div>
            {label && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>{label}</div>}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>No data</div>
          </>
      }
    </div>
  )
}

export function SparklineSvg({ data, width = 60, height = 20, color = '#14B8A6', showArea = true, id = 'spark' }) {
  if (!data?.length || data.length < 2) return null
  const w = typeof width === 'number' ? width : 100
  const h = typeof height === 'number' ? height : 20
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * (w - 2) + 1},${(h - 2) - ((v - min) / range) * (h - 4)}`).join(' ')
  const gradId = `spark-grad-${id}-${w}`
  // preserveAspectRatio="none" lets the SVG stretch to fill its container
  // (matches the PBI DAX output) so peaks/valleys spread out horizontally
  // when more width is available. Flex-shrink removed for the same reason.
  const isStringWidth = typeof width === 'string'
  return (
    <svg width={width} height={h} viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block', flexShrink: isStringWidth ? 1 : 0, width: isStringWidth ? '100%' : undefined }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && <polygon points={`1,${h - 1} ${pts} ${w - 1},${h - 1}`} fill={`url(#${gradId})`} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
