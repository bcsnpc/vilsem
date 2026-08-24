import React from 'react'

// Mini chart glyph for the Library tiles (Slate; a consistent mini-bar mark).
// Per-type schematic glyph for the chart library — each chart type gets its own
// recognizable icon (cyan = the data series, grey = structure). 48×24 viewBox.
//
// Shared by the new-project authoring shell (AppGenerator) and the PBI injector
// so both libraries show identical glyphs. Pure presentational — the only inputs
// are the `type` prop and theme CSS vars; no host coupling.
export default function MiniChart({ type = 'bar' }) {
  const A = 'var(--v-accent)'       // data series
  const M = 'var(--v-surface-4)'    // structure / secondary
  const Q = 'var(--v-accent-quiet)' // filled accent area
  const glyphs = {
    kpi: (
      <>
        <text x="24" y="15" textAnchor="middle" style={{ fontFamily: 'var(--v-mono)', fontSize: 12, fontWeight: 700, fill: A }}>12.3</text>
        <rect x="17" y="18" width="14" height="2" rx="1" fill={M} />
      </>
    ),
    gauge: (
      <>
        <path d="M7 19 A 17 17 0 0 1 41 19" fill="none" stroke={M} strokeWidth="3" strokeLinecap="round" />
        <line x1="24" y1="19" x2="33" y2="9" stroke={A} strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="19" r="2.5" fill={A} />
      </>
    ),
    bar: (
      <>
        {[[6, 12], [17, 6], [28, 10], [39, 14]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="7" height={21 - y} rx="1" fill={i === 1 ? A : M} />
        ))}
      </>
    ),
    line: (
      <>
        <polyline points="5,17 17,8 28,13 43,5" fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="43" cy="5" r="2" fill={A} />
      </>
    ),
    area: (
      <>
        <path d="M5,17 L17,8 L28,13 L43,5 L43,21 L5,21 Z" fill={Q} />
        <polyline points="5,17 17,8 28,13 43,5" fill="none" stroke={A} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    donut: (
      <>
        <circle cx="24" cy="12" r="8" fill="none" stroke={M} strokeWidth="4" />
        <path d="M24 4 A 8 8 0 0 1 31.5 16.5" fill="none" stroke={A} strokeWidth="4" />
      </>
    ),
    scatter: (
      <>
        {[[8, 15], [16, 9], [22, 17], [30, 7], [36, 13], [42, 10]].map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2" fill={i % 2 ? A : M} />
        ))}
      </>
    ),
    table: (
      <>
        <rect x="6" y="5" width="36" height="14" rx="1.5" fill="none" stroke={M} strokeWidth="1.5" />
        <rect x="6.75" y="5.75" width="34.5" height="4" fill={Q} />
        <line x1="18" y1="5" x2="18" y2="19" stroke={M} strokeWidth="1" />
        <line x1="30" y1="5" x2="30" y2="19" stroke={M} strokeWidth="1" />
        <line x1="6" y1="12" x2="42" y2="12" stroke={M} strokeWidth="1" />
      </>
    ),
    waterfall: (
      <>
        {[[6, 13, 6], [16, 9, 5], [26, 6, 5], [36, 5, 14]].map(([x, y, h], i) => (
          <rect key={i} x={x} y={y} width="7" height={h} rx="1" fill={i === 3 ? A : M} />
        ))}
      </>
    ),
    treemap: (
      <>
        <rect x="6" y="5" width="20" height="14" rx="1" fill={A} />
        <rect x="27" y="5" width="15" height="8" rx="1" fill={M} />
        <rect x="27" y="14" width="15" height="5" rx="1" fill={M} />
      </>
    ),
    grouped_bar: (
      <>
        {[[8, 10, A], [15, 13, M], [29, 7, A], [36, 12, M]].map(([x, y, f], i) => (
          <rect key={i} x={x} y={y} width="6" height={21 - y} rx="1" fill={f} />
        ))}
      </>
    ),
    stacked_bar: (
      <>
        {[[8, 13, 7], [21, 11, 6], [34, 14, 5]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="8" height={21 - y} rx="1" fill={M} />
            <rect x={x} y={y - 6} width="8" height="6" rx="1" fill={A} />
          </g>
        ))}
      </>
    ),
    stacked_area: (
      <>
        <path d="M5,13 L18,7 L30,11 L43,5 L43,21 L5,21 Z" fill={Q} />
        <path d="M5,18 L18,15 L30,17 L43,14 L43,21 L5,21 Z" fill={M} />
      </>
    ),
    lollipop: (
      <>
        {[[9, 10], [19, 6], [29, 13], [39, 8]].map(([x, y], i) => (
          <g key={i}>
            <line x1={x} y1="21" x2={x} y2={y} stroke={M} strokeWidth="1.5" />
            <circle cx={x} cy={y} r="2.5" fill={A} />
          </g>
        ))}
      </>
    ),
    radar: (
      <>
        <polygon points="24,3 32.5,9.2 29.3,19.5 18.7,19.5 15.5,9.2" fill="none" stroke={M} strokeWidth="1.5" />
        <polygon points="24,6.5 29.2,10.3 27,16.5 21,16.5 18.8,10.3" fill={Q} stroke={A} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
    bar_race: (
      <>
        {[[6, 6, 30], [6, 12, 20], [6, 18, 12]].map(([x, y, w], i) => (
          <rect key={i} x={x} y={y - 2} width={w} height="4" rx="1" fill={i === 0 ? A : M} />
        ))}
        <text x="44" y="8" textAnchor="end" style={{ fontFamily: 'var(--v-mono)', fontSize: 6, fontWeight: 700, fill: A }}>1</text>
      </>
    ),
    text_box: (
      <>
        <text x="24" y="16" textAnchor="middle" style={{ fontFamily: 'var(--v-font)', fontSize: 13, fontWeight: 700, fill: A }}>T</text>
        <rect x="14" y="19" width="20" height="1.5" rx="0.75" fill={M} />
      </>
    ),
    shape: (<rect x="13" y="5" width="22" height="14" rx="3" fill={Q} stroke={A} strokeWidth="1.5" />),
    image: (
      <>
        <rect x="13" y="5" width="22" height="14" rx="2" fill="none" stroke={M} strokeWidth="1.5" />
        <circle cx="19" cy="10" r="2" fill={A} />
        <path d="M14 18 L21 12 L26 16 L30 12 L34 16.5" fill="none" stroke={A} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
    divider: (<rect x="8" y="11" width="32" height="2" rx="1" fill={A} />),
    nav_button: (<rect x="12" y="8" width="24" height="8" rx="4" fill={A} />),
  }
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" style={{ display: 'block' }} aria-hidden>
      {glyphs[type] || glyphs.bar}
    </svg>
  )
}
