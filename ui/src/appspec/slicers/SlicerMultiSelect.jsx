import React, { useState, useRef, useEffect } from 'react'
import { getFilterValueKey } from '../shared/row-normalize.js'

export default function SlicerMultiSelect({ slicer, values, onChange, globalFilters, theme }) {
  const dim = slicer.dimension
  const filterKey = dim?.table ? `${dim.table}[${dim.column}]` : null
  const selected = filterKey ? (globalFilters[filterKey]?._multi || []) : []
  const isDark = theme !== 'light'

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const bg       = isDark ? '#0F172A' : '#FFFFFF'
  const border   = isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'
  const text     = isDark ? '#E2E8F0' : '#1E293B'
  const muted    = isDark ? '#64748B' : '#94A3B8'
  const hoverBg  = isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9'
  const activeBg = isDark ? 'rgba(99,102,241,0.25)' : '#EDE9FE'
  const activeC  = isDark ? '#A5B4FC' : '#6D28D9'

  const filtered = values.filter(v => !search || String(v).toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (v) => {
    const key = getFilterValueKey(v)
    const next = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]
    onChange(slicer, next.length ? { _multi: next, _values: values.filter(vi => next.includes(getFilterValueKey(vi))) } : null)
  }
  const clearAll = () => onChange(slicer, null)

  const label = selected.length === 0 ? 'All'
    : selected.length === 1 ? String(values.find(v => getFilterValueKey(v) === selected[0]) ?? selected[0])
    : `${selected.length} selected`

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, padding: '5px 10px',
          background: bg, border: `1px solid ${open ? activeC : border}`,
          borderRadius: 6, color: selected.length ? text : muted,
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          outline: 'none', boxShadow: open ? `0 0 0 2px ${activeC}33` : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected.length > 0 && (
            <span onClick={(e) => { e.stopPropagation(); clearAll() }}
              style={{ cursor: 'pointer', color: muted, fontSize: 10, padding: '1px 3px', borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }}>✕</span>
          )}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M1 1L5 5L9 1" stroke={muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
          background: bg, border: `1px solid ${border}`,
          borderRadius: 8, boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          {values.length > 6 && (
            <div style={{ padding: '6px 8px', borderBottom: `1px solid ${border}` }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                style={{ width: '100%', boxSizing: 'border-box', background: isDark ? '#1E293B' : '#F8FAFC',
                  border: `1px solid ${border}`, borderRadius: 5, padding: '4px 8px', fontSize: 11,
                  color: text, outline: 'none', fontFamily: 'inherit', colorScheme: isDark ? 'dark' : 'light' }} />
            </div>
          )}

          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
            <div onClick={clearAll} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12,
              color: selected.length === 0 ? activeC : muted, fontWeight: selected.length === 0 ? 600 : 400,
              background: selected.length === 0 ? activeBg : 'transparent' }}
              onMouseEnter={e => { if (selected.length) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (selected.length) e.currentTarget.style.background = 'transparent' }}>
              All
            </div>
            {filtered.map(v => {
              const key = getFilterValueKey(v)
              const checked = selected.includes(key)
              return (
                <div key={key} onClick={() => toggle(v)} style={{
                  padding: '6px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                  color: checked ? activeC : text, background: checked ? activeBg : 'transparent',
                }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = hoverBg }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    border: `1.5px solid ${checked ? activeC : border}`,
                    background: checked ? activeC : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
                </div>
              )
            })}
          </div>

          {selected.length > 0 && (
            <div style={{ padding: '6px 8px', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={clearAll} style={{ fontSize: 11, color: muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
