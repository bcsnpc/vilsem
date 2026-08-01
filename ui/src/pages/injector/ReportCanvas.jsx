import React, { useRef, useState, useLayoutEffect, useCallback, useMemo } from 'react'
import AppSpecRenderer from '../../appspec/AppSpecRenderer.jsx'

// ReportCanvas — a to-scale view of the target report page so the user can SEE
// how the generated visual fits. Existing visuals render as labeled boxes;
// the new (generated) visuals render as draggable/resizable placement boxes
// with a live Semantica preview inside. Coordinates are in REPORT pixels;
// only the on-screen rendering is scaled.
//
// Props:
//   pageWidth, pageHeight   report page size (px)
//   pageBg                  report page background color (CSS color) | null
//   existingVisuals []      [{ x, y, width, height, visualType }]
//   placements []           [{ id, x, y, width, height }]  (report px) — the new visuals
//   rawSpec                 the AppSpec from generateAppSpec (for live preview, matched by id)
//   measures                availableMeasures for AppSpecRenderer
//   canvasTheme             'light' | 'dark' — theme for the preview render
//   onPlacementsChange(next) called with updated placements during drag/resize
export default function ReportCanvas({
  pageWidth = 1280, pageHeight = 720, pageBg, existingVisuals = [],
  placements = [], rawSpec, measures, canvasTheme = 'light', maxHeight = 540, onPlacementsChange,
}) {
  const wrapRef = useRef(null)
  const [wrapW, setWrapW] = useState(900)

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(() => {
      setWrapW(wrapRef.current?.clientWidth || 900)
    })
    ro.observe(wrapRef.current)
    setWrapW(wrapRef.current.clientWidth || 900)
    return () => ro.disconnect()
  }, [])

  // Fit the WHOLE page into the available width AND height so every placement
  // (including ones auto-placed below existing content) is visible without scroll.
  const scale = Math.max(0.05, Math.min((wrapW - 2) / pageWidth, maxHeight / pageHeight))
  const labelFor = (id) => {
    const v = (rawSpec?.visuals || []).find(x => x.id === id)
    return v?.config?.title || v?.type || 'new visual'
  }
  const isDark = canvasTheme === 'dark'
  const bg = pageBg || (isDark ? '#0b0b12' : '#FFFFFF')

  // Drag / resize. mode: 'move' | 'resize'. Deltas are screen px → report px (÷scale).
  const drag = useRef(null)
  const onPointerDown = useCallback((e, id, mode) => {
    e.preventDefault(); e.stopPropagation()
    const p = placements.find(pl => pl.id === id)
    if (!p) return
    drag.current = { id, mode, startX: e.clientX, startY: e.clientY, orig: { ...p } }
    const onMove = (ev) => {
      const d = drag.current
      if (!d) return
      const dx = (ev.clientX - d.startX) / scale
      const dy = (ev.clientY - d.startY) / scale
      const next = placements.map(pl => {
        if (pl.id !== d.id) return pl
        if (d.mode === 'move') {
          const x = Math.max(0, Math.min(pageWidth - pl.width, d.orig.x + dx))
          const y = Math.max(0, Math.min(Math.max(pageHeight, d.orig.y + pl.height) - pl.height, d.orig.y + dy))
          return { ...pl, x: Math.round(x), y: Math.round(y) }
        }
        // resize
        const width = Math.max(120, Math.min(pageWidth - pl.x, d.orig.width + dx))
        const height = Math.max(80, d.orig.height + dy)
        return { ...pl, width: Math.round(width), height: Math.round(height) }
      })
      onPlacementsChange?.(next)
    }
    const onUp = () => { drag.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [placements, scale, pageWidth, pageHeight, onPlacementsChange])

  // Build a STABLE single-visual AppSpec per placement id for the live preview.
  // Memoized on the id-set + rawSpec only (NOT on x/y/w/h) so dragging/resizing
  // never changes the spec identity — otherwise AppSpecRenderer's data fetch
  // (keyed on the spec) re-queries Fabric on every render → 429 throttle storm.
  // Pixel sizing is handled by the box CSS + the renderer's ResizeObserver via
  // the canvasWidth prop, which is NOT a query dependency.
  const placementIdKey = placements.map(p => p.id).join('|')
  const previewSpecs = useMemo(() => {
    const map = {}
    for (const p of placements) {
      const v = (rawSpec?.visuals || []).find(vi => vi.id === p.id)
      if (!v) continue
      map[p.id] = {
        title: '',
        layout: { pagePreset: 'custom', pageWidth: 600, pageHeight: 400, columns: 12, rowHeight: 80, gap: 0 },
        visuals: [{ ...v, position: { x: 0, y: 0, w: 12, h: 5 } }],
      }
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawSpec, placementIdKey])

  return (
    <div ref={wrapRef} style={{ width: '100%', overflow: 'auto' }}>
      <div style={{
        position: 'relative', margin: '0 auto',
        width: pageWidth * scale, height: pageHeight * scale,
        background: bg, border: '1px solid var(--border-strong)', borderRadius: 6,
        boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      }}>
        {/* Existing visuals — read-only context boxes */}
        {existingVisuals.map((v, i) => (
          <div key={`ex-${i}`} style={{
            position: 'absolute', left: (v.x || 0) * scale, top: (v.y || 0) * scale,
            width: (v.width || 0) * scale, height: (v.height || 0) * scale,
            border: `1px dashed ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(17,24,39,0.22)'}`,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(17,24,39,0.02)',
            borderRadius: 4, pointerEvents: 'none', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(17,24,39,0.4)', fontFamily: 'var(--font-sans)', padding: 4, textAlign: 'center' }}>
              {v.visualType || 'visual'}
            </span>
          </div>
        ))}

        {/* New visuals — draggable / resizable placement boxes with live preview */}
        {placements.map((p) => {
          const spec = previewSpecs[p.id]
          return (
            <div key={p.id}
              onPointerDown={(e) => onPointerDown(e, p.id, 'move')}
              style={{
                position: 'absolute', left: p.x * scale, top: p.y * scale,
                width: p.width * scale, height: p.height * scale,
                border: '2px solid var(--accent)', borderRadius: 6, overflow: 'hidden',
                background: bg, cursor: 'move', boxShadow: '0 4px 14px rgba(91,91,214,0.25)',
              }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {spec
                  ? <AppSpecRenderer spec={spec} availableMeasures={measures} canvasWidth={Math.max(80, p.width * scale)} theme={canvasTheme} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--text-muted)' }}>{labelFor(p.id)}</div>}
              </div>
              {/* NEW label chip — always identifies the placement even if preview is empty */}
              <span style={{
                position: 'absolute', top: 4, left: 4, pointerEvents: 'none',
                background: 'var(--accent)', color: 'var(--accent-contrast)',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 'var(--radius-pill)', maxWidth: '90%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                NEW · {labelFor(p.id)}
              </span>
              {/* resize handle */}
              <div onPointerDown={(e) => onPointerDown(e, p.id, 'resize')}
                style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, cursor: 'nwse-resize',
                  background: 'var(--accent)', borderRadius: '4px 0 0 0' }} />
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', marginTop: 6 }}>
        {pageWidth}×{pageHeight} · {Math.round(scale * 100)}% · drag to move, corner to resize
      </div>
    </div>
  )
}
