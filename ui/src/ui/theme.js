// App-chrome theme controller. Drives the `data-theme` attribute on <html>,
// which flips the CSS variables in tokens.css. Independent from the dashboard
// canvas theme (appspec/getThemeTokens.ts) — this is the app skin only.

import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'semantica.chromeTheme'

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

export function setTheme(mode) {
  const theme = mode === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  // Notify any useTheme() subscribers in this window.
  window.dispatchEvent(new CustomEvent('semantica:themechange', { detail: theme }))
  return theme
}

// Call once at app startup (main.jsx). Defaults to light (editorial).
export function initTheme() {
  const theme = getStoredTheme() || 'light'
  document.documentElement.dataset.theme = theme
  return theme
}

// React hook: [theme, toggle, set]
export function useTheme() {
  const [theme, setLocal] = useState(
    () => document.documentElement.dataset.theme || getStoredTheme() || 'light'
  )

  useEffect(() => {
    const onChange = (e) => setLocal(e.detail)
    window.addEventListener('semantica:themechange', onChange)
    return () => window.removeEventListener('semantica:themechange', onChange)
  }, [])

  const set = useCallback((mode) => setLocal(setTheme(mode)), [])
  const toggle = useCallback(() => set(theme === 'dark' ? 'light' : 'dark'), [theme, set])

  return [theme, toggle, set]
}

// Read a resolved token value as a literal string — for the few JS APIs
// (inline SVG, canvas) that can't consume CSS vars directly.
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
