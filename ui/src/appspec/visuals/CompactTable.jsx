import React from 'react'
import { pal } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactTable({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || 'Table'} />

  const hasTwoMeasures = rows.some(r => r._val2 != null)
  const m1Label = config.measureName || 'Value'
  const m2Label = config.secondaryMeasureName || 'Value 2'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasTwoMeasures ? '16px 1fr auto auto' : '16px 1fr auto',
        gap: 8,
        padding: '0 6px 6px',
        borderBottom: `1px solid ${t.tableDivider}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: t.textFaint, textAlign: 'center' }}>#</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: 64 }}>{m1Label}</span>
        {hasTwoMeasures && (
          <span style={{ fontSize: 9, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: 64 }}>{m2Label}</span>
        )}
      </div>
      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {rows.map((r, i) => {
          const isTop3 = i < 3
          const rowBg = i % 2 === 0 ? 'transparent' : t.rowAlt
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: hasTwoMeasures ? '16px 1fr auto auto' : '16px 1fr auto',
              gap: 8,
              padding: '5px 6px',
              background: rowBg,
              borderBottom: `1px solid ${t.tableDivider}`,
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.rowHover }}
            onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
            >
              {/* Rank */}
              <span style={{
                fontSize: 10,
                fontWeight: isTop3 ? 700 : 500,
                color: isTop3 ? p.text : t.textFaint,
                textAlign: 'center',
              }}>{i + 1}</span>
              {/* Category */}
              <span style={{
                fontSize: 11,
                fontWeight: isTop3 ? 600 : 400,
                color: isTop3 ? t.textPrimary : t.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{r._cat || '—'}</span>
              {/* Primary measure */}
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: isTop3 ? p.text : t.textSecondary,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                minWidth: 64,
              }}>{fmtVal(r._val, config.prefix, config.suffix)}</span>
              {/* Secondary measure */}
              {hasTwoMeasures && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: t.textMuted,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 64,
                }}>{fmtVal(r._val2, config.prefix, config.suffix)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
