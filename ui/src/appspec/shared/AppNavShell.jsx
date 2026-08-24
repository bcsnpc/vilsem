import React from 'react'

// Persistent navigation shell for multi-page apps — a sidebar (or topbar) that lists the
// pages and swaps the body via currentPageId, mirroring a real web app (see the semanticui
// reference). Single-page specs (or nav.position === 'none') render the body with no shell,
// so nothing changes for them. Pure presentational — the caller owns currentPageId.
export const NAV_WIDTH = 216
export const NAV_HEIGHT = 48

export default function AppNavShell({ pages = [], currentPageId, onNavigate, theme = 'dark', title, nav = {}, children }) {
  const position = nav.position || 'sidebar'
  // Hidden pages (used only as popups) don't appear in the nav, but stay in the spec so a
  // button can still open them as a modal.
  const navPages = pages.filter(p => !p.hidden)
  if (navPages.length < 2 || position === 'none') return children

  const isDark = theme === 'dark'
  const accent = nav.accent || '#5EEAD4'
  const shellBg = nav.background || (isDark ? '#13131e' : '#F8FAFC')
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'
  const muted = isDark ? '#8a8a9e' : '#64748B'
  const horizontal = position === 'topbar'

  const item = (p) => {
    const active = p.id === currentPageId
    return (
      <button
        key={p.id}
        onClick={() => onNavigate?.(p.id)}
        title={p.name || 'Page'}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: horizontal ? '7px 14px' : '10px 18px',
          background: active ? `${accent}14` : 'transparent',
          color: active ? accent : muted,
          border: 'none',
          borderRight: !horizontal ? `2px solid ${active ? accent : 'transparent'}` : 'none',
          borderBottom: horizontal ? `2px solid ${active ? accent : 'transparent'}` : 'none',
          cursor: 'pointer', font: `${active ? 600 : 500} 13px inherit`,
          width: horizontal ? 'auto' : '100%', textAlign: 'left', whiteSpace: 'nowrap',
          transition: 'color .12s, background .12s',
        }}
        onMouseEnter={e => { if (p.id !== currentPageId) e.currentTarget.style.color = isDark ? '#c9c9d6' : '#334155' }}
        onMouseLeave={e => { if (p.id !== currentPageId) e.currentTarget.style.color = muted }}
      >
        <span style={{ opacity: 0.7, fontSize: 12 }}>{active ? '●' : '○'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || 'Page'}</span>
      </button>
    )
  }

  // Pills — a modern top nav where the active page is a filled rounded pill (SaaS style).
  if (position === 'pills') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: NAV_HEIGHT, flexShrink: 0, padding: '0 16px', background: shellBg, borderBottom: `1px solid ${border}`, overflowX: 'auto' }}>
          {title && <div style={{ fontWeight: 700, fontSize: 14, color: accent, marginRight: 12, whiteSpace: 'nowrap' }}>{title}</div>}
          {navPages.map(p => {
            const active = p.id === currentPageId
            return (
              <button key={p.id} onClick={() => onNavigate?.(p.id)} title={p.name || 'Page'}
                style={{ padding: '6px 15px', borderRadius: 20, border: 'none', cursor: 'pointer', font: `${active ? 600 : 500} 12px inherit`, whiteSpace: 'nowrap', background: active ? accent : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'), color: active ? '#0b0b12' : muted, transition: 'background .12s, color .12s' }}>
                {p.name || 'Page'}
              </button>
            )
          })}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
      </div>
    )
  }

  if (horizontal) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: NAV_HEIGHT, flexShrink: 0, padding: '0 12px', background: shellBg, borderBottom: `1px solid ${border}`, overflowX: 'auto' }}>
          {title && <div style={{ fontWeight: 700, fontSize: 14, color: accent, marginRight: 14, whiteSpace: 'nowrap' }}>{title}</div>}
          {navPages.map(item)}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ width: NAV_WIDTH, flexShrink: 0, background: shellBg, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', paddingBottom: 12, overflow: 'hidden' }}>
        {title && (
          <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${border}`, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: accent, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto' }}>{navPages.map(item)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>{children}</div>
    </div>
  )
}
