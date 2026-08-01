import React, { useState, useEffect } from 'react'

/**
 * ProfilePicker — list saved Director plans + apply / save / delete.
 *
 * Used inside DirectorChat above the analyze button. User can:
 *   - "Save current plan as profile" — captures current plan + brand kit
 *     under a name. Reusable across reports.
 *   - "Load profile" — replaces the current plan with a saved one. User
 *     can refine via the chat box afterwards.
 *   - Delete profiles they no longer need.
 *
 * Profiles are global (not per-report) — a "Acme Corp Brand 2026" profile
 * applies to any report you point the restyler at.
 */
export default function ProfilePicker({ plan, brandKit, sourceReportName, onLoad }) {
  const [profiles, setProfiles] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [saveName,        setSaveName]        = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [error,    setError]    = useState('')

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true); setError('')
    try {
      const res = await window.semantica?.restyler?.profileList?.()
      setProfiles(Array.isArray(res?.profiles) ? res.profiles : [])
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleSave() {
    if (!saveName.trim() || !plan) return
    setError('')
    try {
      const res = await window.semantica?.restyler?.profileSave?.({
        name: saveName.trim(),
        description: saveDescription.trim(),
        plan,
        brandKit,
        sourceReportName,
      })
      if (!res?.success) throw new Error(res?.message || 'Save failed')
      setShowSave(false); setSaveName(''); setSaveDescription('')
      refresh()
    } catch (err) { setError(err.message) }
  }

  async function handleLoad(profile) {
    try {
      const res = await window.semantica?.restyler?.profileLoad?.({ id: profile.id })
      if (!res?.success || !res.profile?.plan) throw new Error(res?.message || 'Load failed')
      onLoad?.(res.profile.plan, res.profile.brandKit)
    } catch (err) { setError(err.message) }
  }

  async function handleDelete(profile) {
    if (!confirm(`Delete profile "${profile.name}"?`)) return
    try {
      await window.semantica?.restyler?.profileDelete?.({ id: profile.id })
      refresh()
    } catch (err) { setError(err.message) }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#A78BFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Saved profiles ({profiles.length})
        </div>
        <div style={{ flex: 1 }} />
        {plan && (
          <button onClick={() => setShowSave(!showSave)}
            style={{
              background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
              color: '#A78BFA', borderRadius: 6, padding: '4px 10px',
              fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {showSave ? '✕ Cancel' : '+ Save current'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 10, color: '#F87171', padding: 8, background: 'rgba(248,113,113,0.05)', borderRadius: 4, marginBottom: 8 }}>
          ⚠ {error}
        </div>
      )}

      {/* Save form */}
      {showSave && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <input value={saveName} onChange={e => setSaveName(e.target.value)}
            placeholder="Profile name (e.g. 'Acme Corp 2026')"
            style={{ ...inputStyle, width: '100%', marginBottom: 6 }} />
          <input value={saveDescription} onChange={e => setSaveDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
          <button onClick={handleSave} disabled={!saveName.trim()}
            style={{
              background: saveName.trim() ? 'linear-gradient(135deg, #14B8A6, #0EA5A4)' : 'rgba(255,255,255,0.04)',
              border: 'none', color: saveName.trim() ? 'white' : '#475569',
              borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600,
              cursor: saveName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>
            ✦ Save profile
          </button>
        </div>
      )}

      {/* Profile list */}
      {loading ? (
        <div style={{ fontSize: 11, color: '#64748B', padding: 8 }}>Loading…</div>
      ) : profiles.length === 0 ? (
        <div style={{ fontSize: 11, color: '#64748B', padding: 8, fontStyle: 'italic' }}>
          No saved profiles yet. Run the Director, refine to your liking, then save it.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {profiles.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                  {p.ruleCount} rules · {p.archetype || 'unknown'} archetype
                  {p.sourceReportName && ` · from "${p.sourceReportName}"`}
                </div>
                {p.description && (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, fontStyle: 'italic' }}>
                    {p.description}
                  </div>
                )}
              </div>
              <button onClick={() => handleLoad(p)}
                style={{
                  background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                  color: '#A78BFA', borderRadius: 5, padding: '4px 10px',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ↑ Load
              </button>
              <button onClick={() => handleDelete(p)}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#475569', fontSize: 14, cursor: 'pointer', padding: '0 4px',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F87171' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#475569' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#E2E8F0',
  padding: '6px 10px', fontSize: 11,
  borderRadius: 5, outline: 'none', fontFamily: 'inherit',
}
