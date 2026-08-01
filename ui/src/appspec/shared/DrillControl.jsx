import React from 'react'
import { drillStyleOf, expandLevels, drillCrumbs } from './drill.js'

// Drill control — the affordance for going back up. Its shape depends on the
// visual's drill style:
//   • expand  → a "Level: <child> · <value>" pill + a Collapse button (pattern 02)
//   • replace → a breadcrumb trail; each crumb / the ↰ arrow pops a level
// Self-hides when nothing is drilled. Shared by the view renderer and the edit
// canvas so drill looks identical in normal and present mode.
//
// Theme is passed loosely: `muted`, `primary`, `border` colour strings.
export default function DrillControl({ visual, path, muted, primary, border, onDrillTo }) {
  const style = drillStyleOf(visual)
  const p = Array.isArray(path) ? path : []

  if (style === 'expand') {
    if (!p.length) return null
    const lv = expandLevels(visual)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '0 2px 6px' }}>
        <span style={{ fontSize: 10.5, fontFamily: 'monospace', letterSpacing: '0.04em',
          color: primary, border: `1px solid ${border}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
          Level: {lv?.child?.label || 'detail'} · {p[0]}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onDrillTo(visual.id, 0) }}
          style={{ font: 'inherit', fontSize: 11, color: muted, background: 'none',
            border: `1px solid ${border}`, borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}>
          Collapse
        </button>
      </div>
    )
  }

  const crumbs = drillCrumbs(visual, p)
  if (crumbs.length <= 1) return null
  const lastIdx = crumbs.length - 1
  const curDepth = crumbs[lastIdx].toDepth
  const btn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, color: muted }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
      flexShrink: 0, fontSize: 11, lineHeight: 1.5, color: muted, padding: '0 2px 5px' }}>
      <button title="Drill up" onClick={(e) => { e.stopPropagation(); onDrillTo(visual.id, curDepth - 1) }}
        style={{ ...btn, fontSize: 13, lineHeight: 1, marginRight: 2 }}>↰</button>
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ opacity: 0.45 }}>›</span>}
          {i === lastIdx
            ? <span style={{ color: primary, fontWeight: 600 }}>{c.label}</span>
            : <button onClick={(e) => { e.stopPropagation(); onDrillTo(visual.id, c.toDepth) }}
                style={{ ...btn, textDecoration: 'underline', textUnderlineOffset: 2 }}>{c.label}</button>}
        </React.Fragment>
      ))}
    </div>
  )
}
