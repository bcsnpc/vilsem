import React from 'react'
import { getFilterValueKey } from '@vilsem/core/dax/rows'

export default function SlicerButtons({ slicer, values, onChange, globalFilters, theme }) {
  const dim = slicer.dimension
  const filterKey = dim?.table ? `${dim.table}[${dim.column}]` : null
  const currentVal = filterKey ? globalFilters[filterKey] : null
  const isDark = theme !== 'light'

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', overflow: 'hidden' }}>
      {['All', ...values].map(v => {
        const isAll   = v === 'All'
        const active  = isAll ? currentVal == null : getFilterValueKey(currentVal) === getFilterValueKey(v)
        return (
          <button key={isAll ? 'All' : getFilterValueKey(v)} onClick={() => onChange(slicer, isAll ? null : v)}
            style={{
              padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: active ? 700 : 400,
              border: active
                ? `1px solid ${isDark ? 'rgba(99,102,241,0.6)' : 'rgba(109,40,217,0.5)'}`
                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1'}`,
              background: active
                ? (isDark ? 'rgba(99,102,241,0.25)' : '#EDE9FE')
                : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
              color: active
                ? (isDark ? '#A5B4FC' : '#6D28D9')
                : (isDark ? 'rgba(255,255,255,0.5)' : '#64748B'),
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
            }}>{String(v)}</button>
        )
      })}
    </div>
  )
}
