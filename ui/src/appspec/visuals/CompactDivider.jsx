import React from 'react'

// Canvas object — a horizontal or vertical rule. No data.
export default function CompactDivider({ config = {} }) {
  const c = config
  const t = c._T || {}
  const vertical = c.orientation === 'vertical'
  const thickness = c.thickness ?? 2
  const color = c.color || t.CARD_BORDER || 'rgba(255,255,255,0.16)'
  const dashed = c.style === 'dashed' || c.style === 'dotted'
  const line = dashed
    ? { backgroundImage: `repeating-linear-gradient(${vertical ? '180deg' : '90deg'}, ${color} 0 ${c.style === 'dotted' ? thickness * 2 : 8}px, transparent ${c.style === 'dotted' ? thickness * 2 : 8}px ${c.style === 'dotted' ? thickness * 4 : 14}px)` }
    : { background: color }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: vertical ? thickness : '100%', height: vertical ? '100%' : thickness, borderRadius: 99, ...line }} />
    </div>
  )
}

CompactDivider.schema = [
  { key: 'orientation', label: 'Orientation', type: 'select', default: 'horizontal',
    options: [{ label: 'Horizontal', value: 'horizontal' }, { label: 'Vertical', value: 'vertical' }], group: 'Divider' },
  { key: 'thickness',   label: 'Thickness',   type: 'range',  default: 2, min: 1, max: 12, step: 1, group: 'Divider' },
  { key: 'color',       label: 'Colour',      type: 'color',  default: '', group: 'Divider' },
  { key: 'style',       label: 'Style',       type: 'select', default: 'solid',
    options: [{ label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' }, { label: 'Dotted', value: 'dotted' }], group: 'Divider' },
]
