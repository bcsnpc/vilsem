import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from './icons.js'
import { IconButton } from './Button.jsx'

// Modal — portal + scrim + ESC/backdrop close. `footer` is an optional node.
export function Modal({ open = true, title, onClose, footer, size = 'md', children, width }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const maxWidth = width || (size === 'lg' ? 640 : size === 'sm' ? 380 : 460)

  return createPortal(
    <div className="sx-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="sx-modal vilsem-root" style={{ maxWidth }} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className="sx-modal__header">
            <span className="sx-modal__title">{title}</span>
            {onClose && <IconButton onClick={onClose} aria-label="Close"><X size={18} /></IconButton>}
          </div>
        )}
        <div className="sx-modal__body">{children}</div>
        {footer && <div className="sx-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
