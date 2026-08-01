import React from 'react'
import { TEMPLATES, generateFromTemplate, previewUsage } from './index.js'

const TYPE_COLORS = {
  kpi:         '#818CF8',
  bar:         '#34D399',
  line:        '#60A5FA',
  area:        '#34D399',
  donut:       '#F472B6',
  scatter:     '#FBBF24',
  waterfall:   '#A78BFA',
  grouped_bar: '#4ADE80',
  table:       '#94A3B8',
  treemap:     '#FB923C',
}

// Compact SVG layout preview — 12×7 grid cells at 4px each = 48×28px
function MiniLayout({ blocks }) {
  const PX = 4
  const COLS = 12
  const ROWS = 7
  return (
    <svg
      viewBox={`0 0 ${COLS * PX} ${ROWS * PX}`}
      width={COLS * PX}
      height={ROWS * PX}
      style={{ display: 'block', flexShrink: 0, borderRadius: 2 }}
    >
      {blocks.map((b, i) => (
        <rect
          key={i}
          x={b.x * PX + 0.3}
          y={b.y * PX + 0.3}
          width={b.w * PX - 0.6}
          height={b.h * PX - 0.6}
          rx={0.8}
          fill={TYPE_COLORS[b.type] || '#94A3B8'}
          opacity={0.8}
        />
      ))}
    </svg>
  )
}

export default function TemplatePicker({ measures, dimensions, theme, onApply }) {
  function handleClick(tpl) {
    const spec = generateFromTemplate(tpl.id, measures, dimensions, {
      colorScheme: tpl.colorScheme,
      mode: theme?.mode || 'dark',
    })
    onApply(spec, tpl)
  }

  const usingFallback = !measures || measures.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Template Library
        </div>
        {usingFallback && (
          <div style={{ fontSize: 9, color: '#475569' }}>preview — connect a model to use real measures</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, minWidth: 0, width: '100%' }}>
        {TEMPLATES.map(tpl => {
          const usedMeasures = previewUsage(tpl.id, measures)
          return (
            <button
              key={tpl.id}
              onClick={() => handleClick(tpl)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '8px 10px',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = tpl.accent + '66'
                e.currentTarget.style.background   = tpl.accent + '10'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.background   = 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tpl.label}
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B' }}>{tpl.desc}</div>
                </div>
                <MiniLayout blocks={tpl.preview} />
              </div>
              {usedMeasures.length > 0 && (
                <div style={{ fontSize: 9, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {usingFallback ? '' : `${usedMeasures.slice(0, 2).join(', ')}${usedMeasures.length > 2 ? '…' : ''}`}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 2 }}>
        or describe your own below
      </div>
    </div>
  )
}
