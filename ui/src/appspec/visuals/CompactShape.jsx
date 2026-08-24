import React from 'react'

// Canvas object — a real vector shape. Rendered as SVG (crisp at any size, stretches to
// fill its box like a shape tool) with fill + stroke + opacity. Non-scaling stroke keeps
// borders uniform even when the box is non-square.
export const SHAPE_OPTIONS = [
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Rounded',   value: 'rounded' },
  { label: 'Ellipse',   value: 'ellipse' },
  { label: 'Triangle',  value: 'triangle' },
  { label: 'Diamond',   value: 'diamond' },
  { label: 'Pentagon',  value: 'pentagon' },
  { label: 'Hexagon',   value: 'hexagon' },
  { label: 'Star',      value: 'star' },
  { label: 'Arrow',     value: 'arrow' },
  { label: 'Chevron',   value: 'chevron' },
  { label: 'Line',      value: 'line' },
]

export default function CompactShape({ config = {} }) {
  const c = config
  const shape  = c.shape || 'rectangle'
  const fill   = c.fillColor || 'rgba(94,234,212,0.16)'
  const stroke = c.borderColor || '#5EEAD4'
  const sw     = c.borderWidth ?? 0
  const opacity = c.opacity ?? 1
  const radius = c.borderRadius ?? 0

  const stroked = { fill, stroke: sw > 0 ? stroke : 'none', strokeWidth: sw, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' }

  let el
  switch (shape) {
    case 'ellipse':  el = <ellipse cx="50" cy="50" rx="48" ry="48" {...stroked} />; break
    case 'triangle': el = <polygon points="50,4 96,96 4,96" {...stroked} />; break
    case 'diamond':  el = <polygon points="50,3 97,50 50,97 3,50" {...stroked} />; break
    case 'pentagon': el = <polygon points="50,3 97,39 78,97 22,97 3,39" {...stroked} />; break
    case 'hexagon':  el = <polygon points="27,4 73,4 97,50 73,96 27,96 3,50" {...stroked} />; break
    case 'star':     el = <polygon points="50,3 62,36 97,37 69,59 80,94 50,73 20,94 31,59 3,37 38,36" {...stroked} />; break
    case 'arrow':    el = <polygon points="3,33 58,33 58,10 97,50 58,90 58,67 3,67" {...stroked} />; break
    case 'chevron':  el = <polygon points="3,8 41,8 79,50 41,92 3,92 41,50" {...stroked} />; break
    case 'rounded':  el = <rect x="2" y="2" width="96" height="96" rx={radius || 16} {...stroked} />; break
    case 'line':     el = <line x1="2" y1="50" x2="98" y2="50" stroke={sw > 0 ? stroke : fill} strokeWidth={sw || 3} vectorEffect="non-scaling-stroke" strokeLinecap="round" />; break
    default:         el = <rect x="2" y="2" width="96" height="96" rx={radius} {...stroked} />
  }

  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block', opacity, overflow: 'visible' }}>
      {el}
    </svg>
  )
}

CompactShape.schema = [
  { key: 'shape',       label: 'Shape',        type: 'select', default: 'rectangle', options: SHAPE_OPTIONS, group: 'Shape' },
  { key: 'fillColor',   label: 'Fill',         type: 'color',  default: '', group: 'Shape' },
  { key: 'borderColor', label: 'Border',       type: 'color',  default: '', group: 'Shape' },
  { key: 'borderWidth', label: 'Border width', type: 'range',  default: 0, min: 0, max: 12, step: 1, group: 'Shape' },
  { key: 'borderRadius', label: 'Corner radius', type: 'range', default: 16, min: 0, max: 60, step: 1, group: 'Shape' },
  { key: 'opacity',     label: 'Opacity',      type: 'range',  default: 1, min: 0.05, max: 1, step: 0.05, group: 'Shape' },
]
