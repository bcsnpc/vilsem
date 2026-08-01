import React, { useState } from 'react'
import { Settings, LogOut, ChevronRight, Dot, Search } from 'lucide-react'

// vilsem custom title bar — Slate Instrument.
// Frameless Electron window: the bar itself is the drag region; every
// interactive control MUST be no-drag or the OS eats the click.
//
// Props:
//   breadcrumb   [{ label, onClick? }]  trail shown next to the wordmark
//   connection   { state: 'connected'|'sp'|'expiring'|'disconnected', label }
//   onConnectionClick()   re-auth / details (stub for now)
//   onSettings()          open settings
//   onLogout()            sign out
//   accountLabel          initials / email for the avatar
export default function TitleBar({ breadcrumb = [], connection, onConnectionClick, onSettings, onLogout, accountLabel, onCommandPalette }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const conn = connection || { state: 'disconnected', label: 'Disconnected' }
  const connColor = {
    connected:    'var(--v-success)',
    sp:           'var(--v-accent)',
    expiring:     'var(--v-amber)',
    disconnected: 'var(--v-text-faint)',
  }[conn.state] || 'var(--v-text-faint)'

  return (
    <div className="titlebar-drag" style={{
      WebkitAppRegion: 'drag',
      height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--v-bg-0)', borderBottom: '1px solid var(--v-border)',
      padding: 0, userSelect: 'none', position: 'relative', zIndex: 50,
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>
        <span style={{
          width: 16, height: 16, borderRadius: 3, background: 'var(--v-accent)',
          display: 'inline-block', boxShadow: '0 0 0 1px rgba(88,174,203,.35)',
        }} />
        <span style={{ font: '600 14px var(--v-font)', letterSpacing: '.02em', color: 'var(--v-text)' }}>vilsem</span>
      </div>

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
          <ChevronRight size={13} style={{ color: 'var(--v-text-faint)', flexShrink: 0 }} />
          {breadcrumb.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={12} style={{ color: 'var(--v-text-faint)', flexShrink: 0 }} />}
              <span className={c.onClick ? 'no-drag' : ''} onClick={c.onClick}
                style={{
                  WebkitAppRegion: c.onClick ? 'no-drag' : undefined,
                  font: `${i === breadcrumb.length - 1 ? 500 : 400} 12px var(--v-font)`,
                  color: i === breadcrumb.length - 1 ? 'var(--v-text-2)' : 'var(--v-text-muted)',
                  cursor: c.onClick ? 'pointer' : 'default',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220,
                }}>
                {c.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Connection status pill */}
      <button className="no-drag" onClick={onConnectionClick}
        style={{
          WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--v-surface-2)', border: '1px solid var(--v-border)',
          borderRadius: 'var(--v-r)', padding: '3px 9px 3px 7px', cursor: 'pointer',
          font: '500 11px var(--v-font)', color: 'var(--v-text-2)',
        }}
        title="Connection details">
        <Dot size={18} style={{ color: connColor, margin: '-6px -4px -6px -6px' }} strokeWidth={4} />
        <span style={{ whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{conn.label}</span>
      </button>

      {/* Command palette trigger (⌘/Ctrl-K) */}
      {onCommandPalette && (
        <button className="no-drag" onClick={onCommandPalette} title="Command palette (Ctrl+K)"
          style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', gap: 5, background: 'var(--v-surface-2)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', padding: '3px 8px', cursor: 'pointer', color: 'var(--v-text-muted)', font: '600 10px var(--v-mono)' }}>
          <Search size={12} /> <span style={{ letterSpacing: '.03em' }}>Ctrl K</span>
        </button>
      )}

      {/* Account avatar + menu */}
      <div className="no-drag" style={{ WebkitAppRegion: 'no-drag', position: 'relative' }}>
        <button onClick={() => setMenuOpen(o => !o)}
          style={{
            width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--v-border-strong)',
            background: 'var(--v-surface-3)', color: 'var(--v-text-2)', cursor: 'pointer',
            font: '600 10px var(--v-mono)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Account">
          {(accountLabel || '·').slice(0, 2).toUpperCase()}
        </button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 61, minWidth: 180,
              background: 'var(--v-surface-2)', border: '1px solid var(--v-border-strong)',
              borderRadius: 'var(--v-r-2)', boxShadow: 'var(--v-shadow-modal)', padding: 5,
            }}>
              {accountLabel && (
                <div style={{ padding: '6px 8px 8px', font: '400 11px var(--v-mono)', color: 'var(--v-text-muted)', borderBottom: '1px solid var(--v-border)', marginBottom: 4, wordBreak: 'break-all' }}>{accountLabel}</div>
              )}
              {/* Settings lives in the left rail (single canonical place). */}
              <MenuItem icon={<LogOut size={14} />} label="Sign out" danger onClick={() => { setMenuOpen(false); onLogout?.() }} />
            </div>
          </>
        )}
      </div>

      {/* Windows-style window controls (min / max / close) — far right per mockup */}
      <div className="no-drag" style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignSelf: 'stretch', marginLeft: 4 }}>
        <WinCtl kind="min"   onClick={() => window.semantica?.minimize()} />
        <WinCtl kind="max"   onClick={() => window.semantica?.maximize()} />
        <WinCtl kind="close" onClick={() => window.semantica?.close()} />
      </div>
    </div>
  )
}

function WinCtl({ kind, onClick }) {
  const [hover, setHover] = useState(false)
  const isClose = kind === 'close'
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={kind}
      style={{
        width: 46, height: '100%', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? (isClose ? '#C42B1C' : 'var(--v-surface-4)') : 'transparent',
        color: hover && isClose ? '#fff' : 'var(--v-text-muted)', transition: 'background .1s',
      }}>
      <WinGlyph kind={kind} />
    </button>
  )
}

function WinGlyph({ kind }) {
  const s = { width: 10, height: 10, stroke: 'currentColor', strokeWidth: 1, fill: 'none', shapeRendering: 'crispEdges' }
  if (kind === 'min') return <svg viewBox="0 0 10 10" style={s}><line x1="0" y1="5.5" x2="10" y2="5.5" /></svg>
  if (kind === 'max') return <svg viewBox="0 0 10 10" style={s}><rect x="0.5" y="0.5" width="9" height="9" /></svg>
  return <svg viewBox="0 0 10 10" style={s}><line x1="0.5" y1="0.5" x2="9.5" y2="9.5" /><line x1="9.5" y1="0.5" x2="0.5" y2="9.5" /></svg>
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--v-surface-4)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
        background: 'transparent', border: 'none', borderRadius: 'var(--v-r)', padding: '7px 8px',
        cursor: 'pointer', font: '500 12px var(--v-font)',
        color: danger ? 'var(--v-danger)' : 'var(--v-text-2)',
      }}>
      {icon}{label}
    </button>
  )
}
