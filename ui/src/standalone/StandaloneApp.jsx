import React, { useState, useEffect } from 'react'
import AppSpecRenderer from '../appspec/AppSpecRenderer.jsx'
import AppNavShell from '../appspec/shared/AppNavShell.jsx'
import PageModal from '../appspec/shared/PageModal.jsx'
import 'react-grid-layout/css/styles.css'

// ── Shared standalone shell ───────────────────────────────────────────────────
// The exact dashboard chrome used by BOTH runtimes:
//   • Web export (index.jsx)   — fetches /app-spec.json, window.semantica = HTTP.
//   • Fabric app (fabric-embed)— receives `initialSpec`, host sets window.semantica.
// Data access is entirely through window.semantica, so the renderer (drill,
// interactions, every visual) behaves identically regardless of transport.

export function getPages(spec) {
  if (!spec) return []
  if (spec.pages?.length) return spec.pages
  return [{ id: 'page_1', name: spec.title || 'Page 1', visuals: spec.visuals || [], slicers: spec.slicers || [] }]
}

export function getCurrentPage(spec, pageId) {
  const pages = getPages(spec)
  return pages.find(p => p.id === pageId) || pages[0] || null
}

// initialSpec: when provided (Fabric embed), the shell renders it directly and
// skips the HTTP fetch. When null (web export), it fetches from `specUrl`.
export default function StandaloneApp({ initialSpec = null, specUrl = '/app-spec.json' }) {
  const [spec,          setSpec]          = useState(initialSpec)
  const [error,         setError]         = useState(null)
  const [theme,         setTheme]         = useState(initialSpec?.theme?.mode === 'light' ? 'light' : 'dark')
  const [currentPageId, setCurrentPageId] = useState(initialSpec ? (getPages(initialSpec)[0]?.id || null) : null)
  const [modalPageId,   setModalPageId]   = useState(null)   // Phase 8b in-app popup

  useEffect(() => {
    if (initialSpec) return // spec supplied by host — no fetch
    fetch(specUrl)
      .then(r => { if (!r.ok) throw new Error('Failed to load app spec'); return r.json() })
      .then(s => {
        const hasContent = s?.visuals?.length || s?.pages?.some(p => p?.visuals?.length)
        if (!hasContent) throw new Error('Empty spec')
        setSpec(s)
        setTheme(s.theme?.mode === 'light' ? 'light' : 'dark')
        setCurrentPageId(getPages(s)[0]?.id || null)
      })
      .catch(e => setError(e.message))
  }, [initialSpec, specUrl])

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0b12', color: '#F87171', gap: 12 }}>
        <div style={{ fontSize: 48, opacity: 0.2 }}>✦</div>
        <div style={{ fontSize: 14 }}>{error}</div>
        <div style={{ fontSize: 11, color: '#64748B' }}>Check server is running and app-spec.json exists</div>
      </div>
    )
  }

  if (!spec) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0b12', gap: 16 }}>
        <div style={{ fontSize: 48, color: '#818CF8', animation: 'spin 2s linear infinite' }}>✦</div>
        <div style={{ color: '#818CF8', fontSize: 14, fontWeight: 600 }}>Loading...</div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  const isDark = theme === 'dark'
  const pages  = getPages(spec)
  const activePage = getCurrentPage(spec, currentPageId)
  const activePageSpec = activePage
    ? { ...spec, visuals: activePage.visuals || [], slicers: activePage.slicers || [] }
    : spec

  const availableMeasures = (activePageSpec?.visuals || []).flatMap(v => (v.data?.measures || []).map(m => ({ name: m })))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: isDark ? '#0b0b12' : '#F1F5F9', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <style>{`
        *::-webkit-scrollbar{width:6px;height:6px}
        *::-webkit-scrollbar-track{background:transparent}
        *::-webkit-scrollbar-thumb{background:${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};border-radius:3px}
        *::-webkit-scrollbar-thumb:hover{background:${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}}
        *{scrollbar-width:thin;scrollbar-color:${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} transparent}
      `}</style>

      {/* Topbar */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        background: isDark ? '#0D1117' : '#FFFFFF',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
      }}>
        <span style={{ color: '#818CF8', fontSize: 17, fontWeight: 700 }}>✦</span>
        <span style={{ color: isDark ? 'white' : '#1E293B', fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {spec.title || 'App'}
        </span>
        <span style={{ background: 'rgba(20,184,166,0.2)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 20, fontSize: 9, padding: '2px 8px', fontWeight: 700 }}>
          {initialSpec ? 'FABRIC APP' : 'WEB APP'}
        </span>
        <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{ background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0'}`, color: isDark ? '#94A3B8' : '#64748B', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
          {isDark ? '☀' : '☾'}
        </button>
      </div>

      {/* Body: nav shell (sidebar/topbar) for multi-page apps + dashboard. Single-page
          specs render the dashboard directly (AppNavShell passes children through). */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <AppNavShell pages={pages} currentPageId={currentPageId} onNavigate={setCurrentPageId} theme={theme} nav={spec.nav}>
          {(() => {
            const presets = { '16:9':[1280,720], '16:10':[1280,800], '4:3':[1024,768], 'tall':[1280,1920], 'square':[1024,1024], 'auto':[1280,null], 'custom':[spec.layout?.pageWidth || 1280, spec.layout?.pageHeight || 720] }
            const presetKey = spec.layout?.pagePreset || '16:9'
            const [pw, ph]  = presets[presetKey] || [1280, 720]
            const pageW = Number(spec.layout?.pageWidth) || pw || 1280
            const pageH = Number(spec.layout?.pageHeight) || ph
            return (
              <div style={{ height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '16px 24px' }}>
                <div style={{ width: '100%', maxWidth: pageW, minHeight: pageH || 'auto' }}>
                  <AppSpecRenderer
                    spec={activePageSpec}
                    availableMeasures={availableMeasures}
                    canvasWidth={pageW - 40}
                    theme={theme}
                    onNavigatePage={setCurrentPageId}
                    onOpenModal={setModalPageId}
                  />
                </div>
              </div>
            )
          })()}
        </AppNavShell>
      </div>
      <PageModal
        spec={spec}
        page={pages.find(p => p.id === modalPageId)}
        theme={theme}
        onClose={() => setModalPageId(null)}
        onNavigatePage={(id) => { setCurrentPageId(id); setModalPageId(null) }}
        onOpenModal={setModalPageId}
      />
    </div>
  )
}
