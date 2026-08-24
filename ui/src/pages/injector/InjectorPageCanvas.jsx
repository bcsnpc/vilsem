import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import * as pbi from 'powerbi-client'
import CanvasEditor from '../../appspec/CanvasEditor.jsx'
import AppSpecRenderer from '../../appspec/AppSpecRenderer.jsx'
import VisualInspector from '../../appspec/VisualInspector.jsx'
import MiniChart from '../../appspec/shell/MiniChart.jsx'
import { useCanvasZoom, computeEffZoom, EditorZoomControls } from '../../appspec/shell/CanvasZoom.jsx'
import TemplatePicker from '../../templates/TemplatePicker.jsx'
import { FieldsPanel } from '../../vilsem/Panels.jsx'
import { ArrowLeft, ArrowRight, ChevronRight, Upload } from '../../ui/icons.js'
import VisualPlayground from '../../playground/VisualPlayground.jsx' // Playground Spike
import {
  makeEditSpec, flatPageView, getCurrentPage, mergePageResult, getPages,
  addVisualToSpec, VISUAL_PALETTE,
} from '../../appspec/specEditing.js'
import '../../vilsem/tokens.css'

// Collapsed-pane rail + collapse-chevron styles (shared by the Model and
// Prompt/Library panes so both fold away like the new-project shell).
const collapseBtn = { width: 22, height: 22, border: 'none', background: 'transparent', color: 'var(--v-text-faint)', font: '600 14px var(--v-font)', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }
const railText = { writingMode: 'vertical-rl', transform: 'rotate(180deg)', font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-2)', marginTop: 8 }
function collapsedRail(border) {
  return { width: 30, minWidth: 30, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, cursor: 'pointer', background: 'var(--v-bg-1)', [border === 'left' ? 'borderLeft' : 'borderRight']: '1px solid var(--v-border)', color: 'var(--v-text-2)' }
}

// S6 — the injector's authoring canvas. Same Model · Canvas · Prompt layout as a
// new project: model explorer (left), the target report page shown behind with
// existing visuals locked (center), prompt + library (right). Renders inline in
// the shell (not a portal). Generation runs against the report's own dataset;
// "Review & Inject" hands off to the parent's (unchanged) inject flow.
export default function InjectorPageCanvas({
  spec, setSpec, currentPageId,
  selectedVisualId, setSelectedVisualId,
  canvasTheme = 'light', measures = [], dimensions = [],
  datasetId = '', // Playground Spike — dataset scope for custom templates
  existingVisuals = [], existingNote, embed,
  pageName, onBack,
  onInject, injecting, progressPct = 0, progressStage = '', injectError,
  aiStatus, availableModels = {}, selectedProvider, setSelectedProvider, selectedModel, setSelectedModel,
  PROVIDERS = [],
}) {
  const [rightTab, setRightTab] = useState('prompt')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [snapOn, setSnapOn] = useState(true)
  const [modelCollapsed, setModelCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [promptDrop, setPromptDrop] = useState(false)
  const [presentMode, setPresentMode] = useState(false)
  const [showPlayground, setShowPlayground] = useState(false)   // Playground Spike
  const [customTemplates, setCustomTemplates] = useState([])
  const scrollRef = useRef(null)
  const { zoom, autoFit, viewportW, zoomIn, zoomOut, fit } = useCanvasZoom(scrollRef)

  // Playground Spike — load dataset-scoped custom templates
  const reloadCustomTemplates = useCallback(async () => {
    if (!datasetId || !window.semantica?.loadCustomTemplates) return
    try { setCustomTemplates((await window.semantica.loadCustomTemplates({ datasetId })) || []) } catch {}
  }, [datasetId])
  useEffect(() => { reloadCustomTemplates() }, [reloadCustomTemplates])

  // Playground Spike — drop a custom-template visual onto the target page.
  // Registers the template into spec.customVisuals (flatPageView carries it to
  // the renderer) with EMPTY data so the user rebinds to the report's own fields.
  const addCustomVisual = useCallback((template) => {
    const tid = template?.meta?.id; if (!tid || !spec) return
    const id = `v_${Date.now().toString(36)}`
    const newV = { id, type: 'custom', customTemplateId: tid,
      position: { x: 0, y: 0, w: 5, h: 4 },
      data: { measures: [], groupBy: null, dimensions: [], orderBy: 'desc', limit: 50 },
      config: { title: template.meta.name || 'Custom' } }
    const activeId = currentPageId || getPages(spec)[0]?.id
    setSpec({
      ...spec,
      customVisuals: { ...(spec.customVisuals || {}), [tid]: template },
      pages: getPages(spec).map(p => p.id === activeId ? { ...p, visuals: [...(p.visuals || []), newV] } : p),
      visuals: undefined, slicers: undefined,
    })
    setSelectedVisualId(id)
  }, [spec, currentPageId, setSpec, setSelectedVisualId])

  const isDark = canvasTheme === 'dark'
  const editSpec = useMemo(() => makeEditSpec(spec, currentPageId, setSpec), [spec, currentPageId, setSpec])
  const activePageSpec = useMemo(() => flatPageView(spec, currentPageId), [spec, currentPageId])
  const selectedVisual = selectedVisualId
    ? ((activePageSpec?.visuals || []).find(v => v.id === selectedVisualId) || (activePageSpec?.slicers || []).find(s => s.id === selectedVisualId))
    : null

  const layout = spec?.layout || {}
  const pageW = Number(layout.pageWidth) || 1280
  const pageH = Number(layout.pageHeight) || 720

  const visualCount = (activePageSpec?.visuals || []).length + (activePageSpec?.slicers || []).length
  const canGenerate = !generating && prompt.trim() && aiStatus?.anyConfigured

  async function runGenerate() {
    const text = prompt.trim()
    if (!text || generating) return
    setGenerating(true); setGenError('')
    try {
      const flat = flatPageView(spec, currentPageId)
      const res = await window.semantica.generateAppSpec({ userDescription: text, provider: selectedProvider, model: selectedModel, currentSpec: flat })
      if (res?.spec) { setSpec(mergePageResult(spec, currentPageId, res.spec)); setPrompt('') }
      else setGenError('Generation returned nothing.')
    } catch (e) { setGenError(e?.message || 'Generation failed') }
    setGenerating(false)
  }
  async function onAiRefine(p) {
    try {
      const flat = flatPageView(spec, currentPageId)
      const res = await window.semantica.generateAppSpec({ userDescription: p, provider: selectedProvider, model: selectedModel, currentSpec: flat })
      if (!res?.spec) return false
      setSpec(mergePageResult(spec, currentPageId, res.spec)); return true
    } catch { return false }
  }
  function addFromLibrary(type, w, h) {
    const { spec: ns, newVisualId } = addVisualToSpec(spec, currentPageId, { type, w, h })
    setSpec(ns); setSelectedVisualId(newVisualId)
  }
  function handleBindField(visualId, field) {
    editSpec(s => {
      const v = s.visuals.find(vi => vi.id === visualId); if (!v) return
      v.data = v.data || {}
      if (field.kind === 'measure') { const cur = v.data.measures || []; if (!cur.includes(field.name)) v.data.measures = [...cur, field.name] }
      else if (field.kind === 'column' && field.table && field.column) {
        if (v.type === 'table') { const d = v.data.dimensions || []; if (!d.some(x => x.table === field.table && x.column === field.column)) v.data.dimensions = [...d, { table: field.table, column: field.column }] }
        else v.data.groupBy = { table: field.table, column: field.column }
      }
    })
    setSelectedVisualId(visualId)
  }
  function handlePromptDrop(e) {
    e.preventDefault(); setPromptDrop(false)
    try {
      const f = JSON.parse(e.dataTransfer.getData('application/x-vilsem-field') || e.dataTransfer.getData('text/plain') || '{}')
      let ref = ''
      if (f.kind === 'measure') ref = `[${f.name}]`
      else if (f.kind === 'column' && f.table && f.column) ref = `${f.table}[${f.column}]`
      if (ref) setPrompt(p => (p ? `${p} ${ref}` : ref))
    } catch { /* ignore */ }
  }

  // ── Live embed backdrop (Microsoft-login only) ──────────────────────────────
  const embedRef = useRef(null)
  const [embedState, setEmbedState] = useState('idle')
  useEffect(() => {
    if (!embed?.embedUrl || !embedRef.current || !window.semantica?.pbiGetAccessToken) { setEmbedState('fallback'); return }
    let cancelled = false, powerbi
    setEmbedState('loading')
    ;(async () => {
      try {
        const res = await window.semantica.pbiGetAccessToken()
        if (cancelled) return
        if (!res?.ok || !res.token) { setEmbedState('fallback'); return }
        powerbi = new pbi.service.Service(pbi.factories.hpmFactory, pbi.factories.wpmpFactory, pbi.factories.routerFactory)
        const report = powerbi.embed(embedRef.current, {
          type: 'report', id: embed.reportId, embedUrl: embed.embedUrl, accessToken: res.token,
          tokenType: pbi.models.TokenType.Aad, viewMode: pbi.models.ViewMode.View,
          ...(embed.pageName ? { pageName: embed.pageName } : {}),
          settings: { panes: { filters: { visible: false }, pageNavigation: { visible: false } }, background: pbi.models.BackgroundType.Transparent },
        })
        report.off('loaded'); report.on('loaded', () => { if (!cancelled) setEmbedState('embedded') })
        report.off('error');  report.on('error',  () => { if (!cancelled) setEmbedState('fallback') })
      } catch { if (!cancelled) setEmbedState('fallback') }
    })()
    return () => { cancelled = true; try { powerbi?.reset(embedRef.current) } catch { /* ignore */ } }
  }, [embed?.embedUrl, embed?.reportId, embed?.pageName])

  // ── Present mode (read-only, full-bleed) ──────────────────────────────────
  // no-drag: this fixed overlay sits over the frameless window's drag titlebar;
  // without it the OS eats clicks on the top band (incl. Exit).
  if (presentMode) {
    return (
      <div className="no-drag" style={{ WebkitAppRegion: 'no-drag', position: 'fixed', inset: 0, zIndex: 10000, background: isDark ? '#0b0b12' : '#F1F5F9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="no-drag" style={{ WebkitAppRegion: 'no-drag', position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10010, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', padding: '6px 12px', boxShadow: 'var(--v-shadow)' }}>
          <span style={{ font: '600 12px var(--v-font)', color: 'var(--v-text)' }}>{pageName || 'Page'}</span>
          <div style={{ width: 1, height: 18, background: 'var(--v-border)' }} />
          <button onClick={() => setPresentMode(false)} style={{ WebkitAppRegion: 'no-drag', border: 'none', background: '#C42B1C', color: '#fff', borderRadius: 'var(--v-r)', padding: '5px 12px', font: '600 12px var(--v-font)', cursor: 'pointer' }}>Exit</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '60px 24px 24px' }}>
          <div style={{ width: '100%', maxWidth: 1280 }}>
            <AppSpecRenderer key="injector-present" spec={activePageSpec} availableMeasures={measures} canvasWidth={Math.min(pageW, 1280)} theme={canvasTheme} editMode={false} />
          </div>
        </div>
      </div>
    )
  }

  const effZoom = computeEffZoom(autoFit, zoom, viewportW, pageW)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--v-bg-0)' }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, flexShrink: 0, padding: '0 12px', borderBottom: '1px solid var(--v-border)', background: 'var(--v-bg-1)', overflowX: 'auto' }}>
        <button onClick={onBack} style={tbGhost} title="Back to pages"><ArrowLeft size={14} /> Pages</button>
        <div style={tbDiv} />
        <span style={{ font: '600 11px var(--v-mono)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--v-text-2)', whiteSpace: 'nowrap' }}>{pageName || 'Page'}</span>
        <span style={{ font: '400 11px var(--v-mono)', color: 'var(--v-text-faint)', whiteSpace: 'nowrap' }}>· {pageW}×{pageH || 'auto'}</span>
        {visualCount > 0 && <span style={{ font: '600 9px var(--v-mono)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--v-amber)', background: 'var(--v-amber-quiet)', borderRadius: 3, padding: '2px 6px' }}>{visualCount} pending</span>}

        <div style={{ flex: 1 }} />

        <EditorZoomControls zoom={zoom} autoFit={autoFit} onFit={fit} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <button style={tbToggle(snapOn)} onClick={() => setSnapOn(s => !s)}>Snap {snapOn ? 'on' : 'off'}</button>
        <button style={tbGhost} onClick={() => setShowPlayground(true)} title="Custom visual playground (spike)">⚗ Playground</button>
        <button style={tbGhost} onClick={() => { setSelectedVisualId(null); setPresentMode(true) }} disabled={visualCount === 0} title="Present (read-only)">Present</button>
        <div style={tbDiv} />
        <button onClick={onInject} disabled={injecting || visualCount === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 14px', border: 'none', borderRadius: 'var(--v-r)', cursor: (injecting || visualCount === 0) ? 'default' : 'pointer', font: '600 12px var(--v-font)', background: (injecting || visualCount === 0) ? 'var(--v-surface-3)' : 'var(--v-accent)', color: (injecting || visualCount === 0) ? 'var(--v-text-faint)' : '#04121a' }}>
          <Upload size={14} /> {injecting ? `Injecting… ${progressPct}%` : 'Review & Inject'}
        </button>
      </div>

      {existingNote && (
        <div style={{ flexShrink: 0, padding: '5px 14px', borderBottom: '1px solid var(--v-border)', background: 'var(--v-bg-1)', font: '400 11px var(--v-font)', color: 'var(--v-text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{existingNote}</span>
          <span style={{ color: embedState === 'embedded' ? 'var(--v-accent)' : 'var(--v-text-faint)' }}>· {embedState === 'embedded' ? 'live report backdrop' : embedState === 'loading' ? 'loading live report…' : 'wireframe backdrop'}</span>
        </div>
      )}
      {injectError && <div style={{ flexShrink: 0, padding: '6px 14px', background: 'var(--v-amber-quiet)', color: 'var(--v-amber)', font: '500 12px var(--v-font)' }}>⚠ {injectError}</div>}
      {injecting && progressStage && <div style={{ flexShrink: 0, padding: '6px 14px', font: '400 12px var(--v-font)', color: 'var(--v-text-muted)' }}>{progressStage}</div>}

      {/* ── Body: Model · Canvas · Prompt ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Model pane (collapsible) */}
        {modelCollapsed ? (
          <div onClick={() => setModelCollapsed(false)} title="Show model" style={collapsedRail('right')}>
            <span style={{ fontSize: 13 }}>›</span><span style={railText}>Model</span>
          </div>
        ) : (
          <div style={{ width: 240, minWidth: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--v-bg-1)', borderRight: '1px solid var(--v-border)' }}>
            <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid var(--v-border)', font: '600 11px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-2)' }}>
              <span style={{ flex: 1 }}>Model</span>
              <button onClick={() => setModelCollapsed(true)} title="Collapse" style={collapseBtn}>‹</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}><FieldsPanel /></div>
          </div>
        )}

        {/* Canvas */}
        <div ref={scrollRef} style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 24, background: isDark ? '#0b0b12' : 'var(--v-bg-0)', backgroundImage: 'radial-gradient(circle, rgba(140,160,180,0.10) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          onClick={() => setSelectedVisualId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', margin: '0 auto', width: pageW, minHeight: pageH || 720, zoom: effZoom,
            background: isDark ? '#0b0b12' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
            borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: 16, boxSizing: 'border-box',
            backgroundImage: snapOn ? `radial-gradient(circle, ${isDark ? 'rgba(140,160,180,0.16)' : 'rgba(30,40,60,0.08)'} 1px, transparent 1px)` : undefined,
            backgroundSize: snapOn ? `${(pageW - 32) / 12}px 88px` : undefined, backgroundPosition: '16px 16px',
          }}>
            {/* Live embed backdrop */}
            {embed?.embedUrl && (
              <div ref={embedRef} style={{ position: 'absolute', inset: 16, zIndex: 0, border: 0, borderRadius: 6, overflow: 'hidden', pointerEvents: 'none', opacity: embedState === 'embedded' ? 1 : 0 }} />
            )}
            {/* Existing native visuals as locked context boxes */}
            {embedState !== 'embedded' && existingVisuals.map((ev, i) => {
              const s = (pageW - 32) / pageW
              return (
                <div key={`bg-${i}`} style={{ position: 'absolute', zIndex: 0, pointerEvents: 'none', left: 16 + (ev.x || 0) * s, top: 16 + (ev.y || 0) * s, width: (ev.width || 0) * s, height: (ev.height || 0) * s, border: `1px dashed ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.16)'}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(17,24,39,0.015)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.35)' }}>🔒 {ev.visualType || 'visual'}</span>
                </div>
              )
            })}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <CanvasEditor
                spec={activePageSpec}
                zoom={effZoom}
                onSpecChange={(id, pos) => editSpec(s => {
                  s.layout = { ...(s.layout || {}), freeform: true }
                  const v = s.visuals.find(vi => vi.id === id)
                  if (v) { v.position = { ...v.position, ...pos }; return }
                  const sl = (s.slicers || []).find(si => si.id === id); if (sl) sl.position = { ...sl.position, ...pos }
                })}
                onBindField={handleBindField}
                onCreateFromField={(field, gridPos) => {
                  const id = `v_${Date.now().toString(36)}`
                  const newV = {
                    id, type: 'table',
                    position: { x: gridPos?.x ?? 0, y: gridPos?.y ?? 0, w: gridPos?.w || 4, h: gridPos?.h || 3 },
                    data: { measures: [], groupBy: null, dimensions: [], orderBy: 'desc', limit: 100 },
                    config: { title: field.kind === 'measure' ? field.name : (field.column || 'Table') },
                  }
                  if (field.kind === 'measure') newV.data.measures = [field.name]
                  else if (field.kind === 'column' && field.table && field.column) newV.data.dimensions = [{ table: field.table, column: field.column }]
                  editSpec(s => { s.layout = { ...(s.layout || {}), freeform: true }; s.visuals = [...(s.visuals || []), newV] })
                  setSelectedVisualId(id)
                }}
                selectedId={selectedVisualId}
                onSelect={setSelectedVisualId}
                theme={canvasTheme}
              />
              {visualCount === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ font: '400 13px var(--v-font)', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(17,24,39,0.4)' }}>Describe a visual on the right, or add one from the Library →</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prompt / Library (collapsible) */}
        {rightCollapsed ? (
          <div onClick={() => setRightCollapsed(false)} title="Show prompt & library" style={collapsedRail('left')}>
            <span style={{ fontSize: 13 }}>‹</span><span style={railText}>Prompt · Library</span>
          </div>
        ) : (
        <div style={{ width: 320, minWidth: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--v-surface)', borderLeft: '1px solid var(--v-border)', position: 'relative' }}>
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--v-border)', alignItems: 'center' }}>
            {['prompt', 'library'].map(t => (
              <button key={t} onClick={() => setRightTab(t)} style={{ flex: 1, padding: '9px 0', border: 'none', background: 'transparent', cursor: 'pointer', font: '600 12px var(--v-font)', textTransform: 'capitalize', color: rightTab === t ? 'var(--v-text)' : 'var(--v-text-muted)', borderBottom: `2px solid ${rightTab === t ? 'var(--v-accent)' : 'transparent'}` }}>{t}</button>
            ))}
            <button onClick={() => setRightCollapsed(true)} title="Collapse" style={{ ...collapseBtn, marginRight: 6 }}>›</button>
          </div>

          {rightTab === 'prompt' ? (
            <div style={{ padding: '14px 14px 0', flexShrink: 0 }}>
              {!aiStatus?.anyConfigured && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', marginBottom: 10, background: 'var(--v-amber-quiet)', borderRadius: 'var(--v-r)', font: '500 11px var(--v-font)', color: 'var(--v-amber)' }}>⚠ No AI provider — add a key in Settings.</div>
              )}
              <div onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!promptDrop) setPromptDrop(true) }} onDragLeave={() => setPromptDrop(false)} onDrop={handlePromptDrop}
                style={{ border: `1px solid ${promptDrop ? 'var(--v-accent)' : 'var(--v-border)'}`, borderRadius: 'var(--v-r-2)', background: 'var(--v-bg-1)' }}>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runGenerate() } }}
                  placeholder="Describe a visual — drop fields in as context…" rows={4}
                  style={{ width: '100%', padding: '11px 12px', border: 'none', outline: 'none', background: 'transparent', font: '400 13px var(--v-font)', color: 'var(--v-text)', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderTop: '1px solid var(--v-border)' }}>
                  <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} style={{ height: 28, maxWidth: 130, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '500 11px var(--v-font)', outline: 'none', cursor: 'pointer' }}>
                    {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}{aiStatus?.[p.statusKey]?.configured ? '' : ' (no key)'}</option>)}
                  </select>
                  <div style={{ flex: 1 }} />
                  <button onClick={runGenerate} disabled={!canGenerate} title="Generate" style={{ width: 30, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--v-r)', cursor: canGenerate ? 'pointer' : 'default', background: canGenerate ? 'var(--v-accent)' : 'var(--v-surface-3)', color: canGenerate ? '#04121a' : 'var(--v-text-faint)' }}>
                    {generating ? '…' : <ArrowRight size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ font: '600 9px var(--v-mono)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--v-text-faint)', width: 40, flexShrink: 0 }}>Model</span>
                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!(availableModels[selectedProvider] || []).length}
                  style={{ flex: 1, minWidth: 0, height: 28, background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '500 11px var(--v-font)', outline: 'none', cursor: 'pointer' }}>
                  {(availableModels[selectedProvider] || []).map(m => { const id = typeof m === 'string' ? m : (m.id || m.name || m.model); return <option key={id} value={id}>{id}</option> })}
                  {!(availableModels[selectedProvider] || []).length && <option value="">(no models)</option>}
                </select>
              </div>
              <div style={{ font: '400 11px var(--v-font)', color: 'var(--v-text-faint)', marginTop: 6 }}>Drag model fields into this box to pin them as context.</div>
              {genError && <div style={{ font: '400 11px var(--v-font)', color: 'var(--v-amber)', marginTop: 6 }}>⚠ {genError}</div>}
              {/* Start from a template — MERGES onto the current page (not a full replace) */}
              {aiStatus?.anyConfigured && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--v-border)', paddingTop: 12 }}>
                  <button onClick={() => setShowTemplates(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', font: '600 10px var(--v-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--v-text-2)', padding: 0 }}>
                    <span style={{ transform: showTemplates ? 'rotate(90deg)' : 'none', transition: 'transform .1s', display: 'inline-flex' }}><ChevronRight size={14} /></span>
                    Start from a template
                  </button>
                  {showTemplates && (
                    <div style={{ marginTop: 10 }}>
                      <TemplatePicker measures={measures} dimensions={dimensions} theme={{ mode: canvasTheme }}
                        onApply={(tspec) => { setSpec(mergePageResult(spec, currentPageId, tspec)); setShowTemplates(false) }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-faint)', marginBottom: 10 }}>Chart library — click to add</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {VISUAL_PALETTE.map(({ type, label, w, h }) => (
                  <button key={type} onClick={() => addFromLibrary(type, w, h)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-accent-border)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)' }}
                    style={{ padding: '12px 10px', background: 'var(--v-surface-2)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', cursor: 'pointer', font: '500 12px var(--v-font)', color: 'var(--v-text)', textAlign: 'left', transition: 'border-color .12s' }}>
                    <div style={{ marginBottom: 6 }}><MiniChart type={type} /></div>{label}
                  </button>
                ))}
              </div>

              {/* Playground Spike — custom visuals */}
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-faint)', flex: 1 }}>Custom visuals</div>
                <button onClick={() => setShowPlayground(true)} style={{ font: '600 10px var(--v-font)', color: 'var(--v-accent)', background: 'var(--v-accent-quiet)', border: '1px solid var(--v-accent-border)', borderRadius: 'var(--v-r-2)', padding: '3px 8px', cursor: 'pointer' }}>⚗ Playground</button>
              </div>
              {customTemplates.length === 0 ? (
                <div style={{ marginTop: 8, font: '400 11px var(--v-font)', color: 'var(--v-text-faint)', lineHeight: 1.5 }}>None yet. Open the Playground to author one.</div>
              ) : (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {customTemplates.map(({ templateId, name, icon, template }) => (
                    <button key={templateId} onClick={() => addCustomVisual(template)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-accent-border)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)' }}
                      style={{ padding: '12px 10px', background: 'var(--v-surface-2)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', cursor: 'pointer', font: '500 12px var(--v-font)', color: 'var(--v-text)', textAlign: 'left', transition: 'border-color .12s' }}>
                      <span style={{ fontSize: 18, marginBottom: 6, display: 'block' }}>{icon || '⚗'}</span>{name || templateId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Playground Spike — custom-visual authoring overlay */}
      {showPlayground && (
        <VisualPlayground
          measures={measures}
          dimensions={dimensions}
          themeMode={canvasTheme}
          provider={selectedProvider}
          model={selectedModel}
          aiStatus={aiStatus}
          providers={PROVIDERS}
          availableModels={availableModels}
          setProvider={setSelectedProvider}
          setModel={setSelectedModel}
          onSaveTemplate={async (template) => {
            if (!datasetId) throw new Error('This report has no dataset id — cannot save a template')
            await window.semantica.saveCustomTemplate({ datasetId, template })
            await reloadCustomTemplates()
          }}
          onClose={() => setShowPlayground(false)}
        />
      )}

      {/* Inspector (tabbed) */}
      {selectedVisual && (
        <VisualInspector
          visual={selectedVisual} canvasTheme={canvasTheme} pages={getPages(spec)} editSpec={editSpec} selectedVisualId={selectedVisualId}
          customTemplate={selectedVisual?.type === 'custom' ? spec?.customVisuals?.[selectedVisual.customTemplateId] : null}
          onClose={() => setSelectedVisualId(null)}
          onDelete={() => { editSpec(s => { if ((s.slicers || []).some(sl => sl.id === selectedVisualId)) s.slicers = s.slicers.filter(sl => sl.id !== selectedVisualId); else s.visuals = s.visuals.filter(v => v.id !== selectedVisualId) }); setSelectedVisualId(null) }}
          onDuplicate={() => editSpec(s => { const o = s.visuals.find(v => v.id === selectedVisualId); if (!o) return; const c = JSON.parse(JSON.stringify(o)); c.id = `${o.id}_copy_${Date.now().toString(36)}`; c.position = { ...c.position, x: (c.position?.x ?? 0) + 1, y: (c.position?.y ?? 0) + 1 }; s.visuals.push(c) })}
          onAiRefine={onAiRefine}
        />
      )}
    </div>
  )
}

const tbGhost = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 9px', background: 'transparent', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text-2)', font: '500 11px var(--v-font)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }
const tbDiv = { width: 1, height: 18, background: 'var(--v-border)', flexShrink: 0 }
const tbZoom = { width: 24, height: 26, border: 'none', background: 'transparent', color: 'var(--v-text-2)', font: '600 14px var(--v-font)', cursor: 'pointer', flexShrink: 0 }
const tbToggle = (on) => ({ height: 26, padding: '0 9px', background: on ? 'var(--v-accent-quiet)' : 'transparent', border: `1px solid ${on ? 'var(--v-accent-border)' : 'var(--v-border)'}`, borderRadius: 'var(--v-r)', color: on ? 'var(--v-accent)' : 'var(--v-text-muted)', font: '500 11px var(--v-font)', cursor: 'pointer', flexShrink: 0 })
