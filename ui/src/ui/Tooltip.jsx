import React from 'react'

// Lightweight CSS-hover tooltip. For simple label affordances.
export function Tooltip({ label, children, className = '' }) {
  if (!label) return children
  return (
    <span className={`sx-tip-wrap ${className}`}>
      {children}
      <span className="sx-tip">{label}</span>
    </span>
  )
}
