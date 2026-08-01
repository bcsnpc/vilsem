import React from 'react'

export function Panel({ className = '', children, ...rest }) {
  return <div className={`sx-panel ${className}`} {...rest}>{children}</div>
}

export function Card({ hover = false, className = '', children, ...rest }) {
  return (
    <div className={`sx-card ${hover ? 'sx-card--hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}
