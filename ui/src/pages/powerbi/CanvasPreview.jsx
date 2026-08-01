import React, { useEffect, useRef, useState } from 'react'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'

/**
 * CanvasPreview — center column of ReportEditor.
 * Renders the active page as a 1280×720 canvas (or page-defined size),
 * scaled to fit the available space while preserving aspect ratio.
 *
 * Visuals are shown as positioned cards with a teal "Semantica" badge,
 * type icon, name and dimensions. Selecting one shows cosmetic resize
 * handles. Delete button (×) appears on hover.
 */
export default function CanvasPreview({
  page,
  selectedVisualId,
  onSelectVisual,
  onDeleteVisual,
}) {
  const T    = getThemeTokens('dark')
  const teal = COLOR_SCHEMES.teal

  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setContainerSize({ w: rect.width, h: rect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (!page) {
    return (
      <div style={{ flex: 1, background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.textMuted, fontSize: 13 }}>No page selected</div>
      </div>
    )
  }

  const PAD     = 32
  const pageW   = page.width  || 1280
  const pageH   = page.height || 720
  const availW  = Math.max(containerSize.w - PAD * 2, 100)
  const availH  = Math.max(containerSize.h - PAD * 2, 100)
  const scale   = Math.min(availW / pageW, availH / pageH, 1)
  const stageW  = pageW * scale
  const stageH  = pageH * scale

  const isEmpty = (page.visuals?.length || 0) === 0
  const bgColor = page.background || '#0F1117'

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        background: '#0a0a14',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        padding: PAD,
        position: 'relative',
      }}
    >
      {/* Top info bar */}
      <div style={{
        position: 'absolute', top: 12, left: 16,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10, color: T.textMuted, letterSpacing: '0.04em',
      }}>
        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>Canvas</span>
        <span>·</span>
        <span>{pageW} × {pageH}</span>
        <span>·</span>
        <span>{Math.round(scale * 100)}%</span>
      </div>

      {/* The page stage */}
      <div
        onClick={() => onSelectVisual(null)}
        style={{
          width:  stageW || pageW,
          height: stageH || pageH,
          background: bgColor,
          border: `1px solid rgba(255,255,255,0.06)`,
          borderRadius: 4,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {isEmpty && (
          <EmptyPageState T={T} />
        )}

        {!isEmpty && page.visuals.map((v) => (
          <VisualBlock
            key={v.id}
            visual={v}
            scale={scale}
            selected={v.id === selectedVisualId}
            T={T}
            teal={teal}
            onSelect={(e) => { e.stopPropagation(); onSelectVisual(v.id) }}
            onDelete={(e) => { e.stopPropagation(); onDeleteVisual(v.id) }}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyPageState({ T }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14,
    }}>
      <div style={{
        width: 400, height: 300,
        border: `2px dashed rgba(255,255,255,0.10)`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ fontSize: 32 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
          Page is empty
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, maxWidth: 280, textAlign: 'center' }}>
          Add a Semantica visual using the inspector →
        </div>
      </div>
    </div>
  )
}

function VisualBlock({ visual, scale, selected, T, teal, onSelect, onDelete }) {
  const [hover, setHover] = useState(false)

  const x = (visual.x ?? 40) * scale
  const y = (visual.y ?? 40) * scale
  const w = (visual.width  ?? 320) * scale
  const h = (visual.height ?? 220) * scale

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: x, top: y,
        width: w, height: h,
        background: 'linear-gradient(180deg, rgba(20,20,34,0.98) 0%, rgba(11,11,20,0.99) 100%)',
        border: `1px solid ${selected ? teal.start : (hover ? teal.start + '66' : 'rgba(255,255,255,0.10)')}`,
        borderRadius: 8,
        boxShadow: selected
          ? `0 0 0 2px ${teal.start}55, 0 16px 36px rgba(0,0,0,0.4)`
          : hover
          ? `0 16px 36px rgba(0,0,0,0.32), 0 0 0 1px ${teal.start}33`
          : '0 8px 22px rgba(0,0,0,0.28)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'box-shadow 0.12s ease, border-color 0.12s ease',
      }}
    >
      {/* Top accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${teal.start}, ${teal.mid})`,
      }} />

      {/* Content */}
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        padding: 12, gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>{visualIcon(visual.type)}</span>
          <div style={{
            flex: 1, minWidth: 0,
            fontSize: 11, fontWeight: 700, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {visual.title || visual.type}
          </div>
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
            background: `${teal.start}22`,
            color: teal.mid,
            border: `1px solid ${teal.start}44`,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Semantica
          </span>
        </div>

        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: 'monospace' }}>
          {visual.type}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 10, color: T.textFaint, textAlign: 'center', lineHeight: 1.5 }}>
            {visual.measures?.length
              ? `${visual.measures.length} measure${visual.measures.length !== 1 ? 's' : ''}`
              : 'no measure'}
            <br />
            {visual.dimension || ' '}
          </div>
        </div>

        <div style={{
          fontSize: 9, color: T.textFaint, textAlign: 'right',
          fontFamily: 'monospace',
        }}>
          {visual.width || 320}×{visual.height || 220}
        </div>
      </div>

      {/* Delete button on hover */}
      {(hover || selected) && (
        <button
          onClick={onDelete}
          title="Delete visual"
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 18, height: 18, borderRadius: '50%',
            background: 'rgba(248,113,113,0.18)',
            border: '1px solid rgba(248,113,113,0.4)',
            color: '#FCA5A5',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontFamily: 'inherit', lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}

      {/* Resize handles (cosmetic only) */}
      {selected && [
        { c: 'nw', cursor: 'nwse-resize', t: -3, l: -3 },
        { c: 'ne', cursor: 'nesw-resize', t: -3, r: -3 },
        { c: 'sw', cursor: 'nesw-resize', b: -3, l: -3 },
        { c: 'se', cursor: 'nwse-resize', b: -3, r: -3 },
      ].map((p) => (
        <div key={p.c} style={{
          position: 'absolute',
          width: 8, height: 8,
          background: teal.start,
          border: '1px solid white',
          borderRadius: 2,
          top: p.t, bottom: p.b, left: p.l, right: p.r,
          cursor: p.cursor,
        }} />
      ))}
    </div>
  )
}

const ICONS = {
  kpi:         '⊞',
  bar:         '▦',
  stacked_bar: '▤',
  line:        '⌇',
  area:        '◢',
  donut:       '◐',
  gauge:       '◓',
  radar:       '✺',
  scatter:     '⁘',
  treemap:     '⬚',
  funnel:      '▽',
  sankey:      '⇶',
  table:       '☷',
}
function visualIcon(type) { return ICONS[type] || '◇' }
