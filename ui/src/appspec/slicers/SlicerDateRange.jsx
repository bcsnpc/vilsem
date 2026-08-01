import React, { useState, useEffect, useRef } from 'react'

function formatDate(isoValue) {
  if (!isoValue) return ''
  try {
    const [y, m, d] = isoValue.split('-')
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
  } catch { return isoValue }
}

function DateButton({ value, onChange, placeholder, isDark }) {
  const inputRef = useRef(null)

  const containerStyle = {
    position: 'relative', flex: 1, minWidth: 0,
    background: isDark ? '#1E293B' : '#F8FAFC',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#CBD5E1'}`,
    borderRadius: 6, cursor: 'pointer', height: 26,
    display: 'flex', alignItems: 'center',
  }

  // Native input is always invisible — we own display rendering via the overlay span
  const nativeStyle = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    opacity: 0, color: 'transparent', cursor: 'pointer', border: 'none', zIndex: 2,
    colorScheme: isDark ? 'dark' : 'light',
  }

  const textStyle = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
    padding: '0 22px 0 8px', fontSize: 11, pointerEvents: 'none', userSelect: 'none',
    color: value ? (isDark ? '#E2E8F0' : '#1E293B') : '#94A3B8',
    whiteSpace: 'nowrap', overflow: 'hidden', zIndex: 3,
  }

  const iconStyle = {
    position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
    fontSize: 10, pointerEvents: 'none', userSelect: 'none',
    color: isDark ? '#475569' : '#94A3B8',
  }

  const open = () => {
    try { inputRef.current?.showPicker() } catch {}
    inputRef.current?.focus()
  }

  return (
    <div style={containerStyle} onClick={open}>
      <input ref={inputRef} type="date" value={value} onChange={onChange} style={nativeStyle} />
      <span style={textStyle}>{value ? formatDate(value) : placeholder}</span>
      <span style={iconStyle}>▾</span>
    </div>
  )
}

export default function SlicerDateRange({ slicer, onChange, globalFilters, theme }) {
  const dim = slicer.dimension
  const filterKey = dim?.table ? `${dim.table}[${dim.column}]` : null
  const stored = filterKey ? globalFilters[filterKey] : null
  const [from, setFrom] = useState(stored?.from || '')
  const [to,   setTo]   = useState(stored?.to || '')
  const isDark = theme !== 'light'

  useEffect(() => {
    setFrom(stored?.from || '')
    setTo(stored?.to || '')
  }, [stored?.from, stored?.to])

  const apply = (f, t) => {
    if (!filterKey) return
    onChange(slicer, (f || t) ? { from: f || null, to: t || null } : null)
  }

  const hasValue = from || to

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
      <DateButton
        value={from}
        placeholder="From"
        isDark={isDark}
        onChange={e => { setFrom(e.target.value); apply(e.target.value, to) }}
      />
      <span style={{ fontSize: 11, color: isDark ? '#475569' : '#CBD5E1', flexShrink: 0 }}>–</span>
      <DateButton
        value={to}
        placeholder="To"
        isDark={isDark}
        onChange={e => { setTo(e.target.value); apply(from, e.target.value) }}
      />
      {hasValue && (
        <button
          onClick={() => { setFrom(''); setTo(''); apply('', '') }}
          title="Clear"
          style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
            color: isDark ? '#64748B' : '#94A3B8', fontSize: 13, padding: '0 2px',
            lineHeight: 1, fontFamily: 'inherit',
          }}
        >✕</button>
      )}
    </div>
  )
}
