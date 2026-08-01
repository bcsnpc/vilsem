import React from 'react'
import { Loader2 } from './icons.js'

// Button — variant + size + optional leading/trailing icon + loading state.
export function Button({
  variant = 'secondary', size = 'md', iconLeft, iconRight, loading = false,
  fullWidth = false, className = '', children, disabled, ...rest
}) {
  const cls = [
    'sx-btn', `sx-btn--${variant}`, `sx-btn--${size}`,
    fullWidth ? 'sx-btn--full' : '', className,
  ].filter(Boolean).join(' ')
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading
        ? <Loader2 size={iconSize} className="sx-spin" style={{ animation: 'sx-spin 0.7s linear infinite' }} />
        : iconLeft}
      {children}
      {iconRight}
    </button>
  )
}

// IconButton — icon-only square control.
export function IconButton({ size = 'md', active = false, className = '', children, ...rest }) {
  const cls = [
    'sx-iconbtn', size === 'sm' ? 'sx-iconbtn--sm' : '',
    active ? 'sx-iconbtn--active' : '', className,
  ].filter(Boolean).join(' ')
  return <button className={cls} {...rest}>{children}</button>
}
