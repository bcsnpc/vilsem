import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search } from 'lucide-react'
import './tokens.css'

// ⌘/Ctrl-K command palette. Fed a flat list of commands from App; filters by
// label/hint/group, keyboard-navigable, Slate-styled. Purely a launcher — each
// command's run() does the work.
export default function CommandPalette({ open, onClose, commands = [] }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); const t = setTimeout(() => inputRef.current?.focus(), 0); return () => clearTimeout(t) }
  }, [open])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return commands
    return commands.filter(c => `${c.label} ${c.hint || ''} ${c.group || ''}`.toLowerCase().includes(query))
  }, [q, commands])

  useEffect(() => { if (idx > filtered.length - 1) setIdx(0) }, [filtered.length, idx])

  if (!open) return null
  const run = (c) => { if (!c) return; onClose(); c.run?.() }
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[idx]) }
  }

  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div className="vilsem-root" onMouseDown={e => e.stopPropagation()} onKeyDown={onKey}
        style={{ width: 'min(560px, 92vw)', background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', boxShadow: 'var(--v-shadow-modal)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderBottom: '1px solid var(--v-border)' }}>
          <Search size={16} style={{ color: 'var(--v-text-faint)', flexShrink: 0 }} />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setIdx(0) }} placeholder="Type a command or search…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--v-text)', font: '400 14px var(--v-font)' }} />
          <kbd style={kbd}>Esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--v-text-faint)', font: '400 12px var(--v-font)' }}>No matching commands.</div>
          )}
          {filtered.map((c, i) => (
            <button key={c.id} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', borderRadius: 'var(--v-r)', cursor: 'pointer', background: i === idx ? 'var(--v-accent-quiet)' : 'transparent' }}>
              <span style={{ color: i === idx ? 'var(--v-accent)' : 'var(--v-text-muted)', display: 'flex', flexShrink: 0, width: 16 }}>{c.icon}</span>
              <span style={{ flex: 1, font: '500 13px var(--v-font)', color: 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
              {c.group && <span style={{ font: '400 10px var(--v-mono)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--v-text-faint)' }}>{c.group}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const kbd = { font: '600 10px var(--v-mono)', color: 'var(--v-text-faint)', background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 3, padding: '2px 5px', flexShrink: 0 }
