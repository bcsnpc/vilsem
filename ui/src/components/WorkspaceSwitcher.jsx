import React, { useState, useEffect, useRef } from 'react'

export default function WorkspaceSwitcher({ connectionInfo, onSwitch, onSetupNew, onLogoutAll }) {
  const [open,       setOpen]       = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [active,     setActive]     = useState(null)
  const [busy,       setBusy]       = useState(null)
  const [switchErr,  setSwitchErr]  = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function loadWorkspaces() {
    if (!window.semantica) return
    const res = await window.semantica.getSavedWorkspaces()
    setWorkspaces(res.workspaces || [])
    setActive(res.activeWorkspace)
  }

  function handleOpen() {
    loadWorkspaces()
    setOpen(v => !v)
  }

  async function handleSwitch(id) {
    if (id === active) { setOpen(false); return }
    setBusy(id); setSwitchErr('')
    const res = await window.semantica.switchWorkspace({ id })
    setBusy(null)
    if (res.success) {
      setActive(id)
      setOpen(false)
      onSwitch(res.config)
    } else {
      setSwitchErr(res.error || 'Switch failed')
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    const res = await window.semantica.deleteWorkspace({ id })
    if (res.success) loadWorkspaces()
  }

  const datasetName   = connectionInfo?.datasetName   || '...'
  const workspaceName = connectionInfo?.workspaceName || ''

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>

      {/* Compact trigger button */}
      <button
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: connectionInfo ? '#22C55E' : '#9CA3AF',
        }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {datasetName}
        </span>
        {workspaceName && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            · {workspaceName}
          </span>
        )}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel — opens downward */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: 260, background: '#1E2433',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, overflow: 'hidden', zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '10px 14px 6px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>
            WORKSPACES
          </div>

          {switchErr && (
            <div style={{ margin: '0 10px 6px', padding: '7px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, fontSize: 11, color: '#FCA5A5' }}>
              ✗ {switchErr}
            </div>
          )}

          {workspaces.length === 0 ? (
            <div style={{ padding: '8px 14px 12px', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              No saved workspaces
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {workspaces.map(ws => {
                const isActive = ws.id === active
                const isBusy   = ws.id === busy
                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitch(ws.id)}
                    disabled={isBusy}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: isBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
                      background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => { if (!isActive && !isBusy) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#93C5FD' : 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBusy ? 'Switching…' : ws.datasetName}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ws.workspaceName}
                      </div>
                    </div>
                    {isActive && (
                      <span style={{ fontSize: 10, color: '#93C5FD', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    )}
                    {!isActive && (
                      <button
                        onClick={(e) => handleDelete(e, ws.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                        title="Remove"
                        onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = '#F87171' }}
                        onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
                      >×</button>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Add new */}
          <button
            onClick={() => { setOpen(false); onSetupNew() }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 14px',
              border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', fontFamily: 'inherit', background: 'transparent',
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'rgba(255,255,255,0.5)', fontSize: 12,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 15 }}>+</span>
            Add workspace
          </button>

          {/* Sign out from all */}
          {onLogoutAll && (
            <button
              onClick={async () => {
                setOpen(false)
                await window.semantica.logoutAll()
                onLogoutAll()
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', fontFamily: 'inherit', background: 'transparent',
                display: 'flex', alignItems: 'center', gap: 8,
                color: 'rgba(239,68,68,0.7)', fontSize: 12,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 13 }}>⏻</span>
              Sign out from all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
