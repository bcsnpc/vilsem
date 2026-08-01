// Pure style helpers for per-card animation + hover effects. Consumed by the
// section render paths in AppSpecRenderer.jsx. Verbatim extract from
// pre-Phase-1 inline definitions.

/**
 * @param {import('./chart-config').ChartConfig} [config]
 * @returns {object} style object with `animation` string (or empty)
 */
export function getCardAnimation(config) {
  if (config?.animationEnabled === false) return {}
  const preset = config?.animationPreset || 'none'
  if (preset === 'none') return {}
  const durations = { fast: '0.3s', medium: '0.5s', slow: '0.8s' }
  const delays    = { none: '0s', short: '0.1s', medium: '0.3s' }
  const dur = durations[config?.animationDuration] || '0.5s'
  const del = delays[config?.animationDelay] || '0s'
  const names = { fadeUp: 'ag-fadeUp', fadeIn: 'ag-fadeIn', scaleIn: 'ag-scaleIn' }
  const name = names[preset]
  if (!name) return {}
  return { animation: `${name} ${dur} ${del} both ease-out` }
}

/**
 * @param {import('./chart-config').ChartConfig} [config]
 * @returns {object} { onMouseEnter, onMouseLeave } or empty
 */
export function getHoverHandlers(config) {
  const effect = config?.hoverEffect
  if (!effect || effect === 'off') return {}
  const intensity = { subtle: { scale: 1.01, shadow: 6 }, medium: { scale: 1.02, shadow: 12 } }
  const { scale, shadow } = intensity[effect] || intensity.subtle
  return {
    onMouseEnter: (e) => { e.currentTarget.style.transform = `scale(${scale})`; e.currentTarget.style.boxShadow = `0 ${shadow}px ${shadow * 3}px rgba(0,0,0,0.25)` },
    onMouseLeave: (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' },
  }
}
