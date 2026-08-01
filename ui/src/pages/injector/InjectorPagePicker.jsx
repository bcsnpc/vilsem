import React, { useState } from 'react'
import { ChevronRight, Plus } from '../../ui/icons.js'

// S5 — "Choose a page to inject onto". Rich page cards (schematic preview + size
// + visual count) plus a "New page" card. Existing pages come from the parsed
// report definition; picking one lands in the authoring canvas.
function MiniDash() {
  return (
    <svg viewBox="0 0 160 84" width="100%" height="84" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }} aria-hidden>
      <rect x="10" y="8" width="90" height="7" rx="2" fill="var(--v-surface-4)" />
      {[10, 46, 82, 118].map((x, i) => <rect key={i} x={x} y={20} width="32" height="16" rx="2" fill="var(--v-surface-3)" />)}
      <polyline points="12,66 40,54 66,60 96,46 128,50" fill="none" stroke="var(--v-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {[[118, 60], [128, 52], [138, 56], [148, 48]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6" height={72 - y} rx="1" fill="var(--v-surface-4)" />)}
    </svg>
  )
}

export default function InjectorPagePicker({ report, pages = [], onPick, onNewPage }) {
  const [q, setQ] = useState('')
  const [newPageNote, setNewPageNote] = useState(false)
  const handleNewPage = () => { if (onNewPage) onNewPage(); else setNewPageNote(true) }
  const query = q.trim().toLowerCase()
  const filtered = query ? pages.filter(p => (p.displayName || '').toLowerCase().includes(query)) : pages

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 32px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, font: '600 11px var(--v-mono)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--v-text-faint)' }}>
        <span>Inject</span>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--v-text-muted)' }}>{report?.workspaceName || 'Workspace'}</span>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--v-text-2)' }}>{report?.name || 'Report'}</span>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--v-accent)' }}>Page</span>
      </div>

      <h2 style={{ font: '600 20px var(--v-font)', color: 'var(--v-text)', margin: '0 0 4px', letterSpacing: '-.01em' }}>Choose a page to inject onto</h2>
      <p style={{ font: '400 13px var(--v-font)', color: 'var(--v-text-muted)', margin: '0 0 18px' }}>Previews are from the report definition. Or add a whole new page owned by vilsem.</p>

      {pages.length > 5 && (
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search pages…"
          style={{ width: 260, boxSizing: 'border-box', padding: '7px 10px', marginBottom: 14, background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '400 12px var(--v-font)', outline: 'none' }} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {filtered.map(p => (
          <button key={p.dirName} onClick={() => onPick(p.dirName)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-accent-border)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)' }}
            style={{ display: 'flex', flexDirection: 'column', padding: 0, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', textAlign: 'left', transition: 'border-color .12s' }}>
            <div style={{ background: 'var(--v-bg-1)', borderBottom: '1px solid var(--v-border)', padding: '10px 12px' }}><MiniDash /></div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ font: '600 13px var(--v-font)', color: 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
              <div style={{ font: '400 11px var(--v-mono)', color: 'var(--v-text-faint)', marginTop: 3 }}>
                {(p.width || 1280)}×{(p.height || 720)} · {p.visualCount} visual{p.visualCount === 1 ? '' : 's'}
              </div>
            </div>
          </button>
        ))}

        {/* New page (owned by vilsem) */}
        <button onClick={handleNewPage}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-accent-border)'; e.currentTarget.style.color = 'var(--v-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.color = 'var(--v-text-muted)' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 150, background: 'transparent', border: '1px dashed var(--v-border)', borderRadius: 'var(--v-r-2)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v-text-muted)', transition: 'border-color .12s, color .12s' }}>
          <Plus size={22} />
          <div style={{ font: '600 13px var(--v-font)' }}>New page</div>
          <div style={{ font: '400 10px var(--v-mono)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--v-text-faint)' }}>Owned by vilsem</div>
        </button>
      </div>

      {newPageNote && (
        <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--v-amber-quiet)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', font: '400 12px var(--v-font)', color: 'var(--v-amber)' }}>
          New blank pages owned by vilsem are coming soon — pick an existing page to inject onto for now.
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 7, font: '400 12px var(--v-font)', color: 'var(--v-text-muted)' }}>
        <span aria-hidden style={{ color: 'var(--v-text-faint)' }}>ⓘ</span>
        Existing visuals on a selected page stay locked — vilsem only writes what you add.
      </div>
    </div>
  )
}
