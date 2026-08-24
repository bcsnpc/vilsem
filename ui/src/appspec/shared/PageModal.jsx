import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import AppSpecRenderer from '../AppSpecRenderer.jsx'

// In-app popup that shows a page's content, opened by a nav button (navTarget: 'modal').
// A web-style overlay (not a Power BI bookmark) — dims the app, renders the target page's
// visuals, Esc / click-outside / ✕ to close. Nested nav + modals work (threads the callbacks).
export default function PageModal({ spec, page, theme = 'dark', availableMeasures, onClose, onNavigatePage, onOpenModal }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!page) return null
  const isDark = theme === 'dark'
  const pageSpec = { ...spec, visuals: page.visuals || [], slicers: page.slicers || [] }
  const measures = availableMeasures || (page.visuals || []).flatMap(v => (v.data?.measures || []).map(m => ({ name: m })))

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(4,6,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: 'min(1040px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          background: isDark ? '#0b0b12' : '#FFFFFF',
          borderRadius: 14,
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
          boxShadow: '0 24px 90px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#F1F5F9' : '#1E293B' }}>{page.name || 'Details'}</span>
          <button onClick={onClose} title="Close (Esc)" style={{ background: 'transparent', border: 'none', color: isDark ? '#94A3B8' : '#64748B', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <AppSpecRenderer
            spec={pageSpec}
            availableMeasures={measures}
            canvasWidth={980}
            theme={theme}
            onNavigatePage={onNavigatePage}
            onOpenModal={onOpenModal}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
