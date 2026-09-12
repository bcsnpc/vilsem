import React, { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtVal } from '../shared/formatters.js'
import { getScalarValue } from '../shared/row-normalize.js'
import { setTextEditActive, setTextEditInactive, setTextEditMeasures, saveTextRange } from '../shared/textEditBus.js'
import DOMPurify from 'dompurify'

// ── Canvas object: rich, in-place-editable text with live measure/value tokens ──────
// Double-click on the canvas to edit directly (multi-line, mixed fonts/sizes/colours).
// Insert a "value" and it becomes a live token that queries the measure and reacts to the
// dashboard's filters — like a KPI embedded in a sentence.

// Subtle chip that identifies a live value but INHERITS the surrounding text formatting
// (colour / weight / italic), so a value inside italic text is italic too.
const TOKEN_STYLE = 'display:inline-block;padding:0 3px;border-radius:4px;background:rgba(94,234,212,0.14)'

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s || ''
  return d.innerHTML.replace(/\n/g, '<br>')
}

// Sanitize stored rich-text HTML before it enters the DOM. DOMPurify's safe
// defaults strip <script>, event handlers (onerror/onclick) and javascript:
// URLs — the XSS chain in the threat model — while KEEPING the editor's
// legitimate formatting and the data-measure live-value token spans.
// contenteditable is re-added since the token chips carry contenteditable="false".
const sanitizeRich = (html) => DOMPurify.sanitize(html || '', { ADD_ATTR: ['contenteditable'] })

// Measure names referenced by data-measure token spans in the stored html.
function extractMeasures(html) {
  const out = new Set()
  if (html) {
    const re = /data-measure="([^"]*)"/g
    let m
    while ((m = re.exec(html))) {
      const v = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      if (v) out.add(v)
    }
  }
  return [...out]
}

export default function CompactTextBox({ config = {} }) {
  const c = config
  const t = c._T || {}
  const editable = !!c._editable
  const editing = !!c._editing        // driven by CanvasEditor (double-click the handle)
  const ref = useRef(null)
  const [vals, setVals] = useState({})
  const [, setEditRevision] = useState(0)
  const [modelMeasures, setModelMeasures] = useState([])
  const [slash, setSlash] = useState(null)   // { query, top, left } when the "/" menu is open

  // Insert a live measure token at the current caret.
  const insertToken = (name) => {
    if (!name || !ref.current) return
    ref.current.focus()
    const safe = String(name).replace(/"/g, '&quot;')
    document.execCommand('insertHTML', false, `<span data-measure="${safe}" contenteditable="false" style="${TOKEN_STYLE}">${name}</span>&nbsp;`)
  }

  const html = c.html != null ? c.html : (c.text ? escapeHtml(c.text) : '')
  const filters = c._globalFilters || {}
  const filtersKey = c._globalFiltersKey || ''
  const measures = extractMeasures(editing ? (ref.current?.innerHTML || html) : html)
  const measuresKey = measures.join('|')

  // Fill every token span with its live value (or the name until it loads) and normalise
  // its chip style so it inherits the surrounding formatting. Only touches token
  // textContent/style — never innerHTML — so it's safe to run while editing (no cursor jump).
  const fillTokens = (el) => {
    if (!el) return
    el.querySelectorAll('[data-measure]').forEach(span => {
      const name = span.getAttribute('data-measure')
      const prefix = span.getAttribute('data-prefix') || ''
      const suffix = span.getAttribute('data-suffix') || ''
      const v = vals[name]
      span.textContent = v != null ? fmtVal(v, prefix, suffix) : name
      span.setAttribute('contenteditable', 'false')
      span.setAttribute('style', TOKEN_STYLE)
    })
  }

  // Resolve measure tokens → live values, reacting to filters. Runs in edit + view so the
  // value shows immediately, even mid-edit.
  useEffect(() => {
    if (!measures.length || !window.semantica?.query) { setVals({}); return }
    let cancelled = false
    ;(async () => {
      const out = {}
      for (const name of measures) {
        try {
          // Scalar measure value — same API KPIs use ({measures}); queryTable requires a groupBy.
          const res = await window.semantica.query({ measures: [name], filters })
          if (res?.error) { out[name] = null; continue }
          const v = getScalarValue(res, name)
          out[name] = (typeof v === 'number') ? v : (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null)
        } catch { out[name] = null }
      }
      if (!cancelled) setVals(out)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuresKey, filtersKey])

  // Paint html into the div (view mode). Fill tokens with live values.
  useEffect(() => {
    if (!ref.current || editing) return
    const el = ref.current
    if (!html) { el.innerHTML = editable ? '<span style="opacity:0.4">Double-click to edit</span>' : ''; return }
    el.innerHTML = sanitizeRich(html)
    fillTokens(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, editing])

  // Keep token values fresh when they load / filters change — in BOTH edit and view — without
  // resetting innerHTML (so the caret stays put while editing).
  useEffect(() => { fillTokens(ref.current) })  // runs every render; cheap (only token spans)

  // Load measures for the "insert value" picker (once, on first edit).
  useEffect(() => {
    if (!editing || modelMeasures.length) return
    const ctx = window._modelCtx || window._sparklineModelCtx
    if (ctx?.measures) { setModelMeasures(ctx.measures.filter(m => !m.isHidden).map(m => m.name)); return }
    window.semantica?.getModelContext?.().then(cx => {
      window._modelCtx = cx
      setModelMeasures((cx?.measures || []).filter(m => !m.isHidden).map(m => m.name))
    }).catch(() => {})
  }, [editing, modelMeasures.length])

  const stopEdit = () => {
    const el = ref.current
    const newHtml = el ? el.innerHTML : html
    if (newHtml !== html) c._onConfigPatch?.({ html: newHtml })
    c._stopEditing?.()
  }

  // Enter edit mode when CanvasEditor flags this box: seed the editable html (tokens as
  // chips, not filled values), focus, and drop the cursor at the end.
  useEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.innerHTML = sanitizeRich(html)
    fillTokens(el)   // show live values while editing too (tokens are atomic, not editable)
    el.focus()
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // Register with the inspector-format bridge while editing (so B/I/U, font, colour, +Value
  // live in the Style tab) and keep the current selection saved for those controls.
  useEffect(() => {
    if (!editing) { setTextEditInactive(ref.current); return }
    const el = ref.current
    setTextEditActive(el, modelMeasures)
    const onSel = () => saveTextRange()
    document.addEventListener('selectionchange', onSel)
    return () => { document.removeEventListener('selectionchange', onSel); setTextEditInactive(el) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  useEffect(() => { if (editing) setTextEditMeasures(modelMeasures) }, [modelMeasures, editing])

  // Click outside the box (and outside the toolbar) commits the edit.
  useEffect(() => {
    if (!editing) return
    const onDocDown = (e) => {
      const el = ref.current
      if (el && (el.contains(e.target) || e.target?.closest?.('[data-text-toolbar]'))) return
      stopEdit()
    }
    document.addEventListener('mousedown', onDocDown, true)
    return () => document.removeEventListener('mousedown', onDocDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // "/" slash command — type "/" then filter measures; Enter or click inserts a live token.
  const slashMatches = slash ? modelMeasures.filter(m => m.toLowerCase().includes((slash.query || '').toLowerCase())).slice(0, 8) : []
  const onEditorInput = () => {
    // Refresh token query dependencies without replacing the editable DOM or caret.
    if (editing) setEditRevision(v => v + 1)
    if (!editing) { if (slash) setSlash(null); return }
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) { setSlash(null); return }
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== 3) { setSlash(null); return }
    const before = node.textContent.slice(0, range.startOffset)
    const m = before.match(/\/([\w %$.\-]*)$/)
    if (!m) { setSlash(null); return }
    let rect = null
    try { rect = range.getBoundingClientRect() } catch { /* empty for collapsed range */ }
    if (!rect || (!rect.top && !rect.left)) rect = ref.current?.getBoundingClientRect()
    setSlash({ query: m[1], matchLen: m[0].length, top: (rect?.bottom || 0) + 4, left: rect?.left || 0 })
  }
  const applySlash = (name) => {
    const el = ref.current
    const sel = window.getSelection()
    if (el && sel && sel.rangeCount && slash) {
      const range = sel.getRangeAt(0)
      const node = range.startContainer
      if (node.nodeType === 3) {
        const start = Math.max(0, range.startOffset - slash.matchLen)
        const del = document.createRange()
        del.setStart(node, start); del.setEnd(node, range.startOffset)
        sel.removeAllRanges(); sel.addRange(del)
        document.execCommand('delete')
      }
    }
    insertToken(name)
    setSlash(null)
  }

  const vAlign = c.vAlign === 'top' ? 'flex-start' : c.vAlign === 'bottom' ? 'flex-end' : 'center'
  const hAlign = c.align === 'left' ? 'flex-start' : c.align === 'right' ? 'flex-end' : 'center'

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: editing ? 'stretch' : vAlign, justifyContent: editing ? 'stretch' : hAlign, padding: c.padding ?? 8, boxSizing: 'border-box', position: 'relative' }}>
      {editing && slash && slashMatches.length > 0 && createPortal(
        <div data-text-toolbar style={{ position: 'fixed', top: slash.top, left: slash.left, zIndex: 99999, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 8, boxShadow: 'var(--v-shadow)', padding: 4, minWidth: 190, maxHeight: 240, overflow: 'auto' }}>
          <div style={{ fontSize: 9, color: 'var(--v-text-faint)', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Insert value</div>
          {slashMatches.map((m, i) => (
            <div key={m} onMouseDown={(e) => { e.preventDefault(); applySlash(m) }}
              style={{ padding: '5px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: 'var(--v-text)', background: i === 0 ? 'var(--v-accent-quiet)' : 'transparent' }}>
              {m}
            </div>
          ))}
        </div>, document.body)}
      <div
        ref={ref}
        contentEditable={editing}
        suppressContentEditableWarning
        onInput={onEditorInput}
        onKeyDown={(e) => {
          if (slash) {
            if (e.key === 'Enter') { e.preventDefault(); if (slashMatches[0]) applySlash(slashMatches[0]); return }
            if (e.key === 'Escape') { e.preventDefault(); setSlash(null); return }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return }
          }
          if (e.key === 'Escape') { e.preventDefault(); stopEdit() }
          e.stopPropagation()
        }}
        style={{
          width: '100%',
          fontFamily: c.fontFamily || 'inherit',
          fontSize: c.fontSize ?? 16,
          fontWeight: c.fontWeight ?? 500,
          color: c.color || t.textPrimary || '#E5E7EB',
          textAlign: c.align || 'center',
          lineHeight: c.lineHeight ?? 1.4,
          letterSpacing: c.letterSpacing ?? 0,
          textTransform: c.uppercase ? 'uppercase' : 'none',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          outline: editing ? '2px solid #818CF8' : 'none',
          borderRadius: 4, minHeight: editing ? '1.4em' : undefined,
          // Constrain long paragraphs in both modes; retain all content via scrolling.
          maxHeight: '100%', minWidth: 0,
          overflow: 'auto',
          cursor: editable && !editing ? 'text' : 'inherit',
        }}
      />
    </div>
  )
}

CompactTextBox.schema = [
  {key:'lineHeight',label:'Line height',group:'Paragraph',type:'range',default:1.4,min:0.8,max:3,step:0.1},
  {key:'letterSpacing',label:'Letter spacing',group:'Paragraph',type:'range',default:0,min:-1,max:8,step:0.25},
  {key:'padding',label:'Inner padding',group:'Paragraph',type:'range',default:8,min:0,max:40,step:1},
  {key:'uppercase',label:'Uppercase text',group:'Paragraph',type:'boolean',default:false},
  { key: 'fontFamily', label: 'Base font',  type: 'font',    default: '', group: 'Text' },
  { key: 'fontSize',   label: 'Base size',  type: 'range',   default: 16, min: 8, max: 96, step: 1, group: 'Text' },
  { key: 'fontWeight', label: 'Base weight', type: 'range',  default: 500, min: 100, max: 900, step: 100, group: 'Text' },
  { key: 'color',      label: 'Base colour', type: 'color',  default: '', group: 'Text' },
  { key: 'align',      label: 'Align',      type: 'select',  default: 'center',
    options: [{ label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' }], group: 'Text' },
  { key: 'vAlign',     label: 'Vertical',   type: 'select',  default: 'center',
    options: [{ label: 'Top', value: 'top' }, { label: 'Middle', value: 'center' }, { label: 'Bottom', value: 'bottom' }], group: 'Text' },
]
