// Bridge between the in-canvas rich text editor (CompactTextBox) and the inspector's
// formatting controls, so formatting lives in the inspector (Style tab) instead of a
// floating toolbar over the text. The inspector calls apply* / insertTextToken; the editor
// registers its element + keeps the last selection range saved so commands hit the right
// text even though the editable loses focus when an inspector control is clicked.

// Subtle chip that inherits the surrounding formatting (see CompactTextBox).
const TOKEN_STYLE = 'display:inline-block;padding:0 3px;border-radius:4px;background:rgba(94,234,212,0.14)'

let state = { editing: false, el: null, range: null, measures: [] }
const listeners = new Set()
function emit() { for (const l of listeners) l(state) }

export function subscribeTextEdit(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn) }
export function getTextEditState() { return state }

export function setTextEditActive(el, measures) {
  state = { editing: true, el, range: null, measures: measures || [] }
  emit()
}
export function setTextEditInactive(el) {
  if (el && state.el !== el) return           // a newer editor already took over
  state = { editing: false, el: null, range: null, measures: [] }
  emit()
}
export function setTextEditMeasures(measures) {
  state = { ...state, measures: measures || [] }
  emit()
}

// Remember the current selection while it's inside the active editor, so an inspector
// click (which blurs the editable) can restore it before running a command.
export function saveTextRange() {
  const s = window.getSelection()
  if (s && s.rangeCount && state.el && state.el.contains(s.anchorNode)) {
    state.range = s.getRangeAt(0).cloneRange()
  }
}

function restore() {
  const { el, range } = state
  if (!el) return false
  el.focus()
  if (range) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(range) }
  return true
}

export function applyTextCmd(cmd, val) {
  if (!restore()) return
  document.execCommand('styleWithCSS', false, true)
  // Quote font families: names such as Source Serif 4 are invalid bare CSS values.
  const value = cmd === 'fontName' ? JSON.stringify(String(val)) : val
  document.execCommand(cmd, false, value)
  saveTextRange()
}

export function applyTextFontSize(px) {
  if (!restore()) return
  // fontSize must emit a legacy font node for the pixel conversion below.
  // Other commands enable CSS mode, where Chromium instead emits xxx-large (48px).
  document.execCommand('styleWithCSS', false, false)
  document.execCommand('fontSize', false, '7')
  state.el.querySelectorAll('font[size="7"]').forEach(f => { f.removeAttribute('size'); f.style.fontSize = px + 'px' })
  document.execCommand('styleWithCSS', false, true)
  saveTextRange()
}

export function insertTextToken(name) {
  if (!name || !restore()) return
  const safe = String(name).replace(/"/g, '&quot;')
  document.execCommand('insertHTML', false, `<span data-measure="${safe}" contenteditable="false" style="${TOKEN_STYLE}">${name}</span>&nbsp;`)
  saveTextRange()
}
