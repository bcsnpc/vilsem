import React from 'react'

// SegmentedControl — pill group, single select. options: [{value,label}]
export function SegmentedControl({ value, onChange, options = [], className = '' }) {
  return (
    <div className={`sx-seg ${className}`} role="tablist">
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          className={`sx-seg__item ${value === opt.value ? 'sx-seg__item--active' : ''}`}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Tabs — underline style. options: [{value,label}]
export function Tabs({ value, onChange, options = [], className = '' }) {
  return (
    <div className={`sx-tabs ${className}`} role="tablist">
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          className={`sx-tab ${value === opt.value ? 'sx-tab--active' : ''}`}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
