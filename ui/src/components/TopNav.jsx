import React, { useState } from 'react'
import WorkspaceSwitcher from './WorkspaceSwitcher.jsx'

const NAV = [
  { id: 'playground',     icon: '⬡',  label: 'Playground'        },
  { id: 'appgenerator',   icon: '✦',  label: 'App Generator',    badge: 'NEW' },
  { id: 'powerbi',        icon: '▦',  label: 'Power BI',         badge: 'NEW' },
  { id: 'explorer',       icon: '⊙',  label: 'Explorer'          },
  { id: 'health',         icon: '♡',  label: 'Health'            },
  { id: 'audit',          icon: '≡',  label: 'Audit'             },
]

const LABS_NAV = [
  { id: 'visual-builder', icon: '✦',  label: 'Visual Builder'    },
  { id: 'dashboard',      icon: '⊞',  label: 'Dashboard Builder' },
]

export default function TopNav({
  activePage, onNavigate, connectionInfo,
  onWorkspaceSwitch, onSetupNew, sessionExpired, onReauth, onLogoutAll,
}) {
  const [labsOpen, setLabsOpen] = useState(false)

  return (
    <div
      className="titlebar-drag"
      style={{
        height: 44,
        minHeight: 44,
        background: '#0a0a14',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Window controls — macOS style, left side */}
      <div className="no-drag" style={{ display: 'flex', gap: 6, padding: '0 14px', flexShrink: 0 }}>
        {[
          { color: '#FF5F57', title: '×', action: () => window.semantica?.close()    },
          { color: '#FEC006', title: '−', action: () => window.semantica?.minimize() },
          { color: '#33C748', title: '+', action: () => window.semantica?.maximize() },
        ].map((btn, i) => (
          <button key={i} title={btn.title} onClick={btn.action} style={{
            width: 12, height: 12, borderRadius: '50%',
            background: btn.color, border: 'none',
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }} />
        ))}
      </div>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 20, flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <rect x="1"  y="10" width="4" height="8" rx="1" fill="white" opacity="0.9" />
          <rect x="8"  y="5"  width="4" height="13" rx="1" fill="white" />
          <rect x="15" y="2"  width="4" height="16" rx="1" fill="white" opacity="0.7" />
        </svg>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>
          vilsem
        </span>
        <span style={{ background: 'var(--blue)', color: 'white', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 99, letterSpacing: '0.04em' }}>
          BETA
        </span>
      </div>

      {/* Nav items */}
      <nav className="no-drag" style={{ display: 'flex', gap: 2, flex: 1 }}>
        {NAV.map(item => {
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.11)' : 'transparent',
                color: active ? 'white' : 'rgba(255,255,255,0.5)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                fontFamily: 'inherit',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              {item.label}
              {item.badge && (
                <span style={{ background: 'rgba(99,102,241,0.25)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 20, fontSize: 8, padding: '1px 5px', fontWeight: 700, letterSpacing: '0.04em' }}>{item.badge}</span>
              )}
            </button>
          )
        })}

        {/* Labs dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setLabsOpen(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: labsOpen || LABS_NAV.some(l => l.id === activePage) ? 'rgba(255,255,255,0.11)' : 'transparent',
              color: labsOpen || LABS_NAV.some(l => l.id === activePage) ? 'white' : 'rgba(255,255,255,0.35)',
              fontSize: 12, fontWeight: 400, fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!labsOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!labsOpen) e.currentTarget.style.background = LABS_NAV.some(l => l.id === activePage) ? 'rgba(255,255,255,0.11)' : 'transparent' }}
          >
            Labs ▾
          </button>
          {labsOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setLabsOpen(false)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                background: '#1E293B', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                minWidth: 180, overflow: 'hidden',
              }}>
                {LABS_NAV.map(item => (
                  <button key={item.id}
                    onClick={() => { onNavigate(item.id); setLabsOpen(false) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', border: 'none', cursor: 'pointer',
                      background: activePage === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: activePage === item.id ? 'white' : 'rgba(255,255,255,0.65)',
                      fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = activePage === item.id ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                  >
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Right: session + workspace + window indicator */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 14, flexShrink: 0 }}>
        {sessionExpired && (
          <button onClick={onReauth} style={{
            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)',
            color: '#FCD34D', borderRadius: 5, padding: '3px 9px',
            fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ⚠ Re-auth
          </button>
        )}

        {connectionInfo?.workspaceName && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {connectionInfo.workspaceName}
          </span>
        )}

        <WorkspaceSwitcher
          connectionInfo={connectionInfo}
          onSwitch={onWorkspaceSwitch}
          onSetupNew={onSetupNew}
          onLogoutAll={onLogoutAll}
        />
      </div>
    </div>
  )
}
