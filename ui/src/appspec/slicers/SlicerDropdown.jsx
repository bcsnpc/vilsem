import React, { useState, useRef, useEffect } from 'react'
import { getFilterValueKey } from '@vilsem/core/dax/rows'

export default function SlicerDropdown({ slicer, values, onChange, globalFilters, theme }) {
  const dim = slicer.dimension
  const filterKey = dim?.table ? `${dim.table}[${dim.column}]` : null
  const currentVal = filterKey ? getFilterValueKey(globalFilters[filterKey]) : ''
  const isDark = theme !== 'light'

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const bg        = isDark ? '#0F172A' : '#FFFFFF'
  const border    = isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'
  const text      = isDark ? '#E2E8F0' : '#1E293B'
  const muted     = isDark ? '#64748B' : '#94A3B8'
  const hoverBg   = isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9'
  const activeBg  = isDark ? 'rgba(99,102,241,0.25)' : '#EDE9FE'
  const activeClr = isDark ? '#A5B4FC' : '#6D28D9'

  const filtered = values.filter(v => !search || String(v).toLowerCase().includes(search.toLowerCase()))
  const displayLabel = currentVal
    ? values.find(v => getFilterValueKey(v) === currentVal) ?? currentVal
    : 'All'

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (v) => {
    onChange(slicer, v ?? null)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, padding: '5px 10px',
          background: bg, border: `1px solid ${open ? activeClr : border}`,
          borderRadius: 6, color: currentVal ? text : muted,
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          outline: 'none', transition: 'border-color 0.15s',
          boxShadow: open ? `0 0 0 2px ${activeClr}33` : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {String(displayLabel)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {currentVal && (
            <span
              onClick={(e) => { e.stopPropagation(); select(null) }}
              style={{ cursor: 'pointer', color: muted, fontSize: 10, lineHeight: 1, padding: '1px 3px', borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }}
            >✕</span>
          )}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <path d="M1 1L5 5L9 1" stroke={muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
          background: bg, border: `1px solid ${border}`,
          borderRadius: 8, boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          {/* Search input — always shown when dropdown is open */}
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${border}` }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: isDark ? '#1E293B' : '#F8FAFC',
                border: `1px solid ${border}`, borderRadius: 5,
                padding: '4px 8px', fontSize: 11, color: text,
                outline: 'none', fontFamily: 'inherit',
                colorScheme: isDark ? 'dark' : 'light',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
            {/* All option */}
            <div
              onClick={() => select(null)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                color: !currentVal ? activeClr : muted,
                fontWeight: !currentVal ? 600 : 400,
                background: !currentVal ? activeBg : 'transparent',
              }}
              onMouseEnter={e => { if (currentVal) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (currentVal) e.currentTarget.style.background = 'transparent' }}
            >
              All
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '6px 12px', fontSize: 12, color: muted, fontStyle: 'italic' }}>No results</div>
            )}

            {filtered.map(v => {
              const key = getFilterValueKey(v)
              const isActive = key === currentVal
              return (
                <div
                  key={key}
                  onClick={() => select(v)}
                  style={{
                    padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                    color: isActive ? activeClr : text,
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? activeBg : 'transparent',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = hoverBg }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {String(v)}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
