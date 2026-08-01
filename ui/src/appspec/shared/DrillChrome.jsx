import React from 'react'
import DrillControl from './DrillControl.jsx'
import DetailDrawer from './DetailDrawer.jsx'
import { drillStyleOf } from './drill.js'

// Wraps a chart with its drill chrome so every render surface (view, present, edit)
// looks identical:
//   • panel style  → chart | detail drawer  (pattern 01, chart shrinks to make room)
//   • else         → drill control on top + chart  (expand pill / replace breadcrumb)
// Fills its parent (flex:1) and never scrolls the body.
export default function DrillChrome({
  visual, path, panel, onDrillTo, onPanelClose,
  muted, primary, border, surface, accent, children,
}) {
  const style = drillStyleOf(visual)

  if (style === 'panel') {
    const open = !!(panel && panel.value != null)
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: open ? 12 : 0, transition: 'gap .3s ease' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {open && (
          <DetailDrawer visual={visual} panel={panel} onClose={onPanelClose}
            muted={muted} primary={primary} border={border} surface={surface} accent={accent} />
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <DrillControl visual={visual} path={path} muted={muted} primary={primary} border={border} onDrillTo={onDrillTo} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  )
}
