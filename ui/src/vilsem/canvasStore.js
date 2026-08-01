import { useState, useEffect } from 'react'

// Tiny pub/sub bridge so the shell's left-rail panes (Layers, and any
// canvas-context panel) can read the active canvas without prop-drilling
// through the router. AppGenerator publishes; panes subscribe.

let state = { spec: null, selectedId: null, onSelect: null, currentPageId: null }
const subs = new Set()

export function setCanvasState(patch) {
  state = { ...state, ...patch }
  subs.forEach((fn) => fn(state))
}

export function clearCanvasState() {
  setCanvasState({ spec: null, selectedId: null, onSelect: null, currentPageId: null })
}

export function useCanvasStore() {
  const [s, setS] = useState(state)
  useEffect(() => {
    subs.add(setS)
    setS(state)
    return () => { subs.delete(setS) }
  }, [])
  return s
}
