import React, { useState } from 'react'
import './tokens.css'
import TitleBar from './TitleBar.jsx'
import LeftRail from './LeftRail.jsx'
import PanelFlyout from './Panels.jsx'

// vilsem app shell — Slate Instrument frame that WRAPS the existing screens.
// Phase 1: additive only. The routed screen renders in <main> unchanged; the
// shell adds the title bar (+ rail when in-session). Nothing is deleted; screen
// chrome is reconciled in later phases.
//
// Props:
//   breadcrumb, connection, accountLabel  → TitleBar
//   showRail (bool)  → hide rail on auth/full-bleed screens
//   onSettings, onLogout, onConnectionClick
//   children  → the routed screen
export default function Shell({
  breadcrumb, connection, accountLabel, showRail = true,
  onSettings, onLogout, onConnectionClick, onCommandPalette, children,
}) {
  const [toast, setToast] = useState(null)
  const [activePanel, setActivePanel] = useState(null)  // 'fields'|'layers'|'data'|null
  const stub = (feature) => {
    setToast(feature)
    window.clearTimeout(stub._t)
    stub._t = window.setTimeout(() => setToast(null), 2400)
  }

  return (
    <div className="vilsem-root" style={{
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--v-bg-0)', color: 'var(--v-text)', fontFamily: 'var(--v-font)',
    }}>
      <TitleBar
        breadcrumb={breadcrumb}
        connection={connection}
        accountLabel={accountLabel}
        onSettings={onSettings}
        onLogout={onLogout}
        onConnectionClick={onConnectionClick || (() => stub('Connection details'))}
        onCommandPalette={onCommandPalette}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {showRail && (
          <LeftRail
            active={activePanel}
            onSelect={(k) => setActivePanel(p => (p === k ? null : k))}
            onSettings={onSettings}
            stub={stub}
          />
        )}
        {showRail && activePanel && (
          <PanelFlyout panel={activePanel} connection={connection} onClose={() => setActivePanel(null)} />
        )}
        <main style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'auto' }}>
          {children}
        </main>
      </div>

      {/* Slate stub toast (top-right) — for controls wired in later phases */}
      {toast && (
        <div style={{
          position: 'fixed', top: 50, right: 16, zIndex: 12000,
          background: 'var(--v-surface-2)', border: '1px solid var(--v-border-strong)',
          borderLeft: '2px solid var(--v-accent)', borderRadius: 'var(--v-r-2)',
          boxShadow: 'var(--v-shadow-modal)', padding: '9px 13px',
          font: '500 12px var(--v-font)', color: 'var(--v-text-2)', pointerEvents: 'none',
        }}>
          <span style={{ color: 'var(--v-text)' }}>{toast}</span>
          <span style={{ color: 'var(--v-text-muted)' }}> — coming in v1.1</span>
        </div>
      )}
    </div>
  )
}
