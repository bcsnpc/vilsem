import React, { useState, useEffect } from 'react'

// Shared edit-canvas zoom: manual ±, Fit-to-width, and Ctrl/Cmd-scroll. Extracted
// from AppGenerator's canvas so the injector (and, later, new-project) share ONE
// implementation instead of drifting copies. `scrollRef` is the scroll viewport.
export function useCanvasZoom(scrollRef) {
  const [zoom, setZoom]       = useState(1)
  const [autoFit, setAutoFit] = useState(true)
  const [viewportW, setViewportW] = useState(0)

  // Measure the scroll viewport so Fit can scale the page to its width.
  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    const measure = () => setViewportW(el.clientWidth)
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(el) }
    window.addEventListener('resize', measure)
    return () => { ro && ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [scrollRef])

  // Ctrl/Cmd + scroll zooms (only when the cursor is over the canvas). Window-level
  // non-passive listener so preventDefault works. Mirrors AppGenerator.jsx.
  useEffect(() => {
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      const el = scrollRef?.current
      if (!el || !el.contains(e.target)) return
      e.preventDefault()
      setAutoFit(false)
      setZoom(z => Math.min(2, Math.max(0.25, Math.round((z - Math.sign(e.deltaY) * 0.08) * 100) / 100)))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [scrollRef])

  const zoomIn  = () => { setAutoFit(false); setZoom(z => Math.min(2, Math.round((z + 0.1) * 100) / 100)) }
  const zoomOut = () => { setAutoFit(false); setZoom(z => Math.max(0.25, Math.round((z - 0.1) * 100) / 100)) }
  const fit     = () => setAutoFit(true)

  return { zoom, autoFit, viewportW, setZoom, setAutoFit, zoomIn, zoomOut, fit }
}

// Pure: effective CSS zoom for a page of width pageW inside a viewport. Fit scales
// down to width (never upscales past 100%); manual uses the chosen zoom.
export function computeEffZoom(autoFit, zoom, viewportW, pageW, pad = 48) {
  if (!autoFit) return zoom
  if (!viewportW || !pageW) return 1
  const fitScale = Math.min(1, (viewportW - pad) / pageW)
  return fitScale > 0 ? fitScale : 1
}

// The Fit / − / % / ＋ control cluster for the canvas toolbar.
export function EditorZoomControls({ zoom, autoFit, onFit, onZoomIn, onZoomOut }) {
  const chip = { width: 22, height: 24, border: '1px solid var(--v-border)', background: 'var(--v-surface-2)', color: 'var(--v-text-2)', borderRadius: 'var(--v-r-2)', font: '600 13px var(--v-font)', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }
  const toggle = { height: 24, padding: '0 8px', border: `1px solid ${autoFit ? 'var(--v-accent-border)' : 'var(--v-border)'}`, background: autoFit ? 'var(--v-accent-quiet)' : 'var(--v-surface-2)', color: autoFit ? 'var(--v-accent)' : 'var(--v-text-2)', borderRadius: 'var(--v-r-2)', font: '600 11px var(--v-font)', cursor: 'pointer', flexShrink: 0 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <button style={toggle} onClick={onFit} title="Fit page to canvas width">Fit</button>
      <button style={chip} onClick={onZoomOut} title="Zoom out">−</button>
      <span style={{ font: '600 11px var(--v-mono)', color: 'var(--v-text-2)', minWidth: 42, textAlign: 'center', whiteSpace: 'nowrap' }}>{autoFit ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
      <button style={chip} onClick={onZoomIn} title="Zoom in">＋</button>
    </div>
  )
}
