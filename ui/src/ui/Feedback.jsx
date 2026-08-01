import React from 'react'

export function Spinner({ size = 18, className = '', style }) {
  return <span className={`sx-spinner ${className}`} style={{ width: size, height: size, ...style }} />
}

export function Skeleton({ width = '100%', height = 12, radius, style, className = '' }) {
  return <span className={`sx-skeleton ${className}`} style={{ display: 'block', width, height, borderRadius: radius, ...style }} />
}

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="sx-empty">
      {icon && <span className="sx-empty__icon">{icon}</span>}
      {title && <div className="sx-empty__title">{title}</div>}
      {subtitle && <div className="sx-empty__sub">{subtitle}</div>}
      {action}
    </div>
  )
}

export function ProgressBar({ value = 0, className = '' }) {
  return (
    <div className={`sx-progress ${className}`}>
      <div className="sx-progress__bar" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Badge({ variant, className = '', children }) {
  return <span className={`sx-badge ${variant ? `sx-badge--${variant}` : ''} ${className}`}>{children}</span>
}

export function Chip({ active = false, className = '', children, ...rest }) {
  return <button className={`sx-chip ${active ? 'sx-chip--active' : ''} ${className}`} {...rest}>{children}</button>
}

export function StatusDot({ tone, color, className = '', style }) {
  return <span className={`sx-dot ${tone ? `sx-dot--${tone}` : ''} ${className}`} style={color ? { background: color, ...style } : style} />
}
