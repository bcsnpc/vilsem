import React, { useState, useEffect } from 'react'
import WorkspaceSwitcher from './WorkspaceSwitcher.jsx'

const NAV = [
  { id: 'playground',     icon: '⬡',  label: 'Playground' },
  { id: 'visual-builder', icon: '📊', label: 'Visual Builder' },
  { id: 'dashboard',      icon: '⊞',  label: 'Dashboard Builder' },
  { id: 'explorer',       icon: '🔍', label: 'Model Explorer' },
  { id: 'health',         icon: '♡',  label: 'Health' },
  { id: 'audit',          icon: '≡',  label: 'Audit Log' },
]

export default function Sidebar({ activePage, onNavigate, connectionInfo, onWorkspaceSwitch, onSetupNew, sessionExpired, onReauth }) {
  const [aiConfigured, setAiConfigured] = useState(false)

  useEffect(() => {
    if (!window.semantica?.getAiStatus) return
    window.semantica.getAiStatus().then(s => setAiConfigured(!!s?.anyConfigured)).catch(() => {})
  }, [])

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      height: '100vh',
      background: 'var(--navy)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>

      {/* ── Titlebar / logo ── */}
      <div className="titlebar-drag" style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Bar-chart icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="1" y="10" width="4" height="8" rx="1" fill="white" opacity="0.9"/>
            <rect x="8" y="5"  width="4" height="13" rx="1" fill="white"/>
            <rect x="15" y="2" width="4" height="16" rx="1" fill="white" opacity="0.7"/>
          </svg>
          <span style={{ color: 'white', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
            vilsem
          </span>
          <span style={{
            background: 'var(--blue)',
            color: 'white',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 999,
            letterSpacing: '0.04em',
          }}>
            BETA
          </span>
        </div>

        {/* Window controls — top right, no-drag zone */}
        <div className="no-drag" style={{
          position: 'absolute',
          top: 14,
          right: 14,
          display: 'flex',
          gap: 6,
        }}>
          {[
            { id: 'minimize', color: '#FEC006', title: '−', action: () => window.semantica?.minimize() },
            { id: 'maximize', color: '#33C748', title: '+', action: () => window.semantica?.maximize() },
            { id: 'close',    color: '#FF5F57', title: '×', action: () => window.semantica?.close()    },
          ].map(btn => (
            <button key={btn.id} title={btn.title} onClick={btn.action} style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: btn.color,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 8,
              color: 'transparent',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.target.style.opacity = '0.8'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            />
          ))}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 12px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: active ? 'white' : 'rgba(255,255,255,0.6)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.12s ease',
                marginBottom: 2,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'visual-builder' && aiConfigured && (
                <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.8 }}>✨</span>
              )}
              {active && (
                <span style={{
                  marginLeft: 'auto',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'white',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Session expired badge ── */}
      {sessionExpired && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(251,191,36,0.12)' }}>
          <div style={{ fontSize: 11, color: '#FCD34D', fontWeight: 600, marginBottom: 6 }}>
            ● Session expired — using cached data
          </div>
          <button
            onClick={onReauth}
            style={{ width: '100%', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', color: '#FCD34D', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Re-authenticate
          </button>
        </div>
      )}

      {/* ── Workspace switcher ── */}
      <WorkspaceSwitcher
        connectionInfo={connectionInfo}
        onSwitch={onWorkspaceSwitch}
        onSetupNew={onSetupNew}
      />
    </div>
  )
}
