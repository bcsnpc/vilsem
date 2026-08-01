import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import EChartsCanvas from '../appspec/shared/EChartsCanvas.jsx'
import getThemeTokens from '../appspec/getThemeTokens'
import { normaliseRows, normaliseTableRows, resolveRowKey, getScalarValue } from '../appspec/shared/row-normalize.js'
import { instantiateVisual, validateTemplate, buildThemeContext, slotCount } from './instantiate.js'
import { generateTemplate } from './playgroundAI.js'
import { EXAMPLE_TEMPLATES } from './examples/index.js'

// Playground Spike — author a custom visual as a declarative template, bind it
// to real model fields, preview live data, and save it to the Library.
//
// Reachable as a full-screen overlay from both the project and inject canvases.
// Three panes: template JSON editor (left) · live preview (center) · slot
// binding + params (right). Everything renders through the SAME pure
// instantiateVisual() the canvas + export use — the preview is honest.

// ── cheap JSON syntax highlight (overlay behind a transparent textarea) ─────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function highlightJson(src) {
  const esc = escapeHtml(src)
  const RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  return esc.replace(RE, (m, str, colon, kw) => {
    if (str !== undefined) {
      const isKey = colon != null
      const isToken = str.startsWith('"$')
      const cls = isKey ? 'j-key' : (isToken ? 'j-token' : 'j-str')
      return `<span class="${cls}">${str}</span>${colon || ''}`
    }
    if (kw !== undefined) return `<span class="j-kw">${m}</span>`
    return `<span class="j-num">${m}</span>`
  })
}

// ── model field option builders ─────────────────────────────────────────────
function buildDimColumns(dimensions) {
  const cols = []
  for (const t of dimensions || []) {
    if (t.tableType === 'measure_group') continue
    for (const c of (t.columns || [])) {
      if (c.isHidden || c.isKey) continue
      const isDate = !!(c.isDate || /date/i.test(c.dataType || ''))
      cols.push({ table: t.name, column: c.name, isDate, label: `${t.name} › ${c.name}` })
    }
  }
  return cols
}

// bindings → the standard visual data contract. 1 dim → {groupBy}; 2 dims →
// {dimensions:[…]} (the multi-dim table path, which yields _cat2/_cats/_vals).
function bindingsToData(template, bindings) {
  const measures = []
  const dims = []
  for (const [name, slot] of Object.entries(template?.slots || {})) {
    const b = bindings[name]
    if (slot?.kind === 'measure' && Array.isArray(b)) measures.push(...b.filter(Boolean))
    else if ((slot?.kind === 'dimension' || slot?.kind === 'time') && b?.table) dims.push({ table: b.table, column: b.column })
  }
  if (dims.length >= 2) return { measures, dimensions: dims, orderBy: 'desc', limit: 500 }
  return { measures, groupBy: dims[0] || null, orderBy: 'desc', limit: 50 }
}

// Render the trial log as the §8.3 markdown table (one-click into the md).
function trialLogMarkdown(log) {
  const pass = log.filter(r => r.result === 'pass').length
  const viaRetry = log.filter(r => r.result === 'pass' && r.retried).length
  const fail = log.length - pass
  const head = `**Trial: ${log.length} runs — pass ${pass} (${viaRetry} via retry) · fail ${fail}**\n\n`
    + `| # | mode | prompt | result | retry | ms | provider |\n|---|------|--------|--------|-------|----|----------|\n`
  const rows = log.map((r, i) => `| ${i + 1} | ${r.mode} | ${String(r.prompt).replace(/\|/g, '\\|')} | ${r.result} | ${r.retried ? 'yes' : '—'} | ${r.ms} | ${r.provider || ''} |`).join('\n')
  return head + rows + '\n'
}

export default function VisualPlayground({
  measures = [], dimensions = [], themeMode = 'dark', onSaveTemplate, onClose,
  provider, model, aiStatus, providers = [], availableModels = {}, setProvider, setModel,
}) {
  const [text, setText] = useState(() => JSON.stringify(EXAMPLE_TEMPLATES[0], null, 2))
  const [bindings, setBindings] = useState({})
  const [paramValues, setParamValues] = useState({})
  const [rows, setRows] = useState([])
  const [queryState, setQueryState] = useState({ loading: false, error: null })
  const [saveState, setSaveState] = useState(null)
  // Phase 7 — AI generation
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiStage, setAiStage] = useState('')
  const [aiNotice, setAiNotice] = useState(null)
  const [forceCreate, setForceCreate] = useState(false)
  const [trialLog, setTrialLog] = useState([])
  const [showLog, setShowLog] = useState(false)
  const [editorCollapsed, setEditorCollapsed] = useState(false)
  const preRef = useRef(null)
  const taRef = useRef(null)
  const aiInputRef = useRef(null)

  const tokens = useMemo(() => getThemeTokens(themeMode), [themeMode])
  const dimColumns = useMemo(() => buildDimColumns(dimensions), [dimensions])
  const timeColumns = useMemo(() => dimColumns.filter(c => c.isDate), [dimColumns])

  // parse + validate the editor text
  const { template, jsonError } = useMemo(() => {
    try { return { template: JSON.parse(text), jsonError: null } }
    catch (e) { return { template: null, jsonError: e.message } }
  }, [text])
  const validation = useMemo(() => template ? validateTemplate(template) : { errors: [], warnings: [] }, [template])

  // ── Phase 7: AI generate / refine ───────────────────────────────────────────
  // Refine when a valid template with a stable id is loaded and the user hasn't
  // asked for a fresh start; otherwise create from scratch.
  const aiMode = (template?.meta?.id && !forceCreate) ? 'refine' : 'create'
  const aiReady = !!aiStatus?.anyConfigured
  // Provider/model selection (mirrors the canvas): show configured providers +
  // that provider's available models. Uses the shared parent state so the choice
  // is consistent with the canvas prompt panel.
  const isConfigured = useCallback((p) => (p.id === 'local' ? aiStatus?.local?.configured : aiStatus?.[p.statusKey]?.configured), [aiStatus])
  const modelOptions = useMemo(
    () => (availableModels[provider] || []).map(m => (typeof m === 'string' ? m : (m.id || m.name || m.model))).filter(Boolean),
    [availableModels, provider]
  )
  const onPickProvider = useCallback((id) => {
    setProvider?.(id)
    const list = (availableModels[id] || []).map(m => (typeof m === 'string' ? m : (m.id || m.name || m.model)))
    setModel?.(list[0] || '')
  }, [availableModels, setProvider, setModel])
  const refreshTrialLog = useCallback(async () => {
    try { setTrialLog((await window.semantica.readPlaygroundLog?.()) || []) } catch {}
  }, [])
  useEffect(() => { refreshTrialLog() }, [refreshTrialLog])

  const runAI = useCallback(async () => {
    const instruction = aiPrompt.trim()
    if (!instruction || aiBusy) return
    setAiBusy(true); setAiNotice(null); setAiStage('Composing…'); setSaveState(null)
    const t0 = Date.now()
    let result
    try {
      result = await generateTemplate({
        mode: aiMode, instruction,
        currentTemplate: aiMode === 'refine' ? template : null,
        provider, model,
        onStage: setAiStage,
      })
    } catch (e) {
      result = { ok: false, text: '', errors: [e.message || String(e)], retried: false }
    }
    const ms = Date.now() - t0
    // Route the output through the editor so lint + preview fire identically.
    if (result.text) { setText(result.text); setForceCreate(false) }
    setAiNotice(result.ok
      ? { ok: true, msg: `${aiMode === 'refine' ? 'Refined' : 'Generated'}${result.retried ? ' (after 1 retry)' : ''} in ${(ms / 1000).toFixed(1)}s` }
      : { ok: false, msg: result.text ? 'AI output needs manual fixes — see lint below.' : (result.errors?.[0] || 'Generation failed') })
    setAiStage(''); setAiBusy(false)
    setAiPrompt('')
    // Trial telemetry — one row per attempt so §8.3 builds itself.
    try {
      await window.semantica.appendPlaygroundLog?.({
        prompt: instruction, mode: aiMode,
        result: result.ok ? 'pass' : 'fail', retried: !!result.retried, ms,
        provider: result.provider || provider || 'auto', model: result.model || model || '',
      })
      refreshTrialLog()
    } catch {}
  }, [aiPrompt, aiBusy, aiMode, template, provider, model, refreshTrialLog])

  const newFromPrompt = useCallback(() => {
    setText(''); setForceCreate(true); setAiNotice(null); setSaveState(null)
    setTimeout(() => aiInputRef.current?.focus(), 0)
  }, [])

  // when the slot/param shape changes, prune stale bindings + seed param defaults
  const slotKey = useMemo(() => template ? JSON.stringify(Object.entries(template.slots || {}).map(([n, s]) => [n, s.kind, slotCount(s.count)])) : '', [template])
  const paramKey = useMemo(() => template ? JSON.stringify((template.params || []).map(p => [p.name, p.type, p.default])) : '', [template])
  useEffect(() => {
    if (!template) return
    setBindings(prev => {
      const next = {}
      for (const [name, slot] of Object.entries(template.slots || {})) {
        if (slot.kind === 'measure') next[name] = Array.isArray(prev[name]) ? prev[name] : []
        else next[name] = prev[name]?.table ? prev[name] : null
      }
      return next
    })
  }, [slotKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!template) return
    setParamValues(prev => {
      const next = {}
      for (const p of (template.params || [])) next[p.name] = (p.name in prev) ? prev[p.name] : p.default
      return next
    })
  }, [paramKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── preview query (debounced on binding change; reuses existing query layer) ──
  const data = useMemo(() => template ? bindingsToData(template, bindings) : { measures: [] }, [template, bindings])
  const dataKey = useMemo(() => JSON.stringify(data), [data])
  useEffect(() => {
    if (!template || !data.measures.length || !window.semantica) { setRows([]); return }
    let cancelled = false
    const handle = setTimeout(async () => {
      setQueryState({ loading: true, error: null })
      try {
        let out = []
        if (Array.isArray(data.dimensions) && data.dimensions.length >= 2) {
          // Next-D: two dimensions → the multi-dim table path (gives _cat/_cat2/_cats/_vals).
          const refs = data.dimensions.map(d => `${d.table}[${d.column}]`)
          const result = await window.semantica.queryTable({ groupBy: refs, measures: data.measures, limit: data.limit, orderBy: { column: data.measures[0], dir: 'desc' } })
          out = normaliseTableRows(result?.rows, refs, data.measures)
        } else if (data.groupBy?.table && data.groupBy?.column) {
          const ref = `${data.groupBy.table}[${data.groupBy.column}]`
          const result = await window.semantica.queryTable({ groupBy: [ref], measures: data.measures, limit: data.limit, orderBy: { column: data.measures[0], dir: 'desc' } })
          const key = resolveRowKey(result?.rows, ref)
          out = normaliseRows(result?.rows, key, data.measures)
        } else {
          // scalar (e.g. bullet) — no dimension bound
          const result = await window.semantica.query({ measures: data.measures })
          out = [{ _cat: '', _val: getScalarValue(result, data.measures[0]) }]
        }
        if (!cancelled) { setRows(out); setQueryState({ loading: false, error: null }) }
      } catch (e) {
        if (!cancelled) { setRows([]); setQueryState({ loading: false, error: e.message || String(e) }) }
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [dataKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── instantiate the preview option (same pure fn as canvas + export) ────────
  const { option, warnings } = useMemo(() => {
    if (!template) return { option: null, warnings: [] }
    const theme = buildThemeContext(tokens, paramValues.colorScheme)
    return instantiateVisual({ template, rows, params: paramValues, theme })
  }, [template, rows, tokens, paramValues])

  const syncScroll = useCallback(() => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop
      preRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }, [])

  const loadExample = (tpl) => { setText(JSON.stringify(tpl, null, 2)); setSaveState(null) }

  const doSave = async () => {
    if (!template || validation.errors.length) return
    setSaveState({ saving: true })
    try {
      await onSaveTemplate?.(template)
      setSaveState({ saved: true, name: template.meta?.name })
    } catch (e) {
      setSaveState({ error: e.message || String(e) })
    }
  }

  const canSave = !!template && !jsonError && validation.errors.length === 0

  // shared bits of chrome
  const panel = { background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r, 3px)' }
  const label = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--v-text-muted)', fontWeight: 600 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--v-bg-0)', color: 'var(--v-text)', display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        .vpg-editor-wrap { position: relative; flex: 1; min-height: 0; overflow: hidden; border-radius: 3px; }
        .vpg-editor-wrap pre, .vpg-editor-wrap textarea {
          margin: 0; padding: 12px 14px; border: 0; box-sizing: border-box;
          font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; font-size: 12px; line-height: 1.55;
          tab-size: 2; white-space: pre; word-wrap: normal; overflow: auto;
          position: absolute; inset: 0; width: 100%; height: 100%;
        }
        .vpg-editor-wrap pre { pointer-events: none; color: var(--v-text-2); background: var(--v-bg-1); z-index: 1; }
        .vpg-editor-wrap textarea { color: transparent; background: transparent; caret-color: var(--v-accent); resize: none; z-index: 2; outline: none; }
        .vpg-editor-wrap .j-key   { color: #7FBFD9; }
        .vpg-editor-wrap .j-str   { color: #B7C89A; }
        .vpg-editor-wrap .j-token { color: #D9A03C; font-weight: 600; }
        .vpg-editor-wrap .j-kw    { color: #C58AC5; }
        .vpg-editor-wrap .j-num   { color: #D98E73; }
        .vpg-sel { background: var(--v-surface-2); color: var(--v-text); border: 1px solid var(--v-border); border-radius: 3px; padding: 5px 7px; font-size: 12px; width: 100%; }
        .vpg-btn { background: var(--v-surface-2); color: var(--v-text-2); border: 1px solid var(--v-border); border-radius: 3px; padding: 5px 10px; font-size: 11px; cursor: pointer; }
        .vpg-btn:hover { border-color: var(--v-border-strong); color: var(--v-text); }
      `}</style>

      {/* header */}
      <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid var(--v-border)', background: 'var(--v-surface)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>Visual Playground</span>
        <span style={{ fontSize: 10, color: 'var(--v-amber)', border: '1px solid var(--v-border)', borderRadius: 3, padding: '1px 6px', letterSpacing: '0.06em' }}>SPIKE</span>
        <div style={{ flex: 1 }} />
        <select className="vpg-sel" value="" onChange={e => { const t = EXAMPLE_TEMPLATES.find(x => x.meta.id === e.target.value); if (t) loadExample(t) }}
          title="Load a starter template" style={{ width: 'auto', maxWidth: 210 }}>
          <option value="">📚 Load starter… ({EXAMPLE_TEMPLATES.length})</option>
          {EXAMPLE_TEMPLATES.map(tpl => <option key={tpl.meta.id} value={tpl.meta.id}>{tpl.meta.icon} {tpl.meta.name}</option>)}
        </select>
        <div style={{ width: 1, height: 22, background: 'var(--v-border)' }} />
        <button className="vpg-btn" onClick={doSave} disabled={!canSave}
          style={{ background: canSave ? 'var(--v-accent)' : 'var(--v-surface-2)', color: canSave ? 'var(--v-on-accent)' : 'var(--v-text-faint)', borderColor: canSave ? 'var(--v-accent)' : 'var(--v-border)', fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed' }}>
          Save to Library
        </button>
        <button className="vpg-btn" onClick={onClose}>✕ Close</button>
      </div>

      {/* AI prompt pane — canvas-style: controls row + prompt textarea */}
      <div style={{ flexShrink: 0, padding: '10px 16px 12px', borderBottom: '1px solid var(--v-border)', background: 'var(--v-bg-1)' }}>
        {/* controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: aiMode === 'refine' ? 'var(--v-amber)' : 'var(--v-accent)', border: `1px solid ${aiMode === 'refine' ? 'var(--v-amber)' : 'var(--v-accent-border)'}`, borderRadius: 3, padding: '3px 9px', whiteSpace: 'nowrap' }}>
            {aiMode === 'refine' ? '✎ Refine' : '✨ Create'}
          </span>
          <select className="vpg-sel" value={provider || ''} disabled={aiBusy} onChange={e => onPickProvider(e.target.value)}
            title="AI provider" style={{ width: 'auto', maxWidth: 140 }}>
            {!providers.length && <option value="">provider</option>}
            {providers.map(p => (
              <option key={p.id} value={p.id} disabled={!isConfigured(p)}>{p.label}{isConfigured(p) ? '' : ' (no key)'}</option>
            ))}
          </select>
          {modelOptions.length > 0 && (
            <select className="vpg-sel" value={model || ''} disabled={aiBusy} onChange={e => setModel?.(e.target.value)}
              title="Model" style={{ width: 'auto', maxWidth: 200 }}>
              {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <div style={{ flex: 1 }} />
          {aiBusy && <span style={{ fontSize: 11, color: 'var(--v-accent)', whiteSpace: 'nowrap' }}>{aiStage || 'Working…'}</span>}
          {aiNotice && <span style={{ fontSize: 11, color: aiNotice.ok ? '#6FBF8F' : '#E06C6C', whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{aiNotice.msg}</span>}
          <button className="vpg-btn" onClick={newFromPrompt} disabled={aiBusy} title="Clear the editor and start a new visual from a prompt">New from prompt</button>
          <button className="vpg-btn" onClick={() => setShowLog(s => !s)} title="Generation trial log">📋 Trial log{trialLog.length ? ` (${trialLog.length})` : ''}</button>
        </div>
        {/* prompt textarea + generate (canvas-style) */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <textarea ref={aiInputRef} value={aiPrompt} disabled={aiBusy || !aiReady} spellCheck={false} rows={2}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAI() } }}
            placeholder={aiReady ? (aiMode === 'refine' ? 'Refine the current template…  e.g. “make it horizontal and add a dot-size param”  (Enter to run, Shift+Enter for newline)' : 'Describe the visual you want…  e.g. “a radial bar chart of a measure per category”  (Enter to run)') : 'Add an AI provider key in Settings to generate'}
            style={{ flex: 1, minHeight: 54, resize: 'vertical', background: 'var(--v-surface-2)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2, 4px)', color: 'var(--v-text)', padding: '9px 12px', fontSize: 13, lineHeight: 1.45, outline: 'none', fontFamily: 'inherit', opacity: aiReady ? 1 : 0.5 }} />
          <button onClick={runAI} disabled={aiBusy || !aiReady || !aiPrompt.trim()}
            style={{ flexShrink: 0, width: 116, borderRadius: 'var(--v-r-2, 4px)', border: '1px solid var(--v-accent)', fontWeight: 700, fontSize: 13, cursor: (aiBusy || !aiReady || !aiPrompt.trim()) ? 'not-allowed' : 'pointer', background: (aiBusy || !aiReady || !aiPrompt.trim()) ? 'var(--v-surface-2)' : 'var(--v-accent)', color: (aiBusy || !aiReady || !aiPrompt.trim()) ? 'var(--v-text-faint)' : 'var(--v-on-accent)' }}>
            {aiBusy ? (aiStage ? '…' : 'Working…') : (aiMode === 'refine' ? '✎ Refine' : '✨ Generate')}
          </button>
        </div>
      </div>

      {/* Phase 7 — trial log drawer */}
      {showLog && (
        <div style={{ flexShrink: 0, maxHeight: 190, overflow: 'auto', borderBottom: '1px solid var(--v-border)', background: 'var(--v-bg-1)', padding: '8px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ ...label }}>Trial log — {trialLog.length} run(s)</span>
            {(() => { const p = trialLog.filter(r => r.result === 'pass').length; const rt = trialLog.filter(r => r.result === 'pass' && r.retried).length; const f = trialLog.length - p; return <span style={{ fontSize: 10, color: 'var(--v-text-muted)' }}>pass {p} · via-retry {rt} · fail {f}</span> })()}
            <div style={{ flex: 1 }} />
            <button className="vpg-btn" onClick={() => { navigator.clipboard?.writeText(trialLogMarkdown(trialLog)) }}>Copy as Markdown</button>
            <button className="vpg-btn" onClick={async () => { await window.semantica.clearPlaygroundLog?.(); refreshTrialLog() }}>Clear</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr style={{ color: 'var(--v-text-faint)', textAlign: 'left' }}>
              <th style={{ padding: '2px 6px' }}>#</th><th style={{ padding: '2px 6px' }}>mode</th><th style={{ padding: '2px 6px' }}>prompt</th><th style={{ padding: '2px 6px' }}>result</th><th style={{ padding: '2px 6px' }}>retry</th><th style={{ padding: '2px 6px' }}>ms</th>
            </tr></thead>
            <tbody>
              {trialLog.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--v-border)', color: 'var(--v-text-2)' }}>
                  <td style={{ padding: '2px 6px' }}>{i + 1}</td>
                  <td style={{ padding: '2px 6px' }}>{r.mode}</td>
                  <td style={{ padding: '2px 6px', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prompt}</td>
                  <td style={{ padding: '2px 6px', color: r.result === 'pass' ? '#6FBF8F' : '#E06C6C' }}>{r.result}</td>
                  <td style={{ padding: '2px 6px' }}>{r.retried ? 'yes' : '—'}</td>
                  <td style={{ padding: '2px 6px' }}>{r.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: editorCollapsed ? '38px 1.55fr 0.9fr' : '1.15fr 1.2fr 0.85fr', gap: 12, padding: 12 }}>

        {/* LEFT — template JSON editor (collapsible) */}
        {editorCollapsed ? (
          <div style={{ ...panel, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, cursor: 'pointer' }}
            onClick={() => setEditorCollapsed(false)} title="Show the template JSON">
            <button className="vpg-btn" style={{ padding: '4px 6px' }} onClick={() => setEditorCollapsed(false)}>▶</button>
            <div style={{ writingMode: 'vertical-rl', marginTop: 12, ...label, letterSpacing: '0.12em' }}>Template · JSON</div>
            <div style={{ flex: 1 }} />
            <span style={{ writingMode: 'vertical-rl', marginBottom: 10, fontSize: 10, color: jsonError || validation.errors.length ? '#E06C6C' : validation.warnings.length ? 'var(--v-amber)' : '#6FBF8F' }}>
              {jsonError ? 'invalid' : validation.errors.length ? `${validation.errors.length} err` : validation.warnings.length ? `${validation.warnings.length} warn` : 'valid'}
            </span>
          </div>
        ) : (
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--v-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="vpg-btn" style={{ padding: '3px 6px' }} onClick={() => setEditorCollapsed(true)} title="Collapse the editor (more room for the preview)">◀</button>
            <span style={label}>Template · .vilsem-visual</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: jsonError ? '#E06C6C' : validation.errors.length ? '#E06C6C' : validation.warnings.length ? 'var(--v-amber)' : '#6FBF8F' }}>
              {jsonError ? 'invalid JSON' : validation.errors.length ? `${validation.errors.length} error(s)` : validation.warnings.length ? `${validation.warnings.length} warning(s)` : 'valid'}
            </span>
          </div>
          <div className="vpg-editor-wrap">
            <pre ref={preRef} aria-hidden dangerouslySetInnerHTML={{ __html: highlightJson(text) + '\n' }} />
            <textarea ref={taRef} value={text} spellCheck={false} onScroll={syncScroll}
              onChange={e => { setText(e.target.value); setSaveState(null) }} />
          </div>
          {/* validation output */}
          {(jsonError || validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div style={{ maxHeight: 130, overflow: 'auto', borderTop: '1px solid var(--v-border)', padding: '8px 12px', fontSize: 11, lineHeight: 1.6 }}>
              {jsonError && <div style={{ color: '#E06C6C' }}>⛔ {jsonError}</div>}
              {validation.errors.map((e, i) => <div key={`e${i}`} style={{ color: '#E06C6C' }}>⛔ {e}</div>)}
              {validation.warnings.map((w, i) => <div key={`w${i}`} style={{ color: 'var(--v-amber)' }}>⚠ {w}</div>)}
            </div>
          )}
        </div>
        )}

        {/* CENTER — live preview */}
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--v-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={label}>Live Preview</span>
            <div style={{ flex: 1 }} />
            {queryState.loading && <span style={{ fontSize: 10, color: 'var(--v-accent)' }}>querying…</span>}
            <span style={{ fontSize: 10, color: 'var(--v-text-muted)' }}>{rows.length} rows</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 3, position: 'relative' }}>
              {!data.measures.length ? (
                <Centered>Bind at least one measure on the right →</Centered>
              ) : queryState.error ? (
                <Centered tone="err">Query error: {queryState.error}</Centered>
              ) : option ? (
                <EChartsCanvas option={option} />
              ) : (
                <Centered>{jsonError ? 'Fix the template JSON to preview' : 'No renderable option'}</Centered>
              )}
            </div>
            {warnings?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--v-amber)', maxHeight: 54, overflow: 'auto' }}>
                {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
            {saveState && (
              <div style={{ marginTop: 8, fontSize: 11, color: saveState.error ? '#E06C6C' : saveState.saved ? '#6FBF8F' : 'var(--v-text-muted)' }}>
                {saveState.saving ? 'Saving…' : saveState.saved ? `✓ Saved “${saveState.name}” to Library — drag it onto the canvas.` : saveState.error ? `Save failed: ${saveState.error}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — slot bindings + params */}
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--v-border)' }}>
            <span style={label}>Bind & Configure</span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* slots */}
            <div>
              <div style={{ ...label, marginBottom: 8 }}>Slots</div>
              {Object.entries(template?.slots || {}).map(([name, slot]) => (
                <SlotBinder key={name} name={name} slot={slot}
                  measures={measures} dimColumns={dimColumns} timeColumns={timeColumns}
                  value={bindings[name]} onChange={v => setBindings(prev => ({ ...prev, [name]: v }))} />
              ))}
              {!Object.keys(template?.slots || {}).length && <div style={{ fontSize: 11, color: 'var(--v-text-faint)' }}>No slots declared.</div>}
            </div>
            {/* params */}
            {(template?.params || []).length > 0 && (
              <div>
                <div style={{ ...label, marginBottom: 8 }}>Parameters</div>
                {(template.params || []).map(p => (
                  <ParamInput key={p.name} def={p} value={paramValues[p.name]}
                    onChange={v => setParamValues(prev => ({ ...prev, [p.name]: v }))} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Centered({ children, tone }) {
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, fontSize: 12, color: tone === 'err' ? '#E06C6C' : 'var(--v-text-faint)' }}>{children}</div>
}

function SlotBinder({ name, slot, measures, dimColumns, timeColumns, value, onChange }) {
  const box = { marginBottom: 10 }
  const head = { fontSize: 11, color: 'var(--v-text-2)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }
  const kindPill = { fontSize: 9, color: 'var(--v-text-muted)', border: '1px solid var(--v-border)', borderRadius: 3, padding: '0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }

  if (slot.kind === 'measure') {
    const n = slotCount(slot.count)
    const arr = Array.isArray(value) ? value : []
    return (
      <div style={box}>
        <div style={head}><b style={{ fontWeight: 600 }}>{name}</b> <span style={kindPill}>measure ×{n}</span></div>
        {Array.from({ length: n }).map((_, i) => (
          <select key={i} className="vpg-sel" style={{ marginBottom: 4 }} value={arr[i] || ''}
            onChange={e => { const next = [...arr]; next[i] = e.target.value; onChange(next.filter((_, idx) => idx <= n)) }}>
            <option value="">— measure {n > 1 ? i + 1 : ''} —</option>
            {measures.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        ))}
      </div>
    )
  }

  const cols = slot.kind === 'time' ? timeColumns : dimColumns
  const cur = value?.table ? `${value.table}|${value.column}` : ''
  return (
    <div style={box}>
      <div style={head}><b style={{ fontWeight: 600 }}>{name}</b> <span style={kindPill}>{slot.kind}</span></div>
      <select className="vpg-sel" value={cur}
        onChange={e => { const [table, column] = e.target.value.split('|'); onChange(table ? { table, column } : null) }}>
        <option value="">— {slot.kind === 'time' ? 'date field' : 'dimension'} —</option>
        {cols.map(c => <option key={c.label} value={`${c.table}|${c.column}`}>{c.label}</option>)}
      </select>
    </div>
  )
}

function ParamInput({ def, value, onChange }) {
  const row = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }
  const name = <span style={{ fontSize: 11, color: 'var(--v-text-2)', flex: 1 }}>{def.name}</span>
  if (def.type === 'boolean') {
    return <label style={row}><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />{name}</label>
  }
  if (def.type === 'color') {
    return <div style={row}>{name}<input type="color" value={value || '#58AECB'} onChange={e => onChange(e.target.value)} style={{ width: 34, height: 24, border: '1px solid var(--v-border)', background: 'transparent', borderRadius: 3 }} /></div>
  }
  if (def.type === 'number') {
    return <div style={row}>{name}<input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} className="vpg-sel" style={{ width: 90 }} /></div>
  }
  return <div style={row}>{name}<input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} className="vpg-sel" style={{ width: 120 }} /></div>
}
