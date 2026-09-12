import React, { useEffect, useId, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from './icons.js'
import { IconButton } from './Button.jsx'

// Modal — portal + scrim + ESC/backdrop close. `footer` is an optional node.
const modalStack = []
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
export function Modal({ open = true, title, onClose, footer, size = 'md', children, width }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const titleId = useId()
  // Capture before children with autoFocus commit.
  const opener = useMemo(() => open ? document.activeElement : null, [open])
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    modalStack.push(dialog)
    const targets = () => [...dialog.querySelectorAll(focusable)].filter(el => el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[hidden], [inert]') && getComputedStyle(el).visibility !== 'hidden')
    if (!dialog.contains(document.activeElement)) (targets()[0] || dialog).focus()
    const onKey = e => {
      if (modalStack.at(-1) !== dialog || e.defaultPrevented) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current?.(); return }
      if (e.key !== 'Tab') return
      const items = targets(), first = items[0], last = items.at(-1)
      if (!first) { e.preventDefault(); dialog.focus(); return }
      if (!dialog.contains(document.activeElement) || (e.shiftKey && (document.activeElement === first || document.activeElement === dialog))) {
        e.preventDefault(); (e.shiftKey ? last : first).focus()
      } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const wasTop = modalStack.at(-1) === dialog
      const index = modalStack.indexOf(dialog)
      if (index !== -1) modalStack.splice(index, 1)
      if (wasTop && opener?.isConnected && (!modalStack.length || modalStack.at(-1).contains(opener))) opener.focus()
    }
  }, [open, opener])

  if (!open) return null

  const maxWidth = width || (size === 'lg' ? 640 : size === 'sm' ? 380 : 460)

  return createPortal(
    <div className="sx-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div ref={dialogRef} tabIndex={-1} className="sx-modal vilsem-root" style={{ maxWidth }} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : 'Dialog'}>
        {(title || onClose) && (
          <div className="sx-modal__header">
            <span id={titleId} className="sx-modal__title">{title}</span>
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
