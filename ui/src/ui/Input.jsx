import React from 'react'

export function Input({ className = '', ...rest }) {
  return <input className={`sx-input ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`sx-textarea ${className}`} {...rest} />
}

export function Select({ className = '', children, ...rest }) {
  return <select className={`sx-select ${className}`} {...rest}>{children}</select>
}

// Labeled field wrapper.
export function Field({ label, children, className = '' }) {
  return (
    <label className={`sx-field ${className}`}>
      {label && <span className="sx-field__label">{label}</span>}
      {children}
    </label>
  )
}

// Toggle / switch.
export function Toggle({ checked, onChange, ...rest }) {
  return (
    <span className="sx-switch">
      <input type="checkbox" checked={!!checked} onChange={e => onChange?.(e.target.checked)} {...rest} />
      <span className="sx-switch__track" />
      <span className="sx-switch__thumb" />
    </span>
  )
}

export function Range({ className = '', ...rest }) {
  return <input type="range" className={`sx-range ${className}`} {...rest} />
}
