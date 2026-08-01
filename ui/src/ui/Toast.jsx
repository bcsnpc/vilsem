import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheck, AlertTriangle, Info } from './icons.js'

const ToastCtx = createContext(null)

const ICONS = {
  success: <CircleCheck size={16} />,
  error: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

// Mount once near the app root. Exposes useToast() to the whole tree.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(ts => ts.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message, opts = {}) => {
    const id = ++idRef.current
    const type = opts.type || 'info'
    const duration = opts.duration ?? 3200
    setToasts(ts => [...ts, { id, message, type }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div className="sx-toast-wrap">
          {toasts.map(t => (
            <div key={t.id} className={`sx-toast sx-toast--${t.type}`} onClick={() => dismiss(t.id)}>
              <span className="sx-toast__icon">{ICONS[t.type] || ICONS.info}</span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  )
}

// Returns toast(message, { type: 'success'|'error'|'info', duration }).
// Safe no-op if no provider is mounted.
export function useToast() {
  return useContext(ToastCtx) || (() => {})
}
