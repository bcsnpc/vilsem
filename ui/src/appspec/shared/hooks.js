import { useState, useEffect, useRef } from 'react'

// Counter-up hook — animates a numeric value from prev to target over `duration` ms.
// On first mount when target is valid, animates from 0 → target.
// On subsequent target changes, animates from previous value → target.
// Respects prefers-reduced-motion (snaps to target instantly).
export function useCountUp(target, { enabled = true, duration = 900 } = {}) {
  // Start val at 0 so first render shows 0 → target animation. The prevRef
  // tracks the last-settled value across re-renders so slicer-driven changes
  // animate from previous → new (not 0 → new each time).
  const [val, setVal] = useState(0)
  const rafRef  = useRef(null)
  const prevRef = useRef(0)
  useEffect(() => {
    if (typeof target !== 'number' || !isFinite(target)) return
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!enabled || reduceMotion) { setVal(target); prevRef.current = target; return }
    const from = prevRef.current
    if (from === target) { setVal(target); return }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(from + (target - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = target
        setVal(target)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, enabled, duration])
  return val
}
