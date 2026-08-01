import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import AppSpecRenderer from '../appspec/AppSpecRenderer.jsx'
import CanvasEditor from '../appspec/CanvasEditor.jsx'
import { setCanvasState, clearCanvasState } from '../vilsem/canvasStore.js'
import { FieldsPanel } from '../vilsem/Panels.jsx'
import VisualInspector from '../appspec/VisualInspector.jsx'
import { validateAppSpec } from '../appspec/schema.js'
import { publishHtmlContentFlow } from './powerbi/publishHtmlContentFlow.js'
import { FLAGS } from '../appspec/shared/feature-flags.js'         // Deploy-to-Fabric spike (flag)
import FabricDeployDialog from './fabric/FabricDeployDialog.jsx'   // Deploy-to-Fabric spike (isolated UI)
import { publishCustomVisualFlow } from './powerbi/publishCustomVisualFlow.js'
import { mapAppSpecToPages, filterRenderablePages } from './AppSpecToPowerBI.js'
import TemplatePicker from '../templates/TemplatePicker.jsx'
import VisualPlayground from '../playground/VisualPlayground.jsx' // Playground Spike
import { Button, IconButton } from '../ui/Button.jsx'
import { Input, Textarea, Select, Toggle, Field } from '../ui/Input.jsx'
import { SegmentedControl } from '../ui/Tabs.jsx'
import { Chip, StatusDot, Spinner, ProgressBar } from '../ui/Feedback.jsx'
import { Modal } from '../ui/Modal.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useTheme } from '../ui/theme.js'
import { ArrowLeft, ArrowUp, Pencil, Play, Sun, Moon, Save, Download, Upload, Plus, Sparkles, ChevronRight, ChevronLeft, Filter, AlertTriangle, CircleCheck } from '../ui/icons.js'

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic',      statusKey: 'claude',  color: 'var(--v-amber)' },
  { id: 'openai',    label: 'OpenAI',          statusKey: 'openai',  color: '#10B981' },
  { id: 'gemini',    label: 'Gemini',          statusKey: 'gemini',  color: '#4285F4' },
  { id: 'groq',      label: 'Groq',            statusKey: 'groq',    color: '#8B5CF6' },
]

// ── Premium free fonts ───────────────────────────────────────────────────────
const PREMIUM_FONTS = [
  'Inter', 'DM Sans', 'Space Grotesk', 'Plus Jakarta Sans', 'Manrope',
  'Sora', 'Outfit', 'Urbanist', 'Libre Franklin', 'IBM Plex Sans',
]

const COLOR_SCHEMES = [
  { id: 'teal',   color: '#14B8A6' },
  { id: 'blue',   color: '#3B82F6' },
  { id: 'purple', color: '#A855F7' },
  { id: 'violet', color: '#8B5CF6' },
  { id: 'gold',   color: 'var(--v-amber)' },
  { id: 'green',  color: 'var(--v-success)' },
  { id: 'rose',   color: '#F43F5E' },
  { id: 'red',    color: 'var(--v-danger)' },
  { id: 'orange', color: '#F97316' },
]

// Pure RFC 6902 JSON Patch implementation (no dependencies)
function applyJsonPatch(spec, patches) {
  let result = JSON.parse(JSON.stringify(spec))
  for (const patch of patches) {
    try {
      const parts = patch.path.split('/').filter(p => p !== '')
      if (patch.op === 'replace') {
        let obj = result
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] === undefined) { obj = null; break }
          obj = obj[parts[i]]
        }
        if (obj != null) {
          const last = parts[parts.length - 1]
          const idx = parseInt(last)
          if (!isNaN(idx) && Array.isArray(obj)) obj[idx] = patch.value
          else obj[last] = patch.value
        }
      } else if (patch.op === 'add') {
        let obj = result
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] === undefined) { obj = null; break }
          obj = obj[parts[i]]
        }
        if (obj == null) continue
        const last = parts[parts.length - 1]
        if (last === '-' && Array.isArray(obj)) obj.push(patch.value)
        else if (Array.isArray(obj)) { const idx = parseInt(last); if (!isNaN(idx)) obj.splice(idx, 0, patch.value); else obj[last] = patch.value }
        else obj[last] = patch.value
      } else if (patch.op === 'remove') {
        let obj = result
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] === undefined) { obj = null; break }
          obj = obj[parts[i]]
        }
        if (obj == null) continue
        const last = parts[parts.length - 1]
        if (Array.isArray(obj)) { const idx = parseInt(last); if (!isNaN(idx)) obj.splice(idx, 1) }
        else delete obj[last]
      }
    } catch (e) {
      console.warn('[Patch] Failed to apply:', patch, e.message)
    }
  }
  return result
}

// Mini chart glyph for the Library tiles (Slate; a consistent mini-bar mark).
// Per-type schematic glyph for the chart library — each chart type gets its own
// recognizable icon (cyan = the data series, grey = structure). 48×24 viewBox.
function MiniChart({ type = 'bar' }) {
  const A = 'var(--v-accent)'       // data series
  const M = 'var(--v-surface-4)'    // structure / secondary
  const Q = 'var(--v-accent-quiet)' // filled accent area
  const glyphs = {
    kpi: (
      <>
        <text x="24" y="15" textAnchor="middle" style={{ fontFamily: 'var(--v-mono)', fontSize: 12, fontWeight: 700, fill: A }}>12.3</text>
        <rect x="17" y="18" width="14" height="2" rx="1" fill={M} />
      </>
    ),
    gauge: (
      <>
        <path d="M7 19 A 17 17 0 0 1 41 19" fill="none" stroke={M} strokeWidth="3" strokeLinecap="round" />
        <line x1="24" y1="19" x2="33" y2="9" stroke={A} strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="19" r="2.5" fill={A} />
      </>
    ),
    bar: (
      <>
        {[[6, 12], [17, 6], [28, 10], [39, 14]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="7" height={21 - y} rx="1" fill={i === 1 ? A : M} />
        ))}
      </>
    ),
    line: (
      <>
        <polyline points="5,17 17,8 28,13 43,5" fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="43" cy="5" r="2" fill={A} />
      </>
    ),
    area: (
      <>
        <path d="M5,17 L17,8 L28,13 L43,5 L43,21 L5,21 Z" fill={Q} />
        <polyline points="5,17 17,8 28,13 43,5" fill="none" stroke={A} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    donut: (
      <>
        <circle cx="24" cy="12" r="8" fill="none" stroke={M} strokeWidth="4" />
        <path d="M24 4 A 8 8 0 0 1 31.5 16.5" fill="none" stroke={A} strokeWidth="4" />
      </>
    ),
    scatter: (
      <>
        {[[8, 15], [16, 9], [22, 17], [30, 7], [36, 13], [42, 10]].map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2" fill={i % 2 ? A : M} />
        ))}
      </>
    ),
    table: (
      <>
        <rect x="6" y="5" width="36" height="14" rx="1.5" fill="none" stroke={M} strokeWidth="1.5" />
        <rect x="6.75" y="5.75" width="34.5" height="4" fill={Q} />
        <line x1="18" y1="5" x2="18" y2="19" stroke={M} strokeWidth="1" />
        <line x1="30" y1="5" x2="30" y2="19" stroke={M} strokeWidth="1" />
        <line x1="6" y1="12" x2="42" y2="12" stroke={M} strokeWidth="1" />
      </>
    ),
    waterfall: (
      <>
        {[[6, 13, 6], [16, 9, 5], [26, 6, 5], [36, 5, 14]].map(([x, y, h], i) => (
          <rect key={i} x={x} y={y} width="7" height={h} rx="1" fill={i === 3 ? A : M} />
        ))}
      </>
    ),
    treemap: (
      <>
        <rect x="6" y="5" width="20" height="14" rx="1" fill={A} />
        <rect x="27" y="5" width="15" height="8" rx="1" fill={M} />
        <rect x="27" y="14" width="15" height="5" rx="1" fill={M} />
      </>
    ),
    grouped_bar: (
      <>
        {[[8, 10, A], [15, 13, M], [29, 7, A], [36, 12, M]].map(([x, y, f], i) => (
          <rect key={i} x={x} y={y} width="6" height={21 - y} rx="1" fill={f} />
        ))}
      </>
    ),
    stacked_bar: (
      <>
        {[[8, 13, 7], [21, 11, 6], [34, 14, 5]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="8" height={21 - y} rx="1" fill={M} />
            <rect x={x} y={y - 6} width="8" height="6" rx="1" fill={A} />
          </g>
        ))}
      </>
    ),
    stacked_area: (
      <>
        <path d="M5,13 L18,7 L30,11 L43,5 L43,21 L5,21 Z" fill={Q} />
        <path d="M5,18 L18,15 L30,17 L43,14 L43,21 L5,21 Z" fill={M} />
      </>
    ),
    lollipop: (
      <>
        {[[9, 10], [19, 6], [29, 13], [39, 8]].map(([x, y], i) => (
          <g key={i}>
            <line x1={x} y1="21" x2={x} y2={y} stroke={M} strokeWidth="1.5" />
            <circle cx={x} cy={y} r="2.5" fill={A} />
          </g>
        ))}
      </>
    ),
    radar: (
      <>
        <polygon points="24,3 32.5,9.2 29.3,19.5 18.7,19.5 15.5,9.2" fill="none" stroke={M} strokeWidth="1.5" />
        <polygon points="24,6.5 29.2,10.3 27,16.5 21,16.5 18.8,10.3" fill={Q} stroke={A} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
  }
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" style={{ display: 'block' }} aria-hidden>
      {glyphs[type] || glyphs.bar}
    </svg>
  )
}

// ── Canvas-toolbar chip styles (Slate) ──────────────────────────────────────
const tbDivider = { width: 1, height: 18, background: 'var(--v-border)', flexShrink: 0 }
const tbChip = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 9px', background: 'transparent', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text-2)', font: '500 11px var(--v-font)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }
const tbBadge = { font: '600 8px var(--v-mono)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--v-amber)', background: 'var(--v-amber-quiet)', borderRadius: 2, padding: '1px 4px' }
const tbZoomBtn = { width: 24, height: 26, border: 'none', background: 'transparent', color: 'var(--v-text-2)', font: '600 14px var(--v-font)', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }
const tbToggle = (on) => ({ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 9px', background: on ? 'var(--v-accent-quiet)' : 'transparent', border: `1px solid ${on ? 'var(--v-accent-border)' : 'var(--v-border)'}`, borderRadius: 'var(--v-r)', color: on ? 'var(--v-accent)' : 'var(--v-text-muted)', font: '500 11px var(--v-font)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 })

// ── Output-chooser card styles (design-system tokens; modal is .vilsem-root) ──
const outputCardStyle = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 14, background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .12s, background .12s' }
const outputIconStyle = { width: 38, height: 38, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

export default function AppGenerator({ initialSpec = null, initialProjectId = null, initialProjectName = null, onBack = null, connectionInfo: externalConnInfo = null }) {
  const [description, setDescription]         = useState('')
  const [generating, setGenerating]           = useState(false)
  // Start null, then set from initialSpec after mount — this ensures
  // AppSpecRenderer's data-fetch useEffect fires on the spec CHANGE
  // (not just on initial render where it may miss the trigger).
  const [generatedSpec, setGeneratedSpec]     = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [aiStatus, setAiStatus]               = useState(null)
  const [measures, setMeasures]               = useState([])
  const [selectedProvider, setSelectedProvider] = useState('anthropic')
  const [selectedModel, setSelectedModel]       = useState('')
  const [availableModels, setAvailableModels]   = useState({ anthropic: [], openai: [], gemini: [], groq: [], local: [] })
  const [messages, setMessages]               = useState([])
  const [refinementInput, setRefinementInput] = useState('')
  // Chat mode — 'refine' (patch, default) or 'replace' (regenerate from scratch).
  // Only meaningful once a spec exists; pre-generation always replaces.
  const [chatMode, setChatMode]               = useState('refine')
  // Refine scope (mockup): 'visual' targets the selected visual, 'page'/'dashboard' the whole app.
  const [promptScope, setPromptScope]         = useState('page')
  const [promptDrop, setPromptDrop]           = useState(false)  // field drag hovering the prompt box
  const [promptOptionsOpen, setPromptOptionsOpen] = useState(false) // tucked model/page/mode controls
  const [showTemplates, setShowTemplates]     = useState(false) // template gallery (collapsed by default)
  // When user tries Replace with a spec loaded, show a confirm dialog before wiping.
  const [replaceConfirm, setReplaceConfirm]   = useState(null) // null | { prompt }
  const [appTitle, setAppTitle]               = useState(initialProjectName || initialSpec?.title || 'Untitled App')
  const [modeWarning, setModeWarning]         = useState(null)
  const [genInfo, setGenInfo]                 = useState(null)
  const [canvasWidth, setCanvasWidth]         = useState(900)
  // Phase 7 state
  const [chatCollapsed, setChatCollapsed]     = useState(false)
  const [modelCollapsed, setModelCollapsed]   = useState(false)  // left Model pane collapse
  // Held before a spec is generated. Once a spec exists, page size lives in
  // generatedSpec.layout and this is used as the source for handleGenerate's
  // LLM context.
  const [pendingPageSize, setPendingPageSize] = useState({
    preset: '16:9',
    width:  1280,
    height: 720,
  })
  const [currentPageId, setCurrentPageId]     = useState(null)
  const [renamingPageId, setRenamingPageId]   = useState(null)
  const [renameValue, setRenameValue]         = useState('')
  const [saving, setSaving]                   = useState(false)
  const [savedApps, setSavedApps]             = useState([])
  const [dimensions, setDimensions]           = useState([])
  const [slashMenu, setSlashMenu]             = useState(null) // { type, query, items, selectedIdx, anchor }
  const [savedAppsOpen, setSavedAppsOpen]     = useState(false)
  const [canvasTheme, setCanvasTheme]         = useState('dark') // 'dark' | 'light'
  const [editMode, setEditMode]               = useState(true)   // vilsem: canvas is always editable (no separate edit mode)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [selectedVisualId, setSelectedVisualId] = useState(null)
  const [presentMode, setPresentMode]         = useState(false)
  const [canvasZoom, setCanvasZoom]           = useState(1)     // canvas display scale (drag stays accurate — CanvasEditor divides deltas by zoom)
  const [autoFitCanvas, setAutoFitCanvas]     = useState(true)  // scale-to-fit the viewport until the user zooms manually
  const [snapOn, setSnapOn]                   = useState(true)  // show the alignment grid guides behind visuals
  const canvasScrollRef = useRef(null)                          // scroll viewport, measured on "Fit"
  const [exportDialog, setExportDialog]       = useState(null) // null or { tenantId, clientId, clientSecret, workspaceId, datasetId, authMode, prefill }
  const [outputChooser, setOutputChooser]     = useState(false) // S10 Export/Publish chooser
  const [fabricDialog, setFabricDialog]       = useState(null)  // Deploy-to-Fabric spike (feature-flagged, default OFF)
  // Publish-to-Power-BI dialog (Phase 3 of POWERBI_PARITY_MASTER_PLAN.md).
  // Shape: null | { reportName, stage, progress, reportId, error, publishing }
  const [pbiDialog, setPbiDialog] = useState(null)
  const [addVisualOpen, setAddVisualOpen]   = useState(false)
  const [addSlicerOpen, setAddSlicerOpen]   = useState(false)
  const [rightTab,      setRightTab]        = useState('prompt')  // 'prompt' | 'library'
  const [slicerSearch,  setSlicerSearch]    = useState('')
  // Playground Spike — custom-visual templates (dataset-scoped) + overlay toggle
  const [customTemplates, setCustomTemplates] = useState([])
  const [showPlayground,   setShowPlayground] = useState(false)
  const [pgDatasetId,      setPgDatasetId]    = useState('')
  const [saveAsDialog, setSaveAsDialog] = useState(null) // null | { name }
  const [sessionUsage, setSessionUsage]       = useState({ totalTokens: 0, estimatedCost: 0, callCount: 0 })
  // Master ECharts toggle — defaults ON post-Phase 4 (close-out 2026-04-25).
  // Now an opt-OUT switch: clicking it sets all per-visual flags to 'false' to
  // roll back to Recharts; clicking again removes the entries (back to default ON).
  // The dual-path + this toggle are both deleted in Phase 6.
  const ECHARTS_FLAG_KEYS = ['useEchartsBar', 'useEchartsRadar', 'useEchartsScatter', 'useEchartsBubble', 'useEchartsTreemap', 'useEchartsDonut', 'useEchartsLine']
  const [echartsBarOn, setEchartsBarOn]       = useState(() => {
    // ON unless ANY flag is explicitly 'false' (matches readEchartsFlag semantics)
    try { return !ECHARTS_FLAG_KEYS.some(k => localStorage.getItem(`semantica.flags.${k}`) === 'false') } catch { return true }
  })

  const textareaRef  = useRef(null)
  const refineRef    = useRef(null)
  const canvasRef    = useRef(null)
  const messagesEnd  = useRef(null)

  const activeProviderMeta = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0]

  // Escape key exits presentation mode
  // Load initialSpec AFTER mount so AppSpecRenderer's data-fetch useEffect
  // fires on the state change (not silently on initial render).
  useEffect(() => {
    if (initialSpec && !generatedSpec) {
      const t = setTimeout(() => {
        const savedMessages = initialSpec._chatMessages || []
        const cleanSpec = { ...initialSpec }
        delete cleanSpec._chatMessages
        const pagedSpec = ensurePages(cleanSpec)
        const firstPage = getPages(pagedSpec)[0]
        setGeneratedSpec(pagedSpec)
        setCurrentPageId(firstPage?.id || null)
        if (cleanSpec.title && !initialProjectName) setAppTitle(cleanSpec.title)
        if (cleanSpec.theme?.mode) setCanvasTheme(cleanSpec.theme.mode)
        if (savedMessages.length > 0) setMessages(savedMessages)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [initialSpec])

  useEffect(() => {
    if (!presentMode) return
    const handler = (e) => { if (e.key === 'Escape') setPresentMode(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [presentMode])

  // Publish canvas state to the shell's left-rail panes (Layers).
  useEffect(() => {
    setCanvasState({ spec: generatedSpec, currentPageId, selectedId: selectedVisualId, onSelect: setSelectedVisualId })
  }, [generatedSpec, currentPageId, selectedVisualId])
  useEffect(() => () => clearCanvasState(), [])

  // Load premium Google Fonts
  useEffect(() => {
    const id = 'ag-premium-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id; link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${PREMIUM_FONTS.map(f => `${f.replace(/ /g, '+')}:wght@400;600;700`).join('&family=')}&display=swap`
    document.head.appendChild(link)
  }, [])

  // Canvas width measurement
  useEffect(() => {
    if (!canvasRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w > 0) setCanvasWidth(w - 16)
    })
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  // Load AI status + measures
  useEffect(() => {
    if (!window.semantica) return
    window.semantica.getAiStatus().then(s => setAiStatus(s)).catch(() => {})
    window.semantica.getMeasures().then(m => setMeasures(m?.measures || [])).catch(() => {})
    window.semantica.getDimensions().then(d => setDimensions(d?.tables || [])).catch(() => {})
    // Playground Spike — resolve datasetId then load saved custom-visual templates
    window.semantica.getWorkspaceConfig?.().then(ws => {
      const id = ws?.datasetId || ''
      setPgDatasetId(id)
      if (id) window.semantica.loadCustomTemplates?.({ datasetId: id }).then(list => setCustomTemplates(list || [])).catch(() => {})
    }).catch(() => {})
  }, [])

  // Playground Spike — reload templates after a save
  const reloadCustomTemplates = useCallback(async () => {
    if (!pgDatasetId || !window.semantica?.loadCustomTemplates) return
    try { setCustomTemplates((await window.semantica.loadCustomTemplates({ datasetId: pgDatasetId })) || []) } catch {}
  }, [pgDatasetId])

  const loadSavedApps = useCallback(async () => {
    if (!window.semantica?.getWorkspaceConfig || !window.semantica?.getAppSpecs) return
    try {
      const workspace = await window.semantica.getWorkspaceConfig()
      if (!workspace?.datasetId) {
        setSavedApps([])
        return
      }
      const apps = await window.semantica.getAppSpecs({ datasetId: workspace.datasetId })
      setSavedApps(apps || [])
    } catch {
      setSavedApps([])
    }
  }, [])

  useEffect(() => {
    loadSavedApps()
  }, [loadSavedApps])

  // Provider warning — selected provider has no API key configured (local needs model file)
  useEffect(() => {
    if (!aiStatus) { setModeWarning(null); return }
    if (selectedProvider === 'local') {
      if (!aiStatus.local?.configured) {
        setModeWarning('Local model not found. Place microsoft_Phi-4-mini-instruct-Q4_K_M.gguf in the models/ folder and restart, or check Local AI in Settings.')
      } else {
        setModeWarning(null)
      }
    } else if (!aiStatus[activeProviderMeta.statusKey]?.configured) {
      setModeWarning(`${activeProviderMeta.label} is not configured. Add an API key in Health → AI Settings (auto-fallback will try other providers).`)
    } else {
      setModeWarning(null)
    }
  }, [selectedProvider, aiStatus, activeProviderMeta])

  // Load available models per provider + set a sensible default
  useEffect(() => {
    if (!window.semantica?.getAiModels) return
    window.semantica.getAiModels().then(models => {
      setAvailableModels(models || {})
    }).catch(() => {})
  }, [])

  // When provider changes, reset model to the first available for that provider
  useEffect(() => {
    const list = availableModels[selectedProvider] || []
    if (!list.length) { setSelectedModel(''); return }
    const modelIds = list.map(m => typeof m === 'string' ? m : (m.id || m.name || m.model))
    if (!modelIds.includes(selectedModel)) setSelectedModel(modelIds[0])
  }, [selectedProvider, availableModels])  // eslint-disable-line react-hooks/exhaustive-deps

  // Pick a default provider that's actually configured (prefer current, else first configured)
  // Local provider is "configured" when the model file is present (no API key needed)
  useEffect(() => {
    if (!aiStatus) return
    const currentConfigured = selectedProvider === 'local'
      ? aiStatus.local?.configured
      : aiStatus[activeProviderMeta.statusKey]?.configured
    if (currentConfigured) return
    const firstConfigured = PROVIDERS.find(p =>
      p.id === 'local' ? aiStatus.local?.configured : aiStatus[p.statusKey]?.configured
    )
    if (firstConfigured) setSelectedProvider(firstConfigured.id)
  }, [aiStatus])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat to bottom
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, generating])

  // Delegate to the app-level toast provider (mounted in main.jsx). Keep the
  // (message, type) signature so existing call sites are unchanged.
  const pushToast = useToast()
  const addToast = useCallback((message, type = 'success') => {
    pushToast(message, { type: type === 'error' ? 'error' : 'success' })
  }, [pushToast])

  const handleTemplateApply = useCallback((spec, tpl) => {
    setGeneratedSpec(spec)
    setAppTitle(spec.title || tpl.label)
    if (spec.theme?.mode) setCanvasTheme(spec.theme.mode)
    setMessages([{
      id: Date.now(),
      type: 'ai',
      content: `${tpl.label} template applied`,
      spec,
      visualCount: spec.visuals?.length || 0,
      slicerCount: spec.slicers?.length || 0,
      provider: 'template',
      model: tpl.id,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      usage: null,
    }])
  }, [])

  // ── Add Visual / Add Slicer ──────────────────────────────────────────────────
  const VISUAL_PALETTE = [
    { type: 'kpi',         label: 'KPI',         w: 3, h: 2 },
    { type: 'gauge',       label: 'Gauge',        w: 3, h: 2 },
    { type: 'bar',         label: 'Bar',          w: 6, h: 4 },
    { type: 'line',        label: 'Line',         w: 6, h: 4 },
    { type: 'area',        label: 'Area',         w: 6, h: 4 },
    { type: 'donut',       label: 'Donut',        w: 4, h: 4 },
    { type: 'scatter',     label: 'Scatter',      w: 6, h: 5 },
    { type: 'table',       label: 'Table',        w: 6, h: 4 },
    { type: 'waterfall',   label: 'Waterfall',    w: 6, h: 4 },
    { type: 'treemap',     label: 'Treemap',      w: 6, h: 4 },
    { type: 'grouped_bar', label: 'Grouped Bar',  w: 6, h: 4 },
    { type: 'stacked_bar', label: 'Stacked Bar',  w: 6, h: 4 },
    { type: 'stacked_area',label: 'Stacked Area', w: 6, h: 4 },
    { type: 'lollipop',    label: 'Lollipop',     w: 6, h: 4 },
    { type: 'radar',       label: 'Radar',        w: 5, h: 4 },
    { type: 'bar_race',    label: 'Bar Race',     w: 6, h: 5 },
  ]

  // ── Multi-page helpers ────────────────────────────────────────────────────
  function getPages(spec) {
    if (!spec) return []
    if (Array.isArray(spec.pages) && spec.pages.length > 0) return spec.pages
    return [{ id: 'page_1', name: spec.title || 'Page 1', visuals: spec.visuals || [], slicers: spec.slicers || [] }]
  }
  function getCurrentPage(spec, pageId) {
    const pages = getPages(spec)
    return pages.find(p => p.id === pageId) || pages[0] || null
  }
  function ensurePages(spec) {
    if (!spec) return spec
    if (Array.isArray(spec.pages) && spec.pages.length > 0) return spec
    return { ...spec, pages: [{ id: 'page_1', name: spec.title || 'Page 1', visuals: spec.visuals || [], slicers: spec.slicers || [] }], visuals: undefined, slicers: undefined }
  }
  function mergePageResult(fullSpec, pageId, resultSpec) {
    const pages = getPages(fullSpec).map(p =>
      p.id === pageId
        ? { ...p, visuals: resultSpec.visuals || [], slicers: resultSpec.slicers || [] }
        : p
    )
    return { ...fullSpec, pages, visuals: undefined, slicers: undefined, theme: resultSpec.theme || fullSpec.theme }
  }
  function addPage() {
    if (!generatedSpec) return
    const pages = getPages(generatedSpec)
    const newId = `page_${Date.now()}`
    const newPage = { id: newId, name: `Page ${pages.length + 1}`, visuals: [], slicers: [] }
    setGeneratedSpec(ensurePages({ ...generatedSpec, pages: [...pages, newPage] }))
    setCurrentPageId(newId)
    setSelectedVisualId(null)
  }
  function deletePage(pageId) {
    if (!generatedSpec) return
    const pages = getPages(generatedSpec).filter(p => p.id !== pageId)
    if (!pages.length) return
    setGeneratedSpec({ ...generatedSpec, pages })
    if (currentPageId === pageId) setCurrentPageId(pages[0].id)
    setSelectedVisualId(null)
  }
  function renamePage(pageId, newName) {
    if (!generatedSpec || !newName?.trim()) return
    const pages = getPages(generatedSpec).map(p => p.id === pageId ? { ...p, name: newName.trim() } : p)
    setGeneratedSpec({ ...generatedSpec, pages })
  }

  const handleAddVisual = useCallback((type, w, h) => {
    if (!generatedSpec) return
    const curPage = getCurrentPage(generatedSpec, currentPageId)
    const curVisuals = curPage?.visuals || []
    const nextY = curVisuals.reduce((m, v) => Math.max(m, (v.position?.y ?? 0) + (v.position?.h ?? 0)), 0)
    const id = `v_${Date.now().toString(36)}`
    const newVisual = { id, type, position: { x: 0, y: nextY, w, h }, data: { measures: [], groupBy: null, orderBy: 'desc', limit: 10 }, config: { title: `New ${type}` } }
    setGeneratedSpec(prev => {
      const pages = getPages(prev).map(p =>
        p.id === (currentPageId || getPages(prev)[0]?.id)
          ? { ...p, visuals: [...(p.visuals || []), newVisual] }
          : p
      )
      return { ...prev, pages, visuals: undefined, slicers: undefined }
    })
    setSelectedVisualId(id)
    setAddVisualOpen(false)
    if (!editMode) setEditMode(true)
  }, [generatedSpec, currentPageId, editMode])

  // Library tab: add a visual manually. Seeds an empty page/spec if the canvas
  // is blank so you can build without prompting.
  const addFromLibrary = useCallback((type, w, h) => {
    if (generatedSpec) { handleAddVisual(type, w, h); return }
    const id = `v_${Date.now().toString(36)}`
    const newVisual = { id, type, position: { x: 0, y: 0, w, h }, data: { measures: [], groupBy: null, orderBy: 'desc', limit: 10 }, config: { title: `New ${type}` } }
    setGeneratedSpec({
      version: '1.0', title: appTitle || 'Untitled',
      theme: { mode: canvasTheme },
      layout: { pagePreset: '16:9' },
      pages: [{ id: 'page_1', name: 'Page 1', visuals: [newVisual], slicers: [] }],
    })
    setCurrentPageId('page_1')
    setSelectedVisualId(id)
  }, [generatedSpec, handleAddVisual, appTitle, canvasTheme])

  // Playground Spike — add a custom-template visual to the canvas. Registers the
  // template into spec.customVisuals (so it exports) and creates an instance with
  // EMPTY data (the user rebinds to their own fields — the slot contract is what
  // was saved, not the authoring instance). Seeds a blank spec if the canvas is empty.
  const addCustomFromLibrary = useCallback((template, w = 5, h = 4) => {
    const tid = template?.meta?.id
    if (!tid) return
    const id = `v_${Date.now().toString(36)}`
    const newVisual = { id, type: 'custom', customTemplateId: tid,
      position: { x: 0, y: 0, w, h },
      data: { measures: [], groupBy: null, orderBy: 'desc', limit: 50 },
      config: { title: template.meta.name || 'Custom' } }
    setGeneratedSpec(prev => {
      if (!prev) {
        return {
          version: '1.0', title: appTitle || 'Untitled', theme: { mode: canvasTheme },
          layout: { pagePreset: '16:9' }, customVisuals: { [tid]: template },
          pages: [{ id: 'page_1', name: 'Page 1', visuals: [newVisual], slicers: [] }],
        }
      }
      const curId = currentPageId || getPages(prev)[0]?.id
      const nextY = (getCurrentPage(prev, curId)?.visuals || []).reduce((m, v) => Math.max(m, (v.position?.y ?? 0) + (v.position?.h ?? 0)), 0)
      newVisual.position.y = nextY
      const pages = getPages(prev).map(p => p.id === curId ? { ...p, visuals: [...(p.visuals || []), newVisual] } : p)
      return { ...prev, customVisuals: { ...(prev.customVisuals || {}), [tid]: template }, pages, visuals: undefined, slicers: undefined }
    })
    if (!generatedSpec) setCurrentPageId('page_1')
    setSelectedVisualId(id)
    if (!editMode) setEditMode(true)
  }, [generatedSpec, currentPageId, appTitle, canvasTheme, editMode])

  const handleAddSlicer = useCallback((table, column, dataType) => {
    if (!generatedSpec) return
    const id = `s_${Date.now().toString(36)}`
    const isDate = dataType && (dataType.toLowerCase().includes('date') || dataType.toLowerCase().includes('datetime'))
    const DEFAULT_W = 4
    setGeneratedSpec(prev => {
      const activeId = currentPageId || getPages(prev)[0]?.id
      const pages = getPages(prev).map(p => {
        if (p.id !== activeId) return p
        const existingSlicers = p.slicers || []
        let newX = 0, newY = 0
        if (existingSlicers.length > 0) {
          const maxY = Math.max(...existingSlicers.map(s => s.position?.y ?? 0))
          const onLastRow = existingSlicers.filter(s => (s.position?.y ?? 0) === maxY)
          const rightEdge = Math.max(...onLastRow.map(s => (s.position?.x ?? 0) + (s.position?.w ?? DEFAULT_W)))
          if (rightEdge + DEFAULT_W <= 12) { newX = rightEdge; newY = maxY }
          else { newX = 0; newY = maxY + 1 }
        }
        const newSlicer = {
          id, type: isDate ? 'date_range' : 'dropdown',
          dimension: { table, column },
          position: { x: newX, y: newY, w: DEFAULT_W, h: 1 },
          config: { title: column },
        }
        const prevRows = existingSlicers.length === 0 ? 0 : Math.max(...existingSlicers.map(s => s.position?.y ?? 0)) + 1
        const newRows  = newY + 1
        const rowsAdded = Math.max(0, newRows - prevRows)
        return {
          ...p,
          slicers: [...existingSlicers, newSlicer],
          visuals: rowsAdded > 0
            ? (p.visuals || []).map(v => ({ ...v, position: { ...v.position, y: (v.position?.y ?? 0) + rowsAdded } }))
            : (p.visuals || []),
        }
      })
      return { ...prev, pages, visuals: undefined, slicers: undefined }
    })
    setAddSlicerOpen(false)
    setSlicerSearch('')
  }, [generatedSpec, currentPageId])

  // Flat list of available dimension columns for Add Slicer dropdown
  const slicerColumnOptions = useMemo(() => {
    const opts = []
    for (const tbl of dimensions) {
      if (tbl.tableType === 'measure_group') continue
      for (const col of (tbl.columns || [])) {
        if (col.isHidden || col.isKey) continue
        const dt = (col.dataType || '').toLowerCase()
        if (dt === 'string' || dt.startsWith('str') || col.isCategory || col.isDate || dt.includes('date')) {
          const isDate = col.isDate || dt.includes('date') || dt.includes('datetime')
          opts.push({ table: tbl.name, column: col.name, dataType: col.dataType, isDate, label: `${tbl.name} › ${col.name}` })
        }
      }
    }
    return opts
  }, [dimensions])

  function getQuickPrompts() {
    const first  = measures[0]?.name || 'key metrics'
    const second = measures[1]?.name || 'performance'
    return [
      { icon: '📊', label: 'Exec',    prompt: `Executive dashboard: ${first} and ${second} as KPIs, trend line chart, comparison bar chart. Dark theme.` },
      { icon: '🔄', label: 'Compare', prompt: `Comparison page: show ${first} side by side with a dropdown filter and radar chart.` },
      { icon: '📈', label: 'Trends',  prompt: `Trend analysis for ${first}: large area chart with summary KPI and breakdown bar chart by category.` },
      { icon: '🎯', label: 'KPIs',    prompt: `KPI overview: top ${Math.min(measures.length, 4) || 4} metrics as cards with dropdown filter slicers.` },
    ]
  }

  async function handleGenerate() {
    const text = description.trim()
    if (!text || !aiStatus?.anyConfigured || generating) return

    const userMsgId = Date.now()
    setMessages(prev => [...prev, { id: userMsgId, type: 'user', content: text, timestamp: new Date().toLocaleTimeString() }])
    setGenerating(true)

    try {
      const result = await window.semantica.generateAppSpec({
        userDescription:   text,
        provider:          selectedProvider,
        model:             selectedModel,
        currentSpec:       null,
        // Phase 7d — send the selected page size so the LLM lays out visuals
        // to fit (and so the returned spec carries layout.pagePreset forward).
        pageSize: {
          preset: pendingPageSize.preset,
          width:  pendingPageSize.width,
          height: pendingPageSize.height,
        },
      })

      const spec = result?.spec
      if (!spec) throw new Error('No spec returned from AI')

      const validation = validateAppSpec(spec)
      if (!validation.valid) throw new Error(validation.errors[0] || 'Generated spec failed validation')
      setDescription('')
      if (appTitle && appTitle !== 'Untitled App') {
        spec.title = appTitle
      } else if (spec.title) {
        setAppTitle(spec.title)
      }

      // Merge result into current page (or create first page if no spec yet)
      let newFullSpec
      if (generatedSpec) {
        const activePageId = currentPageId || getPages(generatedSpec)[0]?.id || 'page_1'
        newFullSpec = mergePageResult(generatedSpec, activePageId, spec)
      } else {
        newFullSpec = ensurePages(spec)
        setCurrentPageId(getPages(newFullSpec)[0]?.id || 'page_1')
      }
      setGeneratedSpec(newFullSpec)
      setValidationResult(validation)
      setGenInfo({ provider: result.provider, model: result.model })
      accumulateUsage(result.usage)

      setMessages(prev => [...prev, {
        id: Date.now(), type: 'ai',
        content: spec.title || 'Analytics Dashboard',
        spec, provider: result.provider, model: result.model,
        usage: result.usage || null,
        visualCount: spec.visuals?.length || 0,
        slicerCount: spec.slicers?.length || 0,
        timestamp: new Date().toLocaleTimeString(),
      }])
      await loadSavedApps()
    } catch (err) {
      const msg = err.message || 'Generation failed'
      setMessages(prev => [...prev, { id: Date.now(), type: 'error', content: msg, timestamp: new Date().toLocaleTimeString() }])
    } finally {
      setGenerating(false)
    }
  }

  /**
   * Single refine pipeline — used by both chat-level refinement (no scope)
   * and visual-level inspector refinement (scopedVisualId set).
   *
   * Both callers see the same chat-message trail, same validation, same
   * usage accumulation. The only difference is whether the LLM prompt is
   * scoped to a specific visual's config.
   */
  async function refineSpec({ prompt, scopedVisualId = null }) {
    const userRequest = (prompt || '').trim()
    if (!userRequest || !generatedSpec || generating) return

    // Extract current page slice to send to LLM (single-page view)
    const activePage = getCurrentPage(generatedSpec, currentPageId)
    const activePageId = activePage?.id || 'page_1'
    const pageSlice = activePage
      ? { ...generatedSpec, visuals: activePage.visuals || [], slicers: activePage.slicers || [] }
      : generatedSpec

    let effectiveRequest = userRequest
    let scopedVisualType = null
    if (scopedVisualId) {
      const visIdx = (pageSlice.visuals || []).findIndex(v => v.id === scopedVisualId)
      scopedVisualType = (pageSlice.visuals || [])[visIdx]?.type || 'visual'
      const visualRef = visIdx >= 0 ? `/visuals/${visIdx}` : ''
      effectiveRequest = `Change this ${scopedVisualType} visual: ${userRequest}. Only patch ${visualRef}/config properties.`
    }

    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      content: scopedVisualId ? `[${scopedVisualType}] ${userRequest}` : userRequest,
      timestamp: new Date().toLocaleTimeString(),
    }])
    setGenerating(true)
    let refineOk = false

    try {
      const result = await window.semantica.patchAppSpec({
        currentSpec: pageSlice,
        userRequest: effectiveRequest,
        provider: selectedProvider,
        model:    selectedModel,
      })

      const { patches, provider, normalizedSpec, usage: patchUsage } = result

      if ((!patches || patches.length === 0) && !normalizedSpec) {
        throw new Error('No changes identified. Try being more specific, e.g. "make bars gold color".')
      }

      // Apply patches to the page slice (not the full multi-page spec)
      const patchedSpec = normalizedSpec || applyJsonPatch(pageSlice, patches)

      // Repair any slicer whose dimension came back as a string "Table[Column]"
      if (patchedSpec.slicers) {
        patchedSpec.slicers = patchedSpec.slicers.map(s => {
          if (typeof s.dimension === 'string') {
            const match = s.dimension.match(/^(.+)\[(.+)\]$/)
            if (match) return { ...s, dimension: { table: match[1].trim(), column: match[2].trim() } }
            return null
          }
          if (!s.dimension?.table || !s.dimension?.column) return null
          return s
        }).filter(Boolean)
      }
      const updatedPageSpec = patchedSpec

      // Safety: never allow all visuals to be removed from current page
      if (!updatedPageSpec.visuals?.length) {
        throw new Error('Patch would remove all visuals. Change rejected.')
      }

      const validation = validateAppSpec(updatedPageSpec)
      if (!validation.valid) throw new Error(validation.errors[0] || 'Patched spec failed validation')
      refineOk = true

      // Merge updated page back into full multi-page spec
      const updatedFullSpec = mergePageResult(generatedSpec, activePageId, updatedPageSpec)
      setGeneratedSpec(updatedFullSpec)
      setValidationResult(validation)
      setGenInfo(prev => ({ ...prev, provider: provider || 'auto' }))
      accumulateUsage(patchUsage)

      setMessages(prev => [...prev, {
        id: Date.now(), type: 'ai',
        content: normalizedSpec && !patches.length ? 'Updated' : `Applied ${patches.length} change${patches.length !== 1 ? 's' : ''}`,
        spec: updatedPageSpec,
        provider: provider || 'auto',
        model: 'patch',
        usage: patchUsage ? { combined: patchUsage } : null,
        visualCount: updatedPageSpec.visuals?.length || 0,
        slicerCount: updatedPageSpec.slicers?.length || 0,
        timestamp: new Date().toLocaleTimeString(),
      }])
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now(), type: 'error', content: err.message || 'Refinement failed', timestamp: new Date().toLocaleTimeString() }])
    } finally {
      setGenerating(false)
    }
    return refineOk
  }

  // Chat-level refine — thin wrapper that routes to the unified pipeline.
  // Returns boolean success so the caller can keep the prompt on failure.
  async function handleRefine() {
    const ok = await refineSpec({ prompt: refinementInput, scopedVisualId: null })
    if (ok) setRefinementInput('')
    return ok
  }

  // ── Output flows (S10 chooser opens these) ────────────────────────────────
  async function openExportDialog() {
    try {
      const ws = await window.semantica.getWorkspaceConfig()
      const savedWs = window.semantica.getSavedWorkspaces ? await window.semantica.getSavedWorkspaces() : []
      const active = savedWs?.find?.(w => w.datasetId === ws?.datasetId)
      const authMode = active?.authMode || 'service_principal'
      setExportDialog({
        authMode,
        tenantId: active?.tenantId || ws?.tenantId || '',
        clientId: active?.clientId || ws?.clientId || '',
        clientSecret: '',
        workspaceId: ws?.workspaceId || '',
        datasetId: ws?.datasetId || '',
        prefill: authMode === 'service_principal',
        exportFolderName: (appTitle || 'app').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'app',
      })
    } catch {
      setExportDialog({ authMode: 'unknown', tenantId: '', clientId: '', clientSecret: '', workspaceId: '', datasetId: '', prefill: false, exportFolderName: (appTitle || 'app').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'app' })
    }
  }
  function openPbiDialog() {
    setPbiDialog({ reportName: generatedSpec?.title || 'App Generator Report', stage: '', progress: 0, publishing: false, reportId: null, error: null })
  }

  async function handleSave() {
    if (!generatedSpec || saving) return
    setSaving(true)
    try {
      const workspace = await window.semantica.getWorkspaceConfig()
      if (!workspace?.datasetId) throw new Error('No active workspace')
      // Save spec + chat messages together. Messages are stored as
      // _chatMessages on the spec object (stripped on load so it doesn't
      // pollute the spec used for rendering/publishing).
      const specWithChat = {
        ...generatedSpec,
        theme: { ...(generatedSpec?.theme || {}), mode: canvasTheme || 'dark' },
        _chatMessages: messages.filter((m) => m.type === 'user' || m.type === 'ai').slice(-50),
      }
      await window.semantica.saveAppSpec({
        name: appTitle || generatedSpec.title || 'App',
        datasetId: workspace.datasetId,
        spec: specWithChat,
      })
      await loadSavedApps()
      addToast('✓ App saved')
    } catch (err) {
      addToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleLoadSavedApp(savedApp) {
    if (!savedApp?.spec) return
    const validation = validateAppSpec(savedApp.spec)
    if (!validation.valid) {
      addToast(validation.errors[0] || 'Saved app is invalid', 'error')
      return
    }
    const pagedSpec = ensurePages(savedApp.spec)
    const firstPage = getPages(pagedSpec)[0]
    setGeneratedSpec(pagedSpec)
    setCurrentPageId(firstPage?.id || null)
    setValidationResult(validation)
    setAppTitle(savedApp.name || savedApp.spec.title || 'App')
    setGenInfo({ provider: 'local', model: 'saved' })
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'ai',
      content: `Loaded ${savedApp.name || savedApp.spec.title || 'saved app'}`,
      spec: savedApp.spec,
      provider: 'local',
      model: 'saved',
      visualCount: firstPage?.visuals?.length || savedApp.spec.visuals?.length || 0,
      slicerCount: firstPage?.slicers?.length || savedApp.spec.slicers?.length || 0,
      timestamp: new Date().toLocaleTimeString(),
    }])
  }

  async function handleDeleteSavedApp(id) {
    try {
      await window.semantica.deleteAppSpec({ id })
      setSavedApps(prev => prev.filter(app => app.id !== id))
      addToast('Saved app deleted')
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error')
    }
  }

  function handleNewApp() {
    setGeneratedSpec(null)
    setValidationResult(null)
    setAppTitle('Untitled App')
    setDescription('')
    setRefinementInput('')
    setGenInfo(null)
    setSessionUsage({ totalTokens: 0, estimatedCost: 0, callCount: 0 })
  }

  // ── Slash autocomplete ────────────────────────────────────────────────────────
  const measureItems = useMemo(() =>
    measures.map(m => ({ label: m.name, insert: `"${m.name}"` })), [measures])

  const dimensionItems = useMemo(() => {
    const items = []
    for (const t of dimensions) {
      for (const col of (t.columns || [])) {
        items.push({ label: `${t.name}[${col.name}]`, insert: `${t.name}[${col.name}]` })
      }
    }
    return items
  }, [dimensions])

  function detectSlash(text, cursorPos) {
    const before = text.slice(0, cursorPos)
    // Allow spaces in the query so multi-word field names ("Total Returns")
    // don't dismiss the menu. Query = everything after "/m " up to the cursor,
    // excluding a slash (which would start a new token) or a newline.
    const match = before.match(/\/([md]) ?([^/\n]*)$/)
    if (!match) return null
    return { type: match[1], query: match[2].toLowerCase().trim(), matchStart: cursorPos - match[0].length }
  }

  function getSlashItems(type, query) {
    const all = type === 'm' ? measureItems : dimensionItems
    if (!query) return all.slice(0, 50)
    return all.filter(item => item.label.toLowerCase().includes(query)).slice(0, 50)
  }

  function openSlashMenu(text, cursorPos, anchor) {
    const detected = detectSlash(text, cursorPos)
    if (detected) {
      const items = getSlashItems(detected.type, detected.query)
      if (items.length > 0) { setSlashMenu({ ...detected, items, selectedIdx: 0, anchor }); return }
    }
    setSlashMenu(null)
  }

  function insertSlashItem(item) {
    if (!item || !slashMenu) return
    const anchor = slashMenu.anchor
    const inputRef = anchor === 'main' ? textareaRef : refineRef
    const getText  = anchor === 'main' ? () => description     : () => refinementInput
    const setText  = anchor === 'main' ? setDescription        : setRefinementInput

    const text   = getText()
    const cursor = inputRef.current?.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const match  = before.match(/\/[md]\w*$/)
    if (!match) { setSlashMenu(null); return }
    const start   = cursor - match[0].length
    const newText = text.slice(0, start) + item.insert + text.slice(cursor)
    setText(newText)
    setSlashMenu(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const pos = start + item.insert.length
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleDescriptionChange(e) {
    setDescription(e.target.value)
    openSlashMenu(e.target.value, e.target.selectionStart, 'main')
  }

  function handleDescriptionKeyDown(e) {
    if (slashMenu?.anchor === 'main') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashMenu(p => ({ ...p, selectedIdx: Math.min(p.selectedIdx + 1, p.items.length - 1) })); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashMenu(p => ({ ...p, selectedIdx: Math.max(p.selectedIdx - 1, 0) })); return }
      if (e.key === 'Escape')    { e.preventDefault(); setSlashMenu(null); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertSlashItem(slashMenu.items[slashMenu.selectedIdx]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSubmit()
    }
  }

  // Unified chat submit — routes to refine or replace based on chatMode + spec state.
  async function handleChatSubmit() {
    const text = description.trim()
    if (!text || generating) return
    // Pre-generation: always goes through the generate path regardless of mode.
    if (!generatedSpec) { handleGenerate(); return }
    if (chatMode === 'refine') {
      const scopedId = promptScope === 'visual' ? selectedVisualId : null
      const ok = await refineSpec({ prompt: text, scopedVisualId: scopedId })
      if (ok) setDescription('')
      return
    }
    // Replace mode with existing spec — confirm before wiping the canvas.
    setReplaceConfirm({ prompt: text })
  }

  // Drop a model field onto the prompt box → pin its reference into the text.
  function handlePromptFieldDrop(e) {
    e.preventDefault(); setPromptDrop(false)
    try {
      const raw = e.dataTransfer.getData('application/x-vilsem-field') || e.dataTransfer.getData('text/plain') || '{}'
      const f = JSON.parse(raw)
      let ref = ''
      if (f.kind === 'measure') ref = `[${f.name}]`
      else if (f.kind === 'column' && f.table && f.column) ref = `${f.table}[${f.column}]`
      if (ref) { setDescription(d => (d ? `${d} ${ref}` : ref)); textareaRef.current?.focus() }
    } catch { /* ignore malformed drops */ }
  }

  async function confirmReplace() {
    const prompt = replaceConfirm?.prompt
    setReplaceConfirm(null)
    if (!prompt) return
    // Regenerate — handleGenerate reads from `description` state
    await handleGenerate()
  }

  function handleRefineChange(e) {
    setRefinementInput(e.target.value)
    openSlashMenu(e.target.value, e.target.selectionStart, 'refine')
  }

  function handleRefineKeyDown(e) {
    if (slashMenu?.anchor === 'refine') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashMenu(p => ({ ...p, selectedIdx: Math.min(p.selectedIdx + 1, p.items.length - 1) })); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashMenu(p => ({ ...p, selectedIdx: Math.max(p.selectedIdx - 1, 0) })); return }
      if (e.key === 'Escape')    { e.preventDefault(); setSlashMenu(null); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertSlashItem(slashMenu.items[slashMenu.selectedIdx]); return }
    }
    if (e.key === 'Enter') handleRefine()
  }

  const canGenerate = !generating && description.trim() && aiStatus?.anyConfigured

  // ── Edit mode helpers ──────────────────────────────────────────────────────
  const _activePage = generatedSpec ? getCurrentPage(generatedSpec, currentPageId) : null
  const _activePageSpec = _activePage
    ? { ...generatedSpec, visuals: _activePage.visuals || [], slicers: _activePage.slicers || [] }
    : generatedSpec
  const selectedVisual = editMode && selectedVisualId
    ? ((_activePageSpec?.visuals || []).find(v => v.id === selectedVisualId)
      || (_activePageSpec?.slicers || []).find(s => s.id === selectedVisualId))
    : null

  function editSpec(mutateFn) {
    if (!generatedSpec) return
    if (Array.isArray(generatedSpec.pages) && generatedSpec.pages.length > 0) {
      const activeId = currentPageId || generatedSpec.pages[0]?.id
      let nextLayout = generatedSpec.layout   // capture layout mutations (e.g. freeform:true on drag)
      const pages = generatedSpec.pages.map(p => {
        if (p.id !== activeId) return p
        const flatView = JSON.parse(JSON.stringify({ ...generatedSpec, visuals: p.visuals || [], slicers: p.slicers || [] }))
        mutateFn(flatView)
        nextLayout = flatView.layout
        return { ...p, visuals: flatView.visuals, slicers: flatView.slicers }
      })
      setGeneratedSpec({ ...generatedSpec, layout: nextLayout, pages })
    } else {
      const next = JSON.parse(JSON.stringify(generatedSpec))
      mutateFn(next)
      setGeneratedSpec(next)
    }
  }

  function accumulateUsage(usage) {
    const u = usage?.combined || usage
    if (!u) return
    setSessionUsage(prev => ({
      totalTokens:   prev.totalTokens   + (u.totalTokens   || 0),
      estimatedCost: prev.estimatedCost + (u.estimatedCost || 0),
      callCount:     prev.callCount + 1,
    }))
  }

  function editConfig(key, value) {
    if (!selectedVisualId) return
    editSpec(s => {
      const v = s.visuals.find(vi => vi.id === selectedVisualId)
      if (v) { if (!v.config) v.config = {}; v.config[key] = value; return }
      const sl = (s.slicers || []).find(si => si.id === selectedVisualId)
      if (sl) { if (!sl.config) sl.config = {}; sl.config[key] = value }
    })
  }

  function handleDeleteVisual() {
    if (!selectedVisualId) return
    editSpec(s => { s.visuals = s.visuals.filter(v => v.id !== selectedVisualId) })
    setSelectedVisualId(null)
  }

  function handleDuplicateVisual() {
    if (!selectedVisual) return
    editSpec(s => {
      const clone = JSON.parse(JSON.stringify(selectedVisual))
      clone.id = `visual_dup_${Date.now()}`
      clone.position = { ...clone.position, y: (clone.position?.y || 0) + (clone.position?.h || 3) }
      if (clone.config?.title) clone.config.title += ' (copy)'
      s.visuals.push(clone)
    })
  }



  // ── Presentation mode ─────────────────────────────────────────────────────
  if (presentMode && generatedSpec) {
    return (
      <div className="ag-present-root" style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: canvasTheme === 'dark' ? '#0b0b12' : '#F1F5F9',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Floating toolbar — fades on inactivity */}
        <div className="ag-present-bar" style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9010, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-overlay)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
          padding: '6px 12px', boxShadow: 'var(--shadow-lg)', transition: 'opacity 0.3s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
        >
          <Sparkles size={14} color="var(--accent)" />
          <span style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(appTitle && appTitle !== 'Untitled App') ? appTitle : (generatedSpec.title || appTitle)}
          </span>
          <div style={{ width: 1, height: 18, background: 'var(--border-default)' }} />
          <IconButton size="sm" onClick={() => setCanvasTheme(t => t === 'dark' ? 'light' : 'dark')} title={`Canvas theme: ${canvasTheme}`}>
            {canvasTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => window.print()} iconLeft={<Download size={14} />}>Export</Button>
          <Button variant="danger" size="sm" onClick={() => setPresentMode(false)}>Exit</Button>
        </div>

        {/* Full-screen dashboard */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '60px 24px 24px' }}>
          <div style={{ width: '100%', maxWidth: 1200 }}>
            <AppSpecRenderer
              key={`asr-present-${echartsBarOn}`}
              spec={_activePageSpec}
              availableMeasures={measures}
              canvasWidth={Math.min(canvasWidth || 1200, 1200)}
              theme={canvasTheme}
              onNavigatePage={setCurrentPageId}
            />
          </div>
        </div>


        <style>{`
          @media print {
            .ag-present-bar { display: none !important; }
            .ag-present-root { position: static !important; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-base)', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ height: 52, flexShrink: 0, background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        {/* Left: navigation + project name */}
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} iconLeft={<ArrowLeft size={15} />}>Home</Button>
        )}
        <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
        <Input value={appTitle} onChange={e => setAppTitle(e.target.value)}
          placeholder="Project name…"
          style={{ minWidth: 200, flex: '0 1 360px', fontWeight: 600, background: 'transparent' }} />

        <div style={{ flex: 1 }} />

        {/* Center: view controls (only when spec exists). vilsem: no Edit toggle
            — the canvas is always editable; Present is the read-only view. */}
        {generatedSpec && (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedVisualId(null); setPresentMode(true) }} iconLeft={<Play size={14} />}>
              Present
            </Button>
            <IconButton size="sm" onClick={() => setCanvasTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={`Canvas theme: ${canvasTheme === 'dark' ? 'dark' : 'light'} (click to switch)`}>
              {canvasTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Right: actions */}
        {/* Phase 6 (2026-04-25): ECharts toggle hidden. Wrappers in
            visuals/index.js hardcode ECharts now; flag flipping no longer has
            an effect, so the toggle would be misleading. The button JSX is
            kept (wrapped in `false &&`) per the de-scoped Phase 6 directive
            "don't delete code, just sever the path". Re-enabling: change the
            wrappers in visuals/index.js back to readEchartsFlag(...) and
            change `false &&` below to `true &&`. */}
        {false && (
          <button
            onClick={() => {
              const next = !echartsBarOn
              try {
                for (const k of ECHARTS_FLAG_KEYS) {
                  if (next) localStorage.removeItem(`semantica.flags.${k}`)
                  else      localStorage.setItem(`semantica.flags.${k}`, 'false')
                }
              } catch {}
              setEchartsBarOn(next)
            }}
            title={`ECharts ON by default. Click to roll back to Recharts (covers ${ECHARTS_FLAG_KEYS.length} visuals + derivatives).`}
            style={{
              background: echartsBarOn ? 'rgba(94,234,212,0.12)' : 'transparent',
              border: `1px solid ${echartsBarOn ? 'rgba(94,234,212,0.35)' : 'rgba(255,255,255,0.1)'}`,
              color: echartsBarOn ? '#5EEAD4' : 'var(--v-text-faint)',
              borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ECharts {echartsBarOn ? '●' : '○'}
          </button>
        )}
        <Button variant="secondary" size="sm" onClick={handleSave} disabled={!generatedSpec || saving} loading={saving} iconLeft={<Save size={14} />}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => {
          if (!generatedSpec) { addToast('Generate a dashboard first', 'error'); return }
          setSaveAsDialog({ name: appTitle || 'My Dashboard' })
        }}>
          Save As
        </Button>
        {generatedSpec && (
          <Button variant="canvas" size="sm" iconLeft={<Upload size={14} />}
            title="Export or publish this dashboard"
            onClick={() => setOutputChooser(true)}>
            Export / Publish
          </Button>
        )}
      </div>

      {/* ── Body (vilsem mockup order: Model · Canvas · Prompt) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left Panel — Model explorer (collapsible) ── */}
        {modelCollapsed ? (
          <div style={{ order: -1, width: 28, minWidth: 28, flexShrink: 0, background: 'var(--v-bg-1)', borderRight: '1px solid var(--v-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
            <IconButton size="sm" onClick={() => setModelCollapsed(false)} title="Expand model"><ChevronRight size={16} /></IconButton>
            <div style={{ writingMode: 'vertical-rl', font: '600 10px var(--v-mono)', color: 'var(--v-text-muted)', marginTop: 10, letterSpacing: '.12em', textTransform: 'uppercase', userSelect: 'none' }}>Model</div>
          </div>
        ) : (
          <div style={{ order: -1, width: 264, minWidth: 264, flexShrink: 0, background: 'var(--v-bg-1)', borderRight: '1px solid var(--v-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px 0 14px', borderBottom: '1px solid var(--v-border)' }}>
              <span style={{ font: '600 11px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-2)', flex: 1 }}>Model</span>
              <IconButton size="sm" onClick={() => setModelCollapsed(true)} title="Collapse model"><ChevronLeft size={15} /></IconButton>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}><FieldsPanel /></div>
          </div>
        )}

        {/* ── Prompt panel — right (order:3) per mockup ── */}
        {chatCollapsed ? (
          <div style={{ order: 3, width: 28, minWidth: 28, flexShrink: 0, background: 'var(--surface-sunken)', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
            <IconButton size="sm" onClick={() => setChatCollapsed(false)} title="Expand prompt panel"><ChevronLeft size={16} /></IconButton>
            <div style={{ writingMode: 'vertical-rl', fontSize: 10, color: 'var(--text-muted)', marginTop: 12, letterSpacing: 1.4, textTransform: 'uppercase', userSelect: 'none' }}>Prompt</div>
          </div>
        ) : (
        <div style={{ order: 3, width: 340, minWidth: 340, flexShrink: 0, background: 'var(--surface-raised)', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Prompt | Library tabs (mockup S6) + collapse chevron */}
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--v-border)', alignItems: 'stretch' }}>
            {['prompt', 'library'].map(t => (
              <button key={t} onClick={() => setRightTab(t)} style={{
                flex: 1, padding: '9px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                font: '600 12px var(--v-font)', textTransform: 'capitalize',
                color: rightTab === t ? 'var(--v-text)' : 'var(--v-text-muted)',
                borderBottom: `2px solid ${rightTab === t ? 'var(--v-accent)' : 'transparent'}`,
              }}>{t}</button>
            ))}
            <button onClick={() => setChatCollapsed(true)} title="Collapse panel" style={{
              flexShrink: 0, padding: '0 11px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--v-text-muted)', display: 'flex', alignItems: 'center',
            }}><ChevronRight size={15} /></button>
          </div>

          {/* Library overlay — chart gallery; click a tile to add it to the canvas */}
          {rightTab === 'library' && (
            <div style={{ position: 'absolute', top: 37, left: 0, right: 0, bottom: 0, zIndex: 5, background: 'var(--surface-raised)', overflow: 'auto', padding: 12 }}>
              <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-faint)', marginBottom: 10 }}>Chart library — click to add</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {VISUAL_PALETTE.map(({ type, label, w, h }) => (
                  <button key={type} onClick={() => addFromLibrary(type, w, h)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-accent-border)'; e.currentTarget.style.background = 'var(--v-surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.background = 'var(--v-surface)' }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '12px 10px', background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', cursor: 'pointer', font: 'inherit', transition: 'border-color .12s, background .12s' }}>
                    <MiniChart type={type} />
                    <span style={{ font: '500 12px var(--v-font)', color: 'var(--v-text)' }}>{label}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12, font: '400 11px var(--v-font)', color: 'var(--v-text-muted)', lineHeight: 1.5 }}>
                Tiles land as drafts — bind fields in the inspector after.
              </div>

              {/* Playground Spike — custom visuals section */}
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-faint)', flex: 1 }}>Custom visuals</div>
                <button onClick={() => setShowPlayground(true)}
                  style={{ font: '600 10px var(--v-font)', color: 'var(--v-accent)', background: 'var(--v-accent-quiet)', border: '1px solid var(--v-accent-border)', borderRadius: 'var(--v-r-2)', padding: '3px 8px', cursor: 'pointer' }}>
                  ⚗ Playground
                </button>
              </div>
              {customTemplates.length === 0 ? (
                <div style={{ marginTop: 8, font: '400 11px var(--v-font)', color: 'var(--v-text-faint)', lineHeight: 1.5 }}>
                  None yet. Open the Playground to author one from a template.
                </div>
              ) : (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {customTemplates.map(({ templateId, name, icon, template }) => (
                    <button key={templateId} onClick={() => addCustomFromLibrary(template)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-accent-border)'; e.currentTarget.style.background = 'var(--v-surface-2)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.background = 'var(--v-surface)' }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 10px', background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', cursor: 'pointer', font: 'inherit', transition: 'border-color .12s, background .12s' }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon || '⚗'}</span>
                      <span style={{ font: '500 12px var(--v-font)', color: 'var(--v-text)', textAlign: 'left' }}>{name || templateId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No-key guard (mockup S9) */}
          {!aiStatus?.anyConfigured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', flexShrink: 0, background: 'var(--v-amber-quiet)', borderBottom: '1px solid var(--v-border)', font: '500 11px var(--v-font)', color: 'var(--v-amber)' }}>
              <span aria-hidden>⚠</span> No AI provider — add a key in <strong style={{ fontWeight: 600 }}>Settings</strong> (rail gear).
            </div>
          )}

          {/* ===== Prompt card (mockup S6/S7): textarea + scope + provider + send ===== */}
          <div style={{ padding: '14px 14px 0', flexShrink: 0 }}>
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!promptDrop) setPromptDrop(true) }}
              onDragLeave={() => setPromptDrop(false)}
              onDrop={handlePromptFieldDrop}
              style={{ position: 'relative', border: `1px solid ${promptDrop ? 'var(--v-accent)' : 'var(--v-border)'}`, borderRadius: 'var(--v-r-2)', background: 'var(--v-surface)', transition: 'border-color .12s' }}>
              {/* Slash menu popup */}
              {slashMenu?.anchor === 'main' && slashMenu.items.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '4px 10px', fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-subtle)' }}>
                    {slashMenu.type === 'm' ? 'Measures' : 'Dimensions'} · Tab to insert
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {slashMenu.items.map((item, i) => (
                      <div key={i} onMouseDown={e => { e.preventDefault(); insertSlashItem(item) }}
                        style={{ padding: '6px 10px', fontSize: 'var(--fs-sm)', cursor: 'pointer', background: i === slashMenu.selectedIdx ? 'var(--accent-subtle)' : 'transparent', color: i === slashMenu.selectedIdx ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={description}
                onChange={handleDescriptionChange}
                onKeyDown={handleDescriptionKeyDown}
                onBlur={() => setTimeout(() => setSlashMenu(null), 150)}
                placeholder={
                  chatMode === 'replace' && generatedSpec ? 'Describe a new dashboard (replaces the canvas)…'
                  : promptScope === 'visual' ? 'Describe a visual — drop fields in as context…'
                  : promptScope === 'page' ? 'Describe a page — e.g. "build a sales overview page"…'
                  : 'Describe your analytics app…'
                }
                rows={4}
                style={{ width: '100%', padding: '11px 12px', border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--fs-body)', color: 'var(--text-primary)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
              />
              {/* Footer: scope · provider · send */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderTop: '1px solid var(--v-border)' }}>
                <div style={{ display: 'flex', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', overflow: 'hidden', flexShrink: 0 }}>
                  {[['visual', 'Visual'], ['page', 'Page'], ['dashboard', 'App']].map(([v, l]) => (
                    <button key={v} onClick={() => setPromptScope(v)}
                      style={{ padding: '4px 7px', font: '600 9px var(--v-mono)', textTransform: 'uppercase', letterSpacing: '.04em', border: 'none', cursor: 'pointer', background: promptScope === v ? 'var(--v-accent-quiet)' : 'transparent', color: promptScope === v ? 'var(--v-accent)' : 'var(--v-text-muted)' }}>{l}</button>
                  ))}
                </div>
                <div style={{ flex: 1 }} />
                <Select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} style={{ height: 28, fontSize: 'var(--fs-caption)', maxWidth: 120 }}>
                  {PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}{aiStatus?.[p.statusKey]?.configured ? '' : ' (no key)'}</option>
                  ))}
                </Select>
                <IconButton onClick={handleChatSubmit} disabled={!canGenerate}
                  title={generatedSpec ? (chatMode === 'refine' ? 'Apply refinement' : 'Regenerate') : 'Generate'}
                  style={{ background: canGenerate ? 'var(--accent)' : 'var(--accent-subtle)', color: canGenerate ? 'var(--accent-contrast)' : 'var(--text-faint)' }}>
                  {generating ? <Spinner size={14} /> : <ArrowUp size={16} />}
                </IconButton>
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1 }}>Drag model fields into this box to pin them as context.</span>
              <button onClick={() => setPromptOptionsOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--v-text-muted)', cursor: 'pointer', font: 'inherit', fontSize: 'var(--fs-micro)', padding: 0, whiteSpace: 'nowrap' }}>Options {promptOptionsOpen ? '▲' : '▾'}</button>
            </div>

            {/* Model — kept visible next to the card (one click), not hidden in Options */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', fontWeight: 600, width: 40, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>Model</span>
              <Select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!(availableModels[selectedProvider] || []).length} style={{ flex: 1, minWidth: 0, height: 28, fontSize: 'var(--fs-caption)' }}>
                {(availableModels[selectedProvider] || []).map(m => { const id = typeof m === 'string' ? m : (m.id || m.name || m.model); return <option key={id} value={id}>{id}</option> })}
                {!(availableModels[selectedProvider] || []).length && <option value="">(no models)</option>}
              </Select>
            </div>

            {/* Options — page size · refine/replace mode (tucked to keep it clean) */}
            {promptOptionsOpen && (() => {
              const currentPreset = generatedSpec?.layout?.pagePreset || pendingPageSize.preset
              const currentW = generatedSpec?.layout?.pageWidth || pendingPageSize.width
              const currentH = generatedSpec?.layout?.pageHeight || pendingPageSize.height
              const onPresetChange = (preset) => {
                const presets = { '16:9': [1280,720], '16:10': [1280,800], '4:3': [1024,768], 'tall': [1280,1920], 'square': [1024,1024], 'auto': [1280,null], 'custom': [currentW, currentH] }
                const [w, h] = presets[preset] || [1280, 720]
                setPendingPageSize({ preset, width: w || 1280, height: h || 720 })
                if (generatedSpec) setGeneratedSpec(prev => prev ? ({ ...prev, layout: { ...(prev.layout || {}), pagePreset: preset, pageWidth: w || undefined, pageHeight: h || undefined } }) : prev)
              }
              const onCustomDim = (key, val) => {
                const n = Number(val); if (!Number.isFinite(n)) return
                setPendingPageSize(p => ({ ...p, preset: 'custom', [key]: Math.max(200, Math.min(8192, n)) }))
                if (generatedSpec) setGeneratedSpec(prev => prev ? ({ ...prev, layout: { ...(prev.layout || {}), pagePreset: 'custom', [key === 'width' ? 'pageWidth' : 'pageHeight']: n } }) : prev)
              }
              return (
                <div style={{ marginTop: 8, padding: 10, background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', fontWeight: 600, width: 52, flexShrink: 0 }}>PAGE</span>
                    <Select value={currentPreset} onChange={e => onPresetChange(e.target.value)} style={{ flex: 1, height: 28, fontSize: 'var(--fs-caption)' }}>
                      <option value="16:9">16:9 (1280×720)</option>
                      <option value="16:10">16:10 (1280×800)</option>
                      <option value="4:3">4:3 (1024×768)</option>
                      <option value="tall">Tall (1280×1920)</option>
                      <option value="square">Square (1024×1024)</option>
                      <option value="auto">Auto-fit</option>
                      <option value="custom">Custom…</option>
                    </Select>
                  </div>
                  {currentPreset === 'custom' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 60 }}>
                      <Input type="number" min={640} max={4096} value={currentW || 1280} onChange={e => onCustomDim('width', e.target.value)} placeholder="W" style={{ height: 28, fontSize: 'var(--fs-caption)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>×</span>
                      <Input type="number" min={480} max={8192} value={currentH || 720} onChange={e => onCustomDim('height', e.target.value)} placeholder="H" style={{ height: 28, fontSize: 'var(--fs-caption)' }} />
                    </div>
                  )}
                  {generatedSpec && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', fontWeight: 600, width: 52, flexShrink: 0 }}>MODE</span>
                      <SegmentedControl value={chatMode} onChange={setChatMode} options={[{ value: 'refine', label: 'Refine' }, { value: 'replace', label: 'Replace' }]} />
                      {chatMode === 'replace' && <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--warning)' }}>wipes canvas</span>}
                    </div>
                  )}
                  {modeWarning && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-micro)', color: 'var(--warning)', background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}><AlertTriangle size={12} /> {modeWarning}</div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Saved Apps section removed — projects are managed from Home screen */}

          {/* Chat messages */}
          <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && !generating && (
              <div>
                <button onClick={() => setShowTemplates(s => !s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text-muted)', padding: '8px 10px', cursor: 'pointer', font: '500 12px var(--v-font)' }}>
                  <span style={{ transform: showTemplates ? 'rotate(90deg)' : 'none', transition: 'transform .1s', display: 'inline-flex' }}><ChevronRight size={14} /></span>
                  Start from a template
                </button>
                {showTemplates && (
                  <div style={{ marginTop: 8 }}>
                    <TemplatePicker measures={measures} dimensions={dimensions} theme={{ mode: canvasTheme }} onApply={(spec, tpl) => { handleTemplateApply(spec, tpl); setShowTemplates(false) }} />
                  </div>
                )}
              </div>
            )}

            {messages.map(msg => {
              if (msg.type === 'user') return (
                <div key={msg.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--accent)', color: 'var(--accent-contrast)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 'var(--fs-body)', lineHeight: 1.5, userSelect: 'text', cursor: 'text' }}>
                  {msg.content}
                  <div style={{ fontSize: 9, opacity: 0.7, marginTop: 3, textAlign: 'right' }}>{msg.timestamp}</div>
                </div>
              )
              if (msg.type === 'ai') return (
                <div key={msg.id}
                  style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', fontSize: 'var(--fs-sm)', lineHeight: 1.5, userSelect: 'text' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600, flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Sparkles size={12} /> {msg.content}</span>
                    <Button variant="secondary" size="sm" style={{ height: 22, padding: '0 8px', fontSize: 'var(--fs-micro)' }}
                      onClick={() => { setGeneratedSpec(msg.spec); setAppTitle(msg.spec?.title || 'App') }}>
                      Load
                    </Button>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>{msg.visualCount} visuals{msg.slicerCount > 0 ? ` · ${msg.slicerCount} slicers` : ''}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-micro)', marginTop: 2 }}>{msg.provider} · {msg.model?.split('-').slice(-2).join('-')} · {msg.timestamp}</div>
                  {msg.usage?.combined && (
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {msg.provider === 'local-programmatic'
                        ? `⚡ instant · ${(msg.usage.combined.elapsedMs / 1000).toFixed(2)}s`
                        : msg.provider === 'local-intent'
                        ? `⚡ ${msg.usage.combined.totalTokens?.toLocaleString() || 0} tokens · ${(msg.usage.combined.elapsedMs / 1000).toFixed(1)}s`
                        : `${msg.usage.combined.totalTokens?.toLocaleString()} tokens · $${msg.usage.combined.estimatedCost?.toFixed(4)} · ${(msg.usage.combined.elapsedMs / 1000).toFixed(1)}s`
                      }
                    </div>
                  )}
                </div>
              )
              if (msg.type === 'error') return (
                <div key={msg.id} style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'var(--danger-subtle)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', fontSize: 'var(--fs-sm)', color: 'var(--danger)', lineHeight: 1.5, userSelect: 'text', display: 'flex', gap: 6 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>{msg.content}<div style={{ fontSize: 9, opacity: 0.7, marginTop: 3 }}>{msg.timestamp}</div></div>
                </div>
              )
              return null
            })}

            {/* Typing indicator */}
            {generating && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `ag-bounce 1.2s ${i * 0.15}s ease-in-out infinite` }} />
                ))}
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Session usage footer */}
          {sessionUsage.callCount > 0 && (
            <div style={{ padding: '5px 14px', fontSize: 'var(--fs-micro)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              <span>{sessionUsage.totalTokens.toLocaleString()} tokens · ${sessionUsage.estimatedCost.toFixed(4)}</span>
              <span>{sessionUsage.callCount} call{sessionUsage.callCount !== 1 ? 's' : ''}</span>
            </div>
          )}

        </div>
        )}

        {/* ── Right Canvas ── */}
        <div ref={canvasRef} style={{ flex: 1, minWidth: 0, background: canvasTheme === 'dark' ? '#0b0b12' : '#F1F5F9', backgroundImage: canvasTheme === 'dark' ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)' : 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px', position: 'relative', overflow: 'auto', display: 'flex', flexDirection: 'column', transition: 'background 0.2s' }}>

          {/* Generating overlay — matches the canvas (dashboard) theme, not chrome */}
          {generating && (
            <div style={{ position: 'absolute', inset: 0, background: canvasTheme === 'dark' ? 'rgba(11,11,18,0.82)' : 'rgba(241,245,249,0.85)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 10 }}>
              <Sparkles size={40} color="var(--v-accent)" style={{ animation: 'ag-spin 2s linear infinite' }} />
              <div style={{ color: 'var(--v-accent)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}>Generating…</div>
              <div style={{ color: canvasTheme === 'dark' ? 'var(--v-text-muted)' : 'var(--v-text-faint)', fontSize: 'var(--fs-sm)' }}>{activeProviderMeta.label}{selectedModel ? ` · ${selectedModel}` : ''}</div>
            </div>
          )}

          {/* Spec shown on canvas */}
          {generatedSpec && (
            <>
              {/* Info bar */}
              <div style={{ padding: '6px 16px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', flexShrink: 0 }}>
                <Button variant="ghost" size="sm" onClick={() => setChatCollapsed((c) => !c)}
                  title={chatCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}
                  iconLeft={chatCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}>
                  Chat
                </Button>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Sparkles size={13} color="var(--accent)" /> {generatedSpec.title}</span>
                <span>{_activePage?.visuals?.length || 0} visuals</span>
                {(_activePage?.slicers?.length || 0) > 0 && <span>{_activePage.slicers.length} slicers</span>}
                {validationResult?.warnings?.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning)' }}><AlertTriangle size={12} /> {validationResult.warnings.length} warnings</span>}
                {generatedSpec.layout?.pagePreset && (
                  <span style={{ color: 'var(--text-faint)' }}>
                    {generatedSpec.layout.pagePreset}
                    {generatedSpec.layout.pageWidth && generatedSpec.layout.pageHeight &&
                      ` (${generatedSpec.layout.pageWidth}×${generatedSpec.layout.pageHeight})`}
                  </span>
                )}

                {/* ── Add Visual ── */}
                <div style={{ position: 'relative' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setAddVisualOpen(p => !p); setAddSlicerOpen(false) }} iconLeft={<Plus size={14} />}>Visual</Button>
                  {addVisualOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: 8, width: 240 }}>
                      <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, paddingLeft: 2 }}>Choose visual type</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        {VISUAL_PALETTE.map(({ type, label, w, h }) => (
                          <button key={type}
                            onClick={() => handleAddVisual(type, w, h)}
                            style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '5px 4px', fontSize: 'var(--fs-micro)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', textAlign: 'center', transition: 'all var(--dur-fast) var(--ease-standard)' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-sunken)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Add Slicer ── */}
                <div style={{ position: 'relative' }}>
                  <Button variant="secondary" size="sm" onClick={() => { setAddSlicerOpen(p => !p); setAddVisualOpen(false); setSlicerSearch('') }} iconLeft={<Filter size={14} />}>Slicer</Button>
                  {addSlicerOpen && (() => {
                    const filtered = slicerColumnOptions.filter(o =>
                      !slicerSearch || o.label.toLowerCase().includes(slicerSearch.toLowerCase()) || o.column.toLowerCase().includes(slicerSearch.toLowerCase())
                    )
                    return (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: 240, overflow: 'hidden' }}>
                      {/* Search */}
                      <div style={{ padding: '8px 8px 6px' }}>
                        <Input autoFocus value={slicerSearch} onChange={e => setSlicerSearch(e.target.value)} placeholder="Search columns…" style={{ height: 30, fontSize: 'var(--fs-sm)' }} />
                      </div>
                      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '0 4px 6px' }}>
                      {slicerColumnOptions.length === 0 ? (
                        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', padding: '4px 8px' }}>Connect a model to see dimensions.</div>
                      ) : filtered.length === 0 ? (
                        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', padding: '4px 8px' }}>No columns match.</div>
                      ) : filtered.map(({ table, column, dataType, isDate, label }) => (
                        <button key={`${table}|${column}`}
                          onClick={() => handleAddSlicer(table, column, dataType)}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '6px 8px', fontSize: 'var(--fs-sm)', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit', borderRadius: 'var(--radius-sm)' }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                          <span style={{ fontSize: 'var(--fs-micro)', color: isDate ? 'var(--accent)' : 'var(--text-muted)', background: isDate ? 'var(--accent-subtle)' : 'var(--surface-hover)', borderRadius: 'var(--radius-xs)', padding: '1px 5px', flexShrink: 0 }}>{isDate ? 'date' : 'text'}</span>
                        </button>
                      ))}
                      </div>
                    </div>
                  )})()}
                </div>

                <div style={{ flex: 1 }} />
                {genInfo && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-micro)' }}>{genInfo.provider} · {genInfo.model?.split('-').slice(-2).join('-')}</span>}
              </div>

              {/* ── Page tabs ── */}
              {(() => {
                const pages = getPages(generatedSpec)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 12px', height: 34, borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', flexShrink: 0, overflowX: 'auto' }}>
                    {pages.map(page => {
                      const isActive = page.id === currentPageId
                      return (
                        <div key={page.id} onClick={() => { setCurrentPageId(page.id); setSelectedVisualId(null) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 12px', height: 26, borderRadius: 'var(--radius-sm)', background: isActive ? 'var(--accent-subtle)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontWeight: isActive ? 600 : 500, userSelect: 'none', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.1s' }}>
                          {renamingPageId === page.id
                            ? <input autoFocus value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={() => { renamePage(page.id, renameValue); setRenamingPageId(null) }}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Enter') renamePage(page.id, renameValue); setRenamingPageId(null) } }}
                                onClick={e => e.stopPropagation()}
                                style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, outline: 'none', width: Math.max(60, renameValue.length * 7 + 8), fontFamily: 'inherit' }} />
                            : <span onDoubleClick={e => { e.stopPropagation(); setRenamingPageId(page.id); setRenameValue(page.name) }}>
                                {page.name}
                              </span>
                          }
                          {pages.length > 1 && (
                            <span onClick={e => { e.stopPropagation(); deletePage(page.id) }}
                              style={{ display: 'inline-flex', fontSize: 10, color: 'var(--text-faint)', marginLeft: 2, cursor: 'pointer', padding: '0 2px', lineHeight: 1, transition: 'color 0.1s' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}>
                              <X size={12} />
                            </span>
                          )}
                        </div>
                      )
                    })}
                    <button onClick={addPage} title="Add page"
                      style={{ marginLeft: 4, width: 22, height: 22, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                      <Plus size={13} />
                    </button>
                  </div>
                )
              })()}

              {/* ── Canvas toolbar (mockup: page·size | saved | brand/capture/story | snap | zoom | fit) ── */}
              {(() => {
                const layout = generatedSpec.layout || {}
                const presets = { '16:9':[1280,720], '16:10':[1280,800], '4:3':[1024,768], 'tall':[1280,1920], 'square':[1024,1024], 'auto':[1280,null], 'custom':[layout.pageWidth || 1280, layout.pageHeight || 720] }
                const [pw, ph]  = presets[layout.pagePreset || '16:9'] || [1280, 720]
                const pageW = Number(layout.pageWidth)  || pw || 1280
                const pageH = Number(layout.pageHeight) || ph
                const curPage = getPages(generatedSpec).find(p => p.id === currentPageId) || getPages(generatedSpec)[0]
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderBottom: '1px solid var(--v-border)', background: 'var(--v-bg-1)', flexShrink: 0, overflowX: 'auto' }}>
                    <span style={{ font: '600 11px var(--v-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--v-text-2)', whiteSpace: 'nowrap' }}>{curPage?.name || 'Page'}</span>
                    <span style={{ font: '400 11px var(--v-mono)', color: 'var(--v-text-faint)', whiteSpace: 'nowrap' }}>· {pageW}×{pageH || 'auto'}</span>
                    {saving && <span style={{ font: '400 10px var(--v-mono)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--v-amber)', whiteSpace: 'nowrap' }}>Saving…</span>}

                    <div style={tbDivider} />
                    {/* VILSEM_STUB: brand kit / capture-as-step / story composer */}
                    <button style={tbChip} onClick={() => addToast('Brand kit — coming in a later release', 'info')}>Brand: None <span style={tbBadge}>v1.1</span></button>
                    <button style={tbChip} onClick={() => addToast('Capture as step — coming with Stories', 'info')}>Capture as step</button>
                    <button style={tbChip} onClick={() => addToast('Story composer — coming in v2', 'info')}>Create story <span style={tbBadge}>v2</span></button>

                    <div style={{ flex: 1 }} />

                    <button style={tbToggle(snapOn)} onClick={() => setSnapOn(s => !s)} title="Alignment grid guides">Snap {snapOn ? 'on' : 'off'}</button>
                  </div>
                )
              })()}

              {/* ── Canvas edit mode ── */}
              {editMode ? (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                  {/* Canvas editor surface — same page frame as view mode */}
                  {(() => {
                    const layout = generatedSpec.layout || {}
                    const presets = { '16:9':[1280,720], '16:10':[1280,800], '4:3':[1024,768], 'tall':[1280,1920], 'square':[1024,1024], 'auto':[1280,null], 'custom':[layout.pageWidth || 1280, layout.pageHeight || 720] }
                    const presetKey = layout.pagePreset || '16:9'
                    const [pw, ph]  = presets[presetKey] || [1280, 720]
                    const pageW = Number(layout.pageWidth)  || pw || 1280
                    const pageH = Number(layout.pageHeight) || ph
                    return (
                      <div ref={canvasScrollRef} style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                        <div style={{
                          margin: '24px auto',
                          width: pageW,
                          minHeight: pageH || 720,
                          background: canvasTheme === 'dark' ? '#0b0b12' : '#FFFFFF',
                          border: canvasTheme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--v-text)',
                          borderRadius: 8,
                          boxShadow: canvasTheme === 'dark' ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.08)',
                          padding: 16,
                          boxSizing: 'border-box',
                          backgroundImage: snapOn ? `radial-gradient(circle, ${canvasTheme === 'dark' ? 'rgba(140,160,180,0.16)' : 'rgba(30,40,60,0.10)'} 1px, transparent 1px)` : undefined,
                          backgroundSize: snapOn ? `${(pageW - 32) / 12}px 88px` : undefined,
                          backgroundPosition: '16px 16px',
                        }}>
                          <CanvasEditor
                            spec={_activePageSpec}
                            onSpecChange={(id, pos) => {
                              editSpec(s => {
                                s.layout = { ...(s.layout || {}), freeform: true }
                                const v = s.visuals.find(vi => vi.id === id)
                                if (v) { v.position = { ...v.position, ...pos }; return }
                                const sl = (s.slicers || []).find(si => si.id === id)
                                if (sl) sl.position = { ...sl.position, ...pos }
                              })
                            }}
                            onBindField={(visualId, field) => {
                              editSpec(s => {
                                const v = s.visuals.find(vi => vi.id === visualId)
                                if (!v) return
                                v.data = v.data || {}
                                if (field.kind === 'measure') {
                                  const cur = v.data.measures || []
                                  if (!cur.includes(field.name)) v.data.measures = [...cur, field.name]
                                } else if (field.kind === 'column' && field.table && field.column) {
                                  if (v.type === 'table') {
                                    const dims = v.data.dimensions || []
                                    if (!dims.some(d => d.table === field.table && d.column === field.column)) {
                                      v.data.dimensions = [...dims, { table: field.table, column: field.column }]
                                    }
                                  } else {
                                    v.data.groupBy = { table: field.table, column: field.column }
                                  }
                                }
                              })
                              setSelectedVisualId(visualId)
                            }}
                            onCreateFromField={(field, gridPos) => {
                              // Drop a measure/column on empty canvas → new table visual bound to it.
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
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── Tabbed inspector (Data / Style / Text / Layout / AI) —
                       same component the injector uses; measures live under Data.
                       Fixed to the top-right; floats over the prompt panel while a
                       visual is selected, dismiss returns you to the prompt. ── */}
                  {selectedVisual && (
                    <VisualInspector
                      visual={selectedVisual}
                      customTemplate={selectedVisual?.type === 'custom' ? generatedSpec?.customVisuals?.[selectedVisual.customTemplateId] : null}
                      isDark
                      editSpec={editSpec}
                      selectedVisualId={selectedVisualId}
                      onClose={() => setSelectedVisualId(null)}
                      onDelete={() => {
                        editSpec(s => {
                          if ((s.slicers || []).some(sl => sl.id === selectedVisualId)) {
                            s.slicers = s.slicers.filter(sl => sl.id !== selectedVisualId)
                          } else {
                            s.visuals = s.visuals.filter(v => v.id !== selectedVisualId)
                          }
                        })
                        setSelectedVisualId(null)
                      }}
                      onDuplicate={() => editSpec(s => {
                        const orig = s.visuals.find(vi => vi.id === selectedVisualId)
                        if (!orig) return
                        const copy = JSON.parse(JSON.stringify(orig))
                        copy.id = `${orig.id}_copy_${Date.now().toString(36)}`
                        copy.position = { ...copy.position, x: (copy.position?.x ?? 0) + 1, y: (copy.position?.y ?? 0) + 1 }
                        s.visuals.push(copy)
                      })}
                      onAiRefine={async (prompt) => refineSpec({ prompt, scopedVisualId: selectedVisualId })}
                    />
                  )}

                  {/* ── Old inline inspector — DISABLED: replaced by the tabbed
                       VisualInspector (above). Kept until verified, then removed. ── */}
                  {false && selectedVisual && (
                    <div style={{
                      position: 'absolute',
                      right: inspectorCollapsed ? -220 : 0,
                      top: 16,
                      bottom: 16,
                      width: 240,
                      flexShrink: 0,
                      border: '1px solid var(--border-default)',
                      background: 'var(--surface-overlay)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-lg)',
                      display: 'flex', flexDirection: 'column', overflow: 'auto',
                      transition: 'right 0.25s ease-out',
                      zIndex: 100,
                    }}>
                      {/* Collapse tab */}
                      <button onClick={() => setInspectorCollapsed(c => !c)} style={{
                        position: 'absolute', left: -28, top: 12, width: 28, height: 36,
                        background: 'var(--surface-overlay)',
                        border: '1px solid var(--border-default)',
                        borderRight: 'none', borderRadius: '6px 0 0 6px',
                        cursor: 'pointer', color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {inspectorCollapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                      </button>
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Inspector</div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedVisual.config?.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase' }}>
                          {selectedVisual.type}
                        </div>
                      </div>
                      {/* Position/size controls */}
                      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: canvasTheme === 'dark' ? 'var(--v-text-faint)' : 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Position & Size</div>
                        {[
                          { label: 'X', key: 'x', min: 0, max: 11 },
                          { label: 'Y', key: 'y', min: 0, max: 50 },
                          { label: 'W', key: 'w', min: 1, max: 12 },
                          { label: 'H', key: 'h', min: 1, max: 8 },
                        ].map(({ label, key, min, max }) => {
                          const val = selectedVisual.position?.[key] ?? 0
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: canvasTheme === 'dark' ? 'var(--v-text-faint)' : 'var(--v-text-faint)', width: 14 }}>{label}</span>
                              <button onClick={() => editSpec(s => {
                                const v = s.visuals.find(vi => vi.id === selectedVisualId)
                                if (v?.position) v.position[key] = Math.max(min, val - 1)
                              })}
                                style={{ width: 22, height: 22, background: canvasTheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9', border: canvasTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--v-text)', color: canvasTheme === 'dark' ? 'var(--v-text-muted)' : 'var(--v-text-faint)', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                −
                              </button>
                              <input type="number" value={val} min={min} max={max}
                                onChange={e => {
                                  const n = Math.max(min, Math.min(max, parseInt(e.target.value) || 0))
                                  editSpec(s => {
                                    const v = s.visuals.find(vi => vi.id === selectedVisualId)
                                    if (v?.position) v.position[key] = n
                                  })
                                }}
                                style={{ width: 40, textAlign: 'center', padding: '2px 4px', border: canvasTheme === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--v-text)', borderRadius: 4, background: canvasTheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'white', color: canvasTheme === 'dark' ? 'var(--v-text)' : 'var(--v-surface-3)', fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
                              />
                              <button onClick={() => editSpec(s => {
                                const v = s.visuals.find(vi => vi.id === selectedVisualId)
                                if (v?.position) v.position[key] = Math.min(max, val + 1)
                              })}
                                style={{ width: 22, height: 22, background: canvasTheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9', border: canvasTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--v-text)', color: canvasTheme === 'dark' ? 'var(--v-text-muted)' : 'var(--v-text-faint)', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                +
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      {/* ── Content ── */}
                      {(() => {
                        const dk = canvasTheme === 'dark'
                        const sectionBorder = dk ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--v-text)'
                        const secLabel = { fontSize: 9, fontWeight: 700, color: dk ? 'var(--v-text-faint)' : 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }
                        const inputStyle = { width: '100%', padding: '4px 6px', border: dk ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--v-text)', borderRadius: 4, background: dk ? 'var(--v-surface-3)' : 'white', color: dk ? 'var(--v-text)' : 'var(--v-surface-3)', fontSize: 11, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
                        const selectStyle = { ...inputStyle, cursor: 'pointer', colorScheme: dk ? 'dark' : 'light' }
                        const sliderStyle = { width: '100%', height: 4, accentColor: 'var(--v-accent)', cursor: 'pointer' }
                        const fieldLabel = { fontSize: 9, color: dk ? 'var(--v-text-faint)' : 'var(--v-text-muted)', marginBottom: 2 }
                        const isSlicer = !!selectedVisual.dimension || ['dropdown','buttons','date_range','multi_select'].includes(selectedVisual.type)
                        const isKpi = selectedVisual.type === 'kpi'
                        const cfg = selectedVisual.config || {}

                        return (<>
                      <div style={{ padding: '10px 12px', borderTop: sectionBorder, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={secLabel}>Content</div>
                        <div>
                          <div style={fieldLabel}>Title</div>
                          <input value={cfg.title || ''} onChange={e => editConfig('title', e.target.value)} style={inputStyle} placeholder="Visual title" />
                        </div>
                        {(isKpi || selectedVisual.type === 'gauge') && (
                          <div>
                            <div style={fieldLabel}>Subtitle</div>
                            <input value={cfg.subtitle || ''} onChange={e => editConfig('subtitle', e.target.value || null)} style={inputStyle} placeholder="Optional" />
                          </div>
                        )}
                        {(isKpi || selectedVisual.type === 'gauge' || selectedVisual.type === 'bar' || selectedVisual.type === 'table') && (<>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <div style={{ flex: 1 }}>
                              <div style={fieldLabel}>Prefix</div>
                              <input value={cfg.prefix || ''} onChange={e => editConfig('prefix', e.target.value || null)} style={inputStyle} placeholder="$" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={fieldLabel}>Suffix</div>
                              <input value={cfg.suffix || ''} onChange={e => editConfig('suffix', e.target.value || null)} style={inputStyle} placeholder="%" />
                            </div>
                          </div>
                        </>)}
                      </div>

                      {/* ── Typography ── */}
                      {!isSlicer && (
                      <div style={{ padding: '10px 12px', borderTop: sectionBorder, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={secLabel}>Typography</div>
                        <div>
                          <div style={fieldLabel}>Title Font</div>
                          <select value={cfg.titleFontFamily || ''} onChange={e => editConfig('titleFontFamily', e.target.value || null)} style={selectStyle}>
                            <option value="">Default</option>
                            {PREMIUM_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={fieldLabel}>Title Size</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="range" min={8} max={32} value={cfg.titleFontSize || 12}
                              onChange={e => editConfig('titleFontSize', Number(e.target.value))}
                              style={sliderStyle} />
                            <input type="number" min={8} max={72} value={cfg.titleFontSize || 12}
                              onChange={e => editConfig('titleFontSize', Math.max(8, Math.min(72, Number(e.target.value) || 12)))}
                              style={{ ...inputStyle, width: 42, textAlign: 'center', flex: 'none' }} />
                          </div>
                        </div>
                        {isKpi && (<>
                          <div>
                            <div style={fieldLabel}>Value Font</div>
                            <select value={cfg.valueFontFamily || ''} onChange={e => editConfig('valueFontFamily', e.target.value || null)} style={selectStyle}>
                              <option value="">Default</option>
                              {PREMIUM_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <div style={fieldLabel}>Value Size</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input type="range" min={14} max={64} value={cfg.valueFontSize || 30}
                                onChange={e => editConfig('valueFontSize', Number(e.target.value))}
                                style={sliderStyle} />
                              <input type="number" min={14} max={96} value={cfg.valueFontSize || 30}
                                onChange={e => editConfig('valueFontSize', Math.max(14, Math.min(96, Number(e.target.value) || 30)))}
                                style={{ ...inputStyle, width: 42, textAlign: 'center', flex: 'none' }} />
                            </div>
                          </div>
                        </>)}
                      </div>
                      )}

                      {/* ── Color ── */}
                      {!isSlicer && (() => {
                        const activeColor = cfg.titleColor || '#ffffff'
                        const hexToRgb = (hex) => {
                          const h = (hex || '').replace('#', '').padEnd(6, '0')
                          return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 }
                        }
                        const rgbToHex = (r, g, b) => '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
                        const rgb = hexToRgb(activeColor)
                        return (
                      <div style={{ padding: '10px 12px', borderTop: sectionBorder, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={secLabel}>Color</div>
                        <div>
                          <div style={fieldLabel}>Scheme</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {COLOR_SCHEMES.map(cs => (
                              <div key={cs.id} onClick={() => editConfig('colorScheme', cs.id)}
                                style={{
                                  width: 18, height: 18, borderRadius: 4, background: cs.color, cursor: 'pointer',
                                  border: cfg.colorScheme === cs.id ? '2px solid white' : '2px solid transparent',
                                  boxShadow: cfg.colorScheme === cs.id ? `0 0 0 1px ${cs.color}` : 'none',
                                }} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={fieldLabel}>Title Color</div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input type="color" value={activeColor} onChange={e => editConfig('titleColor', e.target.value)}
                              style={{ width: 28, height: 24, border: `1px solid ${dk ? 'rgba(255,255,255,0.12)' : 'var(--v-text)'}`, borderRadius: 4, background: 'transparent', cursor: 'pointer', padding: 0 }} />
                            <input value={cfg.titleColor || ''} onChange={e => editConfig('titleColor', e.target.value || null)}
                              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 10 }} placeholder="#hex or empty=auto" />
                          </div>
                        </div>
                        {/* RGB advanced */}
                        <details style={{ marginTop: 2 }}>
                          <summary style={{ fontSize: 9, color: dk ? 'var(--v-text-faint)' : 'var(--v-text-muted)', cursor: 'pointer', userSelect: 'none' }}>RGB Advanced</summary>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                            {[
                              { label: 'R', key: 'r', color: 'var(--v-danger)' },
                              { label: 'G', key: 'g', color: 'var(--v-success)' },
                              { label: 'B', key: 'b', color: '#3B82F6' },
                            ].map(ch => (
                              <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: ch.color, width: 10 }}>{ch.label}</span>
                                <input type="range" min={0} max={255} value={rgb[ch.key]}
                                  onChange={e => {
                                    const next = { ...rgb, [ch.key]: Number(e.target.value) }
                                    editConfig('titleColor', rgbToHex(next.r, next.g, next.b))
                                  }}
                                  style={{ ...sliderStyle, accentColor: ch.color, flex: 1 }} />
                                <input type="number" min={0} max={255} value={rgb[ch.key]}
                                  onChange={e => {
                                    const next = { ...rgb, [ch.key]: Math.max(0, Math.min(255, Number(e.target.value) || 0)) }
                                    editConfig('titleColor', rgbToHex(next.r, next.g, next.b))
                                  }}
                                  style={{ ...inputStyle, width: 38, textAlign: 'center', flex: 'none', fontSize: 10 }} />
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                        )
                      })()}

                      {/* ── Motion ── */}
                      {!isSlicer && (
                      <div style={{ padding: '10px 12px', borderTop: sectionBorder, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={secLabel}>Motion</div>
                        <div>
                          <div style={fieldLabel}>Entrance</div>
                          <select value={cfg.animationPreset || 'none'} onChange={e => editConfig('animationPreset', e.target.value)} style={selectStyle}>
                            <option value="none">None</option>
                            <option value="fadeUp">Fade Up</option>
                            <option value="fadeIn">Fade In</option>
                            <option value="scaleIn">Scale In</option>
                          </select>
                        </div>
                        {cfg.animationPreset && cfg.animationPreset !== 'none' && (<>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <div style={{ flex: 1 }}>
                              <div style={fieldLabel}>Speed</div>
                              <select value={cfg.animationDuration || 'medium'} onChange={e => editConfig('animationDuration', e.target.value)} style={selectStyle}>
                                <option value="fast">Fast</option>
                                <option value="medium">Medium</option>
                                <option value="slow">Slow</option>
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={fieldLabel}>Delay</div>
                              <select value={cfg.animationDelay || 'none'} onChange={e => editConfig('animationDelay', e.target.value)} style={selectStyle}>
                                <option value="none">None</option>
                                <option value="short">Short</option>
                                <option value="medium">Medium</option>
                              </select>
                            </div>
                          </div>
                        </>)}
                        <div>
                          <div style={fieldLabel}>Hover</div>
                          <select value={cfg.hoverEffect || 'off'} onChange={e => editConfig('hoverEffect', e.target.value)} style={selectStyle}>
                            <option value="off">Off</option>
                            <option value="subtle">Subtle</option>
                            <option value="medium">Medium</option>
                          </select>
                        </div>
                      </div>
                      )}

                      {/* ── Actions ── */}
                      <div style={{ padding: '10px 12px', borderTop: sectionBorder, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={secLabel}>Actions</div>
                        <button onClick={handleDuplicateVisual}
                          style={{ width: '100%', padding: '5px 8px', background: dk ? 'rgba(255,255,255,0.04)' : '#F1F5F9', border: dk ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--v-text)', color: dk ? 'var(--v-text-muted)' : 'var(--v-text-faint)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                          Duplicate
                        </button>
                        <button onClick={handleDeleteVisual}
                          style={{ width: '100%', padding: '5px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--v-danger)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                          Delete
                        </button>
                      </div>

                      {/* Data — bind measures (always available so new/Library visuals can be filled) */}
                      <div style={{ padding: '10px 12px', borderTop: sectionBorder }}>
                        <div style={secLabel}>Measures</div>
                        {(selectedVisual.data?.measures || []).map((m, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 7px', marginBottom: 3, background: 'var(--v-surface-3)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', fontSize: 11, color: 'var(--v-text)' }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--v-mono)' }}>{m}</span>
                            <button title="Remove" onClick={() => editSpec(s => { const v = s.visuals.find(vi => vi.id === selectedVisualId); if (v) v.data = { ...v.data, measures: (v.data?.measures || []).filter((_, idx) => idx !== i) } })}
                              style={{ border: 'none', background: 'transparent', color: 'var(--v-text-faint)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                          </div>
                        ))}
                        <select value="" onChange={e => { const name = e.target.value; if (!name) return; editSpec(s => { const v = s.visuals.find(vi => vi.id === selectedVisualId); if (v) v.data = { ...v.data, measures: [...(v.data?.measures || []), name] } }) }}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '500 11px var(--v-font)', cursor: 'pointer', outline: 'none' }}>
                          <option value="">+ Add measure…</option>
                          {measures.filter(m => !((selectedVisual.data?.measures) || []).includes(m.name)).map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                        {measures.length === 0 && <div style={{ fontSize: 10, color: 'var(--v-text-faint)', marginTop: 4 }}>No model measures loaded.</div>}
                      </div>
                      </>)
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* ── View mode: AppSpecRenderer inside visible page frame ── */}
                  {(() => {
                    // Resolve the target page size so the frame reflects the exact
                    // dimensions the published PBI / exported web app will use.
                    const layout = generatedSpec.layout || {}
                    const presets = { '16:9':[1280,720], '16:10':[1280,800], '4:3':[1024,768], 'tall':[1280,1920], 'square':[1024,1024], 'auto':[1280,null], 'custom':[layout.pageWidth || 1280, layout.pageHeight || 720] }
                    const presetKey = layout.pagePreset || '16:9'
                    const [pw, ph]  = presets[presetKey] || [1280, 720]
                    const pageW = Number(layout.pageWidth)  || pw || 1280
                    const pageH = Number(layout.pageHeight) || ph  // may be null for 'auto'
                    const pageFrameStyle = {
                      margin: '24px auto',
                      width: pageW,
                      minHeight: pageH || 'auto',
                      background: canvasTheme === 'dark' ? '#0b0b12' : '#FFFFFF',
                      border: canvasTheme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--v-text)',
                      borderRadius: 8,
                      boxShadow: canvasTheme === 'dark' ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.08)',
                      padding: 16,
                      boxSizing: 'border-box',
                    }
                    return (
                      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                        <div style={pageFrameStyle}>
                          <AppSpecRenderer
                            key={`asr-edit-${echartsBarOn}`}
                            spec={_activePageSpec}
                            availableMeasures={measures}
                            canvasWidth={Math.min(canvasWidth || pageW, pageW)}
                            theme={canvasTheme}
                            onNavigatePage={setCurrentPageId}
                          />
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </>
          )}

          {/* Empty state */}
          {!generatedSpec && !generating && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 40, maxWidth: 440 }}>
                <div style={{ fontSize: 60, opacity: 0.12, marginBottom: 16, color: 'var(--v-accent)' }}>✦</div>
                <div style={{ color: canvasTheme === 'dark' ? 'var(--v-text-faint)' : 'var(--v-border-strong)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Describe your analytics app</div>
                <div style={{ color: canvasTheme === 'dark' ? 'var(--v-border-strong)' : 'var(--v-text-faint)', fontSize: 12, lineHeight: 1.6 }}>Type in the chat panel and I'll generate a complete dashboard connected to your Fabric semantic model.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Output chooser (S10): Publish to Power BI vs Export web app ── */}
      {outputChooser && (
        <Modal title="Export or publish" onClose={() => setOutputChooser(false)}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            How do you want to ship <b style={{ color: 'var(--text-primary)' }}>{appTitle || 'this dashboard'}</b>?
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <button onClick={() => { setOutputChooser(false); openPbiDialog() }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-sunken)' }}
              style={outputCardStyle}>
              <div style={{ ...outputIconStyle, background: 'var(--accent-subtle)', color: 'var(--accent)' }}><Upload size={18} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Publish to Power BI</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>Create a live report in your Fabric workspace. Each visual renders via the vilsem custom visual from auto-generated DAX.</div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            </button>
            {window.semantica?.exportAppPackage && (
              <button onClick={() => { setOutputChooser(false); openExportDialog() }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-sunken)' }}
                style={outputCardStyle}>
                <div style={{ ...outputIconStyle, background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}><Download size={18} /></div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Export web app</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>Download a self-contained, runnable package you can host or share.</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              </button>
            )}
            {/* Deploy to Fabric — SPIKE, feature-flagged (default OFF). Additive card. */}
            {FLAGS.fabricExport && window.semantica?.fabricDeploy && (
              <button onClick={() => { setOutputChooser(false); setFabricDialog({ spec: generatedSpec, appTitle }) }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-sunken)' }}
                style={outputCardStyle}>
                <div style={{ ...outputIconStyle, background: 'var(--surface-hover)', color: '#58AECB' }}><Upload size={18} /></div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Deploy to Fabric <span style={{ fontSize: 9, fontFamily: 'var(--v-mono)', color: '#E0A458' }}>· preview</span></div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>Generate a Rayfin data-app (one visual) and deploy it to a Fabric workspace via the Rayfin CLI.</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Deploy-to-Fabric dialog — SPIKE, only mounts when the card opened it. */}
      {fabricDialog && (
        <FabricDeployDialog spec={fabricDialog.spec} appTitle={fabricDialog.appTitle} onClose={() => setFabricDialog(null)} />
      )}

      {/* Publish-to-PBI dialog (Phase 3) */}
      {pbiDialog && (() => {
        const canClose = !pbiDialog.publishing
        const isDone   = pbiDialog.progress >= 100 && !pbiDialog.error

        async function runPublish() {
          if (pbiDialog.publishing) return
          if (!generatedSpec) {
            setPbiDialog((d) => ({ ...d, error: 'No app spec to publish', publishing: false }))
            return
          }
          setPbiDialog((d) => ({ ...d, publishing: true, error: null, progress: 5, stage: 'Starting…' }))

          try {
            const ws = await window.semantica.getWorkspaceConfig()
            const workspaceId = ws?.workspaceId
            const datasetId   = ws?.datasetId
            if (!workspaceId || !datasetId) {
              throw new Error('No active vilsem workspace/dataset. Connect one first.')
            }

            const reportName = (pbiDialog.reportName || '').trim() || (generatedSpec?.title || 'App Generator Report')

            // Check if a report with this name already exists
            let existingReportId = null
            try {
              const listRes = await window.semantica?.pbiListReports?.({ workspaceId, datasetId })
              const existing = listRes?.reports?.find((r) => r.name === reportName)
              if (existing) {
                const replace = confirm(`A report named "${reportName}" already exists.\n\nReplace it?`)
                if (!replace) { setPbiDialog((d) => d ? ({ ...d, publishing: false }) : d); return }
                existingReportId = existing.id
              }
            } catch { /* list failed — create new anyway */ }

            const rawPages = mapAppSpecToPages(generatedSpec)
            const pages    = filterRenderablePages(rawPages)
            const theme    = canvasTheme || generatedSpec?.theme?.mode || 'dark'

            const result = await publishCustomVisualFlow({
              pages,
              workspaceId,
              datasetId,
              reportId: existingReportId,
              reportName,
              workspaceName: ws?.workspaceName || '',
              datasetName:   ws?.datasetName   || '',
              canvasTheme:   theme,
              onProgress: (pct, stage) => {
                setPbiDialog((d) => d ? ({ ...d, progress: pct, stage }) : d)
              },
            })
            setPbiDialog((d) => d ? ({
              ...d,
              publishing: false,
              progress: 100,
              stage: 'Done',
              reportId: result.reportId,
              reportName: result.reportName,
              error: null,
            }) : d)
          } catch (err) {
            const msg = err?.message || String(err)
            console.error('[AppGenerator Publish-to-PBI] FAILED:', msg)
            setPbiDialog((d) => d ? ({ ...d, publishing: false, error: msg, stage: 'Failed' }) : d)
          }
        }

        return (
          <Modal
            title="Publish to Power BI"
            onClose={canClose ? () => setPbiDialog(null) : undefined}
            footer={
              <>
                <Button variant="secondary" onClick={() => setPbiDialog(null)} disabled={!canClose}>{isDone ? 'Close' : 'Cancel'}</Button>
                {!isDone && (
                  <Button variant="canvas" onClick={runPublish} disabled={pbiDialog.publishing || !pbiDialog.reportName?.trim()} loading={pbiDialog.publishing}>
                    {pbiDialog.publishing ? 'Publishing…' : 'Publish'}
                  </Button>
                )}
              </>
            }
          >
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Creates a Power BI report in your active Fabric workspace. Each visual renders via the vilsem custom visual from auto-generated DAX measures on your dataset.
            </div>

            {!isDone && (
              <Field label="Report name" className="" >
                <Input value={pbiDialog.reportName}
                  onChange={e => setPbiDialog(d => d ? ({ ...d, reportName: e.target.value }) : d)}
                  disabled={pbiDialog.publishing} />
              </Field>
            )}

            {(pbiDialog.publishing || isDone || pbiDialog.error) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: pbiDialog.error ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {pbiDialog.error ? <><AlertTriangle size={13} /> {pbiDialog.error}</> : (pbiDialog.stage || 'Starting…')}
                </div>
                <ProgressBar value={pbiDialog.progress || 0} />
              </div>
            )}

            {isDone && pbiDialog.reportId && (
              <div style={{ background: 'var(--success-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginTop: 14 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><CircleCheck size={14} /> Published</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  Report ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{pbiDialog.reportId}</span>
                </div>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* Save As dialog */}
      {saveAsDialog && (() => {
        const doSaveAs = async () => {
          const name = saveAsDialog.name.trim()
          if (!name) return
          setSaveAsDialog(null)
          try {
            const workspace = await window.semantica.getWorkspaceConfig()
            if (!workspace?.datasetId) throw new Error('No active workspace — connect to a dataset first')
            const result = await window.semantica.saveAppSpec({
              name,
              datasetId: workspace.datasetId,
              spec: { ...generatedSpec, title: name, theme: { ...(generatedSpec?.theme || {}), mode: canvasTheme || 'dark' }, _chatMessages: messages.filter(m => m.type === 'user' || m.type === 'ai').slice(-50) },
            })
            if (!result?.saved) throw new Error('Save returned no confirmation')
            setAppTitle(name)
            setGeneratedSpec(prev => prev ? { ...prev, title: name } : prev)
            addToast('Saved as "' + name + '"')
            try { await loadSavedApps() } catch { /* ignore */ }
          } catch (err) { addToast(err.message || 'Save failed', 'error') }
        }
        return (
          <Modal title="Save as" size="sm" onClose={() => setSaveAsDialog(null)}
            footer={<>
              <Button variant="secondary" onClick={() => setSaveAsDialog(null)}>Cancel</Button>
              <Button variant="primary" onClick={doSaveAs} disabled={!saveAsDialog.name.trim()}>Save</Button>
            </>}>
            <Input autoFocus value={saveAsDialog.name}
              onChange={e => setSaveAsDialog({ name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && saveAsDialog.name.trim()) doSaveAs() }}
              placeholder="Project name…" />
          </Modal>
        )
      })()}

      {/* Export dialog */}
      {exportDialog && (
        <Modal title="Export package" onClose={() => setExportDialog(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setExportDialog(null)}>Cancel</Button>
            <Button variant="canvas" iconLeft={<Download size={14} />} onClick={async () => {
              const dlg = exportDialog
              setExportDialog(null)
              try {
                  // Merge the current canvas theme into the spec so the
                  // exported web app and PBI both render the correct theme.
                  const specForExport = {
                    ...generatedSpec,
                    theme: { ...(generatedSpec?.theme || {}), mode: canvasTheme || 'dark' },
                  }
                  addToast('📦 Exporting package…')
                  const result = await window.semantica.exportAppPackage({
                    spec: specForExport,
                    appName: appTitle,
                    exportFolderName: dlg.exportFolderName,
                    credentials: dlg.prefill || dlg.authMode !== 'service_principal' ? {
                      tenantId: dlg.tenantId,
                      clientId: dlg.clientId,
                      clientSecret: dlg.clientSecret,
                      workspaceId: dlg.workspaceId,
                      datasetId: dlg.datasetId,
                    } : null,
                  })
                  if (result.canceled) { addToast('Export cancelled'); return }
                  addToast('✓ Package exported to ' + result.exportDir)
                  // Auto-run: npm install + node server.js + open browser
                  if (window.semantica?.runWebPreview && result.exportDir) {
                    addToast('📥 Installing dependencies…')
                    try {
                      const preview = await window.semantica.runWebPreview({ exportDir: result.exportDir })
                      if (preview.success) {
                        addToast(`🌐 Web app running at ${preview.url}`)
                      } else {
                        addToast(preview.message || 'Preview failed to start', 'error')
                      }
                    } catch (pe) {
                      addToast(pe.message || 'Preview failed', 'error')
                    }
                  }
                } catch (e) {
                  addToast(e.message || 'Export failed', 'error')
                }
              }}>
              Export & Open in Browser
            </Button>
          </>}
        >
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
            {exportDialog.authMode === 'service_principal'
              ? 'Service principal detected. Credentials can be pre-filled so the export runs immediately.'
              : 'Microsoft Account detected. Enter service principal credentials to make the export runnable.'}
          </div>
          <Field label="Export folder name">
            <Input value={exportDialog.exportFolderName || ''} onChange={e => setExportDialog(p => ({ ...p, exportFolderName: e.target.value }))} placeholder="my-dashboard" />
          </Field>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-faint)', margin: '3px 0 12px' }}>Created inside the folder you pick in the next step.</div>
          {exportDialog.authMode === 'service_principal' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
              <Toggle checked={exportDialog.prefill} onChange={v => setExportDialog(p => ({ ...p, prefill: v }))} />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Include credentials in .env (ready to run)</span>
            </label>
          )}
          {(exportDialog.prefill || exportDialog.authMode !== 'service_principal') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'tenantId', label: 'Tenant ID', placeholder: 'Azure AD tenant ID' },
                { key: 'clientId', label: 'Client ID', placeholder: 'App registration client ID' },
                { key: 'clientSecret', label: 'Client Secret', placeholder: 'App registration secret', type: 'password' },
                { key: 'workspaceId', label: 'Workspace ID', placeholder: 'Fabric workspace ID' },
                { key: 'datasetId', label: 'Dataset ID', placeholder: 'Semantic model ID' },
              ].map(field => (
                <Field key={field.key} label={field.label}>
                  <Input type={field.type || 'text'} value={exportDialog[field.key] || ''} onChange={e => setExportDialog(p => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }} />
                </Field>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Replace confirm modal */}
      {replaceConfirm && (
        <Modal title="Replace current canvas?" onClose={() => setReplaceConfirm(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setReplaceConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmReplace}>Replace canvas</Button>
          </>}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
            You're in <b>Replace</b> mode. Hitting send will regenerate the dashboard from scratch and discard your current visuals, filters, and edits.
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
            Tip: switch to <b>Refine</b> mode if you want to tweak the existing canvas (e.g. "add a filter", "make bars gold").
          </div>
          <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', maxHeight: 90, overflow: 'auto' }}>
            {replaceConfirm.prompt}
          </div>
        </Modal>
      )}

      {/* Toasts now render via the app-level ToastProvider (main.jsx). */}

      <style>{`
        @keyframes ag-spin   { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes ag-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-7px); } }
      `}</style>

      {/* Playground Spike — full-screen custom-visual authoring overlay */}
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
            if (!pgDatasetId) throw new Error('No active dataset — connect a workspace first')
            await window.semantica.saveCustomTemplate({ datasetId: pgDatasetId, template })
            await reloadCustomTemplates()
          }}
          onClose={() => setShowPlayground(false)}
        />
      )}
    </div>
  )
}
