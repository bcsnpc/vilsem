import React, { useState, useMemo, useRef, useCallback } from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

const MEDALS = ['🥇', '🥈', '🥉']
const DIM_W_DEFAULT = 150
const VAL_W_DEFAULT = 120

function hexToRgb(hex) {
  const m = (hex || '#888').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '136,136,136'
}

export default function CompactTableEcharts({ rows, config, loading, error }) {
  // All hooks before early returns
  const [sortState, setSortState] = useState(null)
  const [colWidths, setColWidths] = useState({})  // { 'dim-0': px, 'val-0': px, ... }
  const dragRef = useRef(null)

  const safeRows = rows || []
  const first = safeRows[0]

  const hasMultiDim = Array.isArray(first?._cats) && first._cats.length > 0
  const nDims = hasMultiDim ? first._cats.length : 1

  const hasMultiVal = Array.isArray(first?._vals) && first._vals.length > 0
  const nVals = hasMultiVal
    ? first._vals.length
    : safeRows.some(r => r._val3 != null) ? 3
    : safeRows.some(r => r._val2 != null) ? 2
    : 1

  const getVal = useCallback((r, vi) => {
    if (hasMultiVal) return r._vals?.[vi] ?? null
    if (vi === 0) return r._val ?? null
    if (vi === 1) return r._val2 ?? null
    if (vi === 2) return r._val3 ?? null
    return null
  }, [hasMultiVal])

  const getCat = useCallback((r, di) => {
    if (hasMultiDim) return r._cats?.[di] ?? ''
    if (di === 0) return r._cat ?? ''
    if (di === 1) return r._cat2 ?? ''
    return ''
  }, [hasMultiDim])

  const getColW = (kind, idx) => colWidths[`${kind}-${idx}`] ?? (kind === 'dim' ? DIM_W_DEFAULT : VAL_W_DEFAULT)

  const valMaxes = useMemo(() =>
    Array.from({ length: nVals }, (_, vi) =>
      Math.max(...safeRows.map(r => getVal(r, vi) ?? 0), 0) || 1
    ),
  [safeRows, nVals, getVal])

  const sortedRows = useMemo(() => {
    if (!sortState || !safeRows.length) return safeRows
    const { kind, idx, dir } = sortState
    const mult = dir === 'asc' ? 1 : -1
    return [...safeRows].sort((a, b) => {
      if (kind === 'dim') {
        return mult * String(getCat(a, idx)).localeCompare(String(getCat(b, idx)), undefined, { numeric: true, sensitivity: 'base' })
      }
      return mult * ((getVal(a, idx) ?? 0) - (getVal(b, idx) ?? 0))
    })
  }, [safeRows, sortState, getCat, getVal])

  // Drag-to-resize handler — attaches global mouse listeners during drag
  const startResize = (kind, idx) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { kind, idx, startX: e.clientX, startW: getColW(kind, idx) }
    const onMove = (ev) => {
      if (!dragRef.current) return
      const { kind: k, idx: i, startX, startW } = dragRef.current
      const newW = Math.max(40, startW + ev.clientX - startX)
      setColWidths(prev => ({ ...prev, [`${k}-${i}`]: newW }))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Early returns after all hooks
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!safeRows.length) return <EmptyState label={config.title || 'Table'} />

  // Labels: embedded in row data (most reliable) → config injection → fallback
  const dimLabels = (() => {
    const embedded = first?._dimLabels
    if (Array.isArray(embedded) && embedded.length >= nDims) return embedded.slice(0, nDims)
    const cfg = config._dimensionLabels
    if (Array.isArray(cfg) && cfg.length >= nDims) return cfg.slice(0, nDims)
    return Array.from({ length: nDims }, (_, i) => i === 0 ? 'Category' : `Dim ${i + 1}`)
  })()

  const measureLabels = (() => {
    const embedded = first?._measureLabels
    if (Array.isArray(embedded) && embedded.length >= nVals) return embedded.slice(0, nVals)
    const cfg = config._measureNames
    if (Array.isArray(cfg) && cfg.length >= nVals) return cfg.slice(0, nVals)
    return Array.from({ length: nVals }, (_, i) =>
      i === 0 ? (config.measureName || 'Value')
      : i === 1 ? (config.secondaryMeasureName || 'Value 2')
      : `Value ${i + 1}`
    )
  })()

  const toggleSort = (kind, idx) => setSortState(prev => {
    if (prev?.kind === kind && prev?.idx === idx) {
      if (prev.dir === 'desc') return { kind, idx, dir: 'asc' }
      return null
    }
    return { kind, idx, dir: 'desc' }
  })

  const showRank    = config.rankColumn !== false
  const showMiniBar = config.miniBars !== false
  const showHeatmap = !!config.heatmap

  const gridCols = [
    showRank && '28px',
    Array.from({ length: nDims }, (_, i) => `${getColW('dim', i)}px`).join(' '),
    Array.from({ length: nVals }, (_, i) => `${getColW('val', i)}px`).join(' '),
  ].filter(Boolean).join(' ')

  const hdrBase = {
    fontSize: 9, fontWeight: 700, color: t.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: 3,
    overflow: 'hidden', position: 'relative',
  }

  const SortIcon = ({ kind, idx }) => {
    const active = sortState?.kind === kind && sortState?.idx === idx
    return (
      <span style={{ fontSize: 9, flexShrink: 0, opacity: active ? 1 : 0.3, color: active ? p.text : t.textFaint }}>
        {active ? (sortState.dir === 'desc' ? '↓' : '↑') : '⇅'}
      </span>
    )
  }

  // Resize handle shown on right edge of every header cell
  const ResizeHandle = ({ kind, idx }) => (
    <div
      onMouseDown={startResize(kind, idx)}
      style={{
        position: 'absolute', right: -3, top: 0, bottom: 0, width: 6,
        cursor: 'col-resize', zIndex: 2,
        borderRight: `2px solid transparent`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderRightColor = p.text }}
      onMouseLeave={e => { e.currentTarget.style.borderRightColor = 'transparent' }}
    />
  )

  const cardBg = t.CARD_BG || '#1a1b2e'
  const rgb = hexToRgb(p.text)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflowX: 'auto' }}>
      {/* Sticky header */}
      <div style={{
        display: 'grid', gridTemplateColumns: gridCols, gap: 0,
        padding: '0 0 6px', borderBottom: `1px solid ${t.tableDivider}`,
        flexShrink: 0, background: cardBg, zIndex: 1,
        minWidth: 'max-content', width: '100%',
      }}>
        {showRank && (
          <span style={{ ...hdrBase, justifyContent: 'center', cursor: 'default', padding: '0 4px' }}>#</span>
        )}
        {Array.from({ length: nDims }, (_, di) => (
          <div key={di} style={{ ...hdrBase, padding: '0 8px 0 4px' }} onClick={() => toggleSort('dim', di)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{dimLabels[di]}</span>
            <SortIcon kind="dim" idx={di} />
            <ResizeHandle kind="dim" idx={di} />
          </div>
        ))}
        {Array.from({ length: nVals }, (_, vi) => (
          <div key={vi} style={{ ...hdrBase, justifyContent: 'flex-end', padding: '0 4px' }} onClick={() => toggleSort('val', vi)}>
            <SortIcon kind="val" idx={vi} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{measureLabels[vi]}</span>
            {vi < nVals - 1 && <ResizeHandle kind="val" idx={vi} />}
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, minWidth: 'max-content', width: '100%' }}>
        {sortedRows.map((r, i) => {
          const naturalTop3 = !sortState && i < 3
          const rowBg = i % 2 === 0 ? 'transparent' : t.rowAlt
          return (
            <div key={i}
              style={{
                display: 'grid', gridTemplateColumns: gridCols, gap: 0,
                background: rowBg, borderBottom: `1px solid ${t.tableDivider}`,
                alignItems: 'stretch', transition: 'background 0.12s', minHeight: 28,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.rowHover }}
              onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
            >
              {/* Rank */}
              {showRank && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 2px', flexShrink: 0 }}>
                  {naturalTop3
                    ? <span style={{ fontSize: 13, lineHeight: 1 }}>{MEDALS[i]}</span>
                    : <span style={{ fontSize: 9, fontWeight: 700, color: t.textFaint }}>{i + 1}</span>
                  }
                </div>
              )}

              {/* Dimension cells */}
              {Array.from({ length: nDims }, (_, di) => (
                <div key={di} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 4px', minWidth: 0 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: naturalTop3 && di === 0 ? 600 : 400,
                    color: naturalTop3 && di === 0 ? t.textPrimary : t.textSecondary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{getCat(r, di) || '—'}</span>
                </div>
              ))}

              {/* Measure cells */}
              {Array.from({ length: nVals }, (_, vi) => {
                const val = getVal(r, vi)
                const pct = val != null && valMaxes[vi] > 0
                  ? Math.max(0, Math.min(100, (val / valMaxes[vi]) * 100))
                  : 0
                const barBg = showHeatmap
                  ? `rgba(${rgb}, ${0.06 + (pct / 100) * 0.22})`
                  : showMiniBar && val != null
                    ? `linear-gradient(to right, rgba(${rgb},0.18) ${pct}%, transparent ${pct}%)`
                    : undefined

                return (
                  <div key={vi} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    padding: '4px 6px', minWidth: 0, background: barBg,
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: vi === 0 ? 600 : 500,
                      color: vi === 0 ? (naturalTop3 ? p.text : t.textSecondary) : t.textMuted,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}>
                      {fmtVal(val, vi === 0 ? config.prefix : null, vi === 0 ? config.suffix : null)}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
