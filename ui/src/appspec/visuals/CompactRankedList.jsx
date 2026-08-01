import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactRankedList({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const showRank   = config.showRank ?? true
  const showBar    = config.showBar ?? true
  const maxItems   = config.limit || 10
  const items      = rows.slice(0, maxItems)
  const maxVal     = Math.max(...items.map(r => Math.abs(r._val || 0)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {items.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderBottom: `1px solid ${t.tableDivider}` }}>
          {showRank && (
            <div style={{ width: 20, height: 20, borderRadius: 4, background: i < 3 ? `${p.start}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i < 3 ? p.text : t.textMuted, flexShrink: 0 }}>{i + 1}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._cat}</div>
            {showBar && (
              <div style={{ height: 3, background: t.shimmerBg, borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${maxVal > 0 ? (Math.abs(r._val || 0) / maxVal) * 100 : 0}%`, background: p.start, borderRadius: 2, opacity: 0.6 + (0.4 * (1 - i / items.length)) }} />
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.text, flexShrink: 0 }}>{fmtVal(r._val, config.prefix, config.suffix)}</div>
        </div>
      ))}
    </div>
  )
}
