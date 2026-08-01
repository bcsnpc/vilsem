import React, { useState, useEffect } from 'react'
import ReportPicker from './restyler/components/ReportPicker.jsx'
import { parseReportDefinition } from './restyler/pbirParser.js'
import { injectVisualsIntoReport } from './injector/injectorFlow.js'
import InjectorPageCanvas from './injector/InjectorPageCanvas.jsx'
import InjectorPagePicker from './injector/InjectorPagePicker.jsx'
import { mapAppSpecToPages } from './AppSpecToPowerBI.js'
import { ensurePages, getCurrentPage } from '../appspec/specEditing.js'
import { Button, IconButton } from '../ui/Button.jsx'
import { Input, Textarea, Select } from '../ui/Input.jsx'
import { Card } from '../ui/Surface.jsx'
import { Spinner, StatusDot, ProgressBar, Badge } from '../ui/Feedback.jsx'
import { Logo } from '../ui/Logo.jsx'
import { useTheme, setTheme } from '../ui/theme.js'
import { ArrowLeft, ArrowRight, Sparkles, Layers, AlertTriangle, CircleCheck, Upload, X, Pencil } from '../ui/icons.js'

// Detect whether a report's page background is light or dark, so the injector
// chrome can match it. Reads the first page.json's objects.background color.
// Returns 'light' | 'dark' | null (null = unknown, leave theme as-is).
function detectReportTheme(reportParts) {
  try {
    const pagePart = (reportParts || []).find(p => /definition\/pages\/[^/]+\/page\.json$/.test(p.path))
    if (!pagePart) return null
    const page = JSON.parse(pagePart.content)
    const bg = page?.objects?.background?.[0]?.properties?.color?.solid?.color?.expr?.Literal?.Value
    if (!bg) return null
    const hex = String(bg).replace(/'/g, '').trim()
    const m = hex.match(/^#?([0-9a-fA-F]{6})$/)
    if (!m) return null
    const n = parseInt(m[1], 16)
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? 'light' : 'dark'
  } catch { return null }
}

// Mirrors AppGenerator's provider list — same statusKey mapping so the
// `getAiStatus` shape lines up.
const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic',           statusKey: 'claude' },
  { id: 'openai',    label: 'OpenAI',              statusKey: 'openai' },
  { id: 'gemini',    label: 'Gemini',              statusKey: 'gemini' },
  { id: 'groq',      label: 'Groq',                statusKey: 'groq'   },
  { id: 'local',     label: 'Local (Phi-4-mini)',  statusKey: 'local'  },
]

/**
 * PbiInjector — inject Semantica visuals into an existing Power BI report.
 *
 * Flow:
 *   1. Pick a workspace + report (datasetId rides along)
 *   2. Generate visuals via LLM, pick the target page, click Inject:
 *        - Visuals render to HTML
 *        - _SemanticaHtml_<slug> measures merged into dataset TMDL
 *        - visual.json files appended under target page
 *        - HTML Content custom visual registered if missing
 *   3. Done — link straight to the report in PBI Service
 *
 * PBIR (modern) only — Microsoft is deprecating PBIR-Legacy starting 2026.
 */

const STEPS = [
  { id: 'pick',    label: 'Pick report' },
  { id: 'inject',  label: 'Generate & inject' },
  { id: 'done',    label: 'Done' },
]

export default function PbiInjector({ authCreds, connectionInfo, onBack }) {
  const [report,  setReport]  = useState(null)
  const [result,  setResult]  = useState(null)

  // The injector matches the target report's theme while open; restore the
  // user's chrome theme when leaving.
  useEffect(() => {
    const original = document.documentElement.dataset.theme || 'light'
    return () => { setTheme(original) }
  }, [])

  // State-driven flow (no wizard chrome — the shell provides the titlebar/breadcrumb):
  //   report picker → InjectStudio (page picker → canvas) → done.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--v-bg-0)', color: 'var(--v-text)', overflow: 'hidden' }}>
      {!report && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <ReportPicker authCreds={authCreds} onSelect={r => setReport(r)} />
        </div>
      )}
      {report && !result && (
        <InjectStudio
          report={report}
          authCreds={authCreds}
          connectionInfo={connectionInfo}
          onSuccess={(res) => setResult(res)}
          onExit={() => setReport(null)}
        />
      )}
      {result && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <DoneScreen report={report} result={result} onReset={() => setResult(null)} onBack={onBack} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InjectStudio: target-page picker + AI prompt + preview + Inject button
// ─────────────────────────────────────────────────────────────────────────────

function InjectStudio({ report, authCreds, connectionInfo, onSuccess, onExit }) {
  const [reportParts,    setReportParts]    = useState(null)
  const [parsedFormat,   setParsedFormat]   = useState(null)
  const [pages,          setPages]          = useState([])
  const [targetPageDir,  setTargetPageDir]  = useState(null)
  const [loadError,      setLoadError]      = useState('')
  const [loading,        setLoading]        = useState(false)

  const [description,    setDescription]    = useState('')
  const [generating,     setGenerating]     = useState(false)
  const [authoredSpec,   setAuthoredSpec]   = useState(null)  // multi-page editable AppSpec
  const [selectedVisualId, setSelectedVisualId] = useState(null)
  const [editorOpen,     setEditorOpen]     = useState(false) // fullscreen authoring editor
  const [canvasTheme,    setCanvasTheme]    = useState('light')
  const [modelCtx,       setModelCtx]       = useState(null)  // measures/tables for inspector
  const [datasetReady,   setDatasetReady]   = useState(false) // report dataset connected for generation
  const [datasetWarn,    setDatasetWarn]    = useState('')    // dataset-connect problem
  const [datasetLabel,   setDatasetLabel]   = useState('')    // which dataset generation targets
  const [rawPages,       setRawPages]       = useState([])    // parsed pages incl. existing visuals
  const [reportTheme,    setReportTheme]    = useState('light') // PBI default canvas is white
  const [genError,       setGenError]       = useState('')

  const [aiStatus,        setAiStatus]        = useState(null)
  const [availableModels, setAvailableModels] = useState({})
  const [selectedProvider, setSelectedProvider] = useState('anthropic')
  const [selectedModel,   setSelectedModel]   = useState('')

  // Load AI status + models on mount
  useEffect(() => {
    if (!window.semantica?.getAiStatus) return
    window.semantica.getAiStatus().then((s) => {
      setAiStatus(s)
      // Auto-pick first configured provider
      const firstConfigured = PROVIDERS.find((p) =>
        p.id === 'local' ? s?.local?.configured : s?.[p.statusKey]?.configured,
      )
      if (firstConfigured) setSelectedProvider(firstConfigured.id)
    }).catch(() => {})
    window.semantica.getAiModels?.().then((m) => {
      setAvailableModels(m || {})
    }).catch(() => {})
  }, [])

  // When provider changes, default model = first model for that provider
  useEffect(() => {
    const list = availableModels[selectedProvider] || []
    if (!list.length) { setSelectedModel(''); return }
    const first = typeof list[0] === 'string' ? list[0] : (list[0].id || list[0].name || list[0].model)
    setSelectedModel(first)
  }, [selectedProvider, availableModels])

  const measures   = modelCtx?.measures || []
  const dimensions = modelCtx?.tables || modelCtx?.dimensions || []

  const [progressPct,    setProgressPct]    = useState(0)
  const [progressStage,  setProgressStage]  = useState('')
  const [injecting,      setInjecting]      = useState(false)
  const [injectError,    setInjectError]    = useState('')

  // Connect to the report's dataset, THEN fetch its definition — in that order.
  // connectDataset reinitializes the engine token, so the subsequent
  // getToken()-based calls (report definition, inject) work even right after a
  // fresh sign-in; it also points generation at the report's own dataset (not a
  // stale globally-cached model) and loads its schema for the inspector.
  useEffect(() => {
    if (!report?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true); setLoadError('')
      setDatasetReady(false); setDatasetWarn(''); setDatasetLabel('')

      // 1. Connect to the report's dataset first (with the live session creds
      //    ReportPicker used — avoids "No credentials" + stale-cache fallback).
      try {
        if (report?.datasetId) {
          // Mirror Home.jsx's connect exactly — MUST include authMode (else it
          // defaults to service_principal and demands SP secrets) + the full
          // interactive token set (accessToken/refreshToken/expiresIn).
          const conn = await window.semantica?.connectDataset?.({
            workspaceId:  report.workspaceId,
            datasetId:    report.datasetId,
            datasetName:  report.datasetName || report.name || 'report dataset',
            authMode:     authCreds?.authMode || connectionInfo?.authMode,
            tenantId:     authCreds?.tenantId || connectionInfo?.tenantId,
            clientId:     authCreds?.clientId || connectionInfo?.clientId,
            clientSecret: authCreds?.clientSecret || connectionInfo?.clientSecret,
            accessToken:  authCreds?.accessToken,
            refreshToken: authCreds?.refreshToken,
            expiresIn:    authCreds?.expiresIn,
          })
          if (cancelled) return
          if (!conn?.success) setDatasetWarn(conn?.error || 'Could not connect to the report’s dataset — generation may use the wrong model.')
          else setDatasetLabel(report.datasetName || report.name || (report.datasetId?.slice(0, 8) + '…'))
        } else {
          setDatasetWarn('This report has no dataset id — generation will use the globally connected model.')
        }
        const ctx = await window.semantica?.getModelContext?.()
        if (!cancelled && ctx) { setModelCtx(ctx); try { window._modelCtx = ctx } catch { /* ignore */ } }
      } catch (e) {
        if (!cancelled) setDatasetWarn(e?.message || 'Dataset connect failed')
      }
      if (!cancelled) setDatasetReady(true)

      // 2. Now fetch + parse the report definition (engine token is set up).
      try {
        const res = await window.semantica?.pbiGetReportDefinitionV2?.({
          workspaceId: report.workspaceId, reportId: report.id, format: 'PBIR',
        })
        if (!res?.success) throw new Error(res?.message || 'Could not fetch report')
        if (cancelled) return

        const parsed = parseReportDefinition(res.parts)
        if (!parsed?.pages?.length) {
          throw new Error('Could not parse report — no pages found')
        }

        // parser normalizes both formats to the same shape; `id` is the
        // page's directory name (PBIR) or section name (Legacy). Either
        // works as the targetPageId for our injector.
        const normalized = parsed.pages.map((p) => ({
          dirName:     p.id,
          displayName: p.displayName || p.name || p.id,
          width:       Number(p.width)  || 1280,
          height:      Number(p.height) || 720,
          visualCount: Array.isArray(p.visuals) ? p.visuals.length : 0,
        }))

        setReportParts(res.parts)
        setParsedFormat(parsed.format || 'PBIR')
        setPages(normalized)
        setRawPages(parsed.pages)
        // Do NOT auto-select — the S5 page picker lets the user choose.

        // Match the injector chrome to the report's page background. No explicit
        // background = Power BI's default white canvas → light.
        const t = detectReportTheme(res.parts) || 'light'
        setReportTheme(t); setTheme(t); setCanvasTheme(t)

        // Snapshot the original — same path as restyler
        await window.semantica?.restyler?.backupWrite?.({
          reportId:    report.id,
          reportName:  report.name,
          workspaceId: report.workspaceId,
          parts:       res.parts,
        })
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load report')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [report?.id, report?.workspaceId])

  // Pick a page → seed an empty spec sized to it and land in the canvas.
  function handlePickPage(dirName) {
    const tp = pages.find(p => p.dirName === dirName)
    const pw = tp?.width || 1280, ph = tp?.height || 720
    setAuthoredSpec({
      version: '1.0',
      title: tp?.displayName || 'Injected visuals',
      layout: { pagePreset: 'custom', pageWidth: pw, pageHeight: ph, freeform: true },
      pages: [{ id: 'inject_page', name: tp?.displayName || 'Page', visuals: [], slicers: [] }],
    })
    setSelectedVisualId(null)
    setTargetPageDir(dirName)
  }

  async function handleGenerate() {
    const text = description.trim()
    if (!text || generating) return
    setGenerating(true); setGenError('')
    try {
      const res = await window.semantica.generateAppSpec({
        userDescription: text,
        provider:        selectedProvider,
        model:           selectedModel,
        currentSpec:     null,
      })
      const spec = res?.spec
      if (!spec) throw new Error('No spec returned from AI')

      // Author in the SAME 12-col grid as a new project. Size the page to the
      // target report page so the grid→px transform (mapAppSpecToPages) lands
      // visuals at the right scale. Conversion to pixels happens at inject time.
      const targetPage = pages.find(p => p.dirName === targetPageDir)
      const pw = targetPage?.width  || 1280
      const ph = targetPage?.height || 720
      const sized = ensurePages({
        ...spec,
        layout: { ...(spec.layout || {}), pagePreset: 'custom', pageWidth: pw, pageHeight: ph },
      })
      const firstVisuals = getCurrentPage(sized, null)?.visuals || []
      if (firstVisuals.length === 0) {
        throw new Error('LLM returned no visuals')
      }
      setAuthoredSpec(sized)
      setSelectedVisualId(firstVisuals[0]?.id || null)
      setEditorOpen(true)
    } catch (err) {
      setGenError(err.message || 'Generation failed')
    }
    setGenerating(false)
  }

  async function handleInject() {
    if (!authoredSpec || !targetPageDir || !reportParts) return
    setInjecting(true); setInjectError(''); setProgressPct(0); setProgressStage('')
    try {
      const targetPage = pages.find(p => p.dirName === targetPageDir)
      // Author in grid → convert to report pixels exactly like a new project's
      // publish (mapAppSpecToPages → gridToPx). Then drop the authored block
      // below existing page content so it doesn't overlap native visuals.
      const mapped = mapAppSpecToPages(authoredSpec)
      const finalVisuals = (mapped[0]?.visuals || []).filter(v => Array.isArray(v.measures) && v.measures.length > 0)
      if (finalVisuals.length === 0) {
        throw new Error('No renderable visuals — add at least one measure to each visual')
      }
      // WYSIWYG: inject at EXACTLY the authored position. The user placed each
      // visual relative to the existing content shown in the backdrop, so we do
      // NOT re-offset (previously computeFreeYBand shoved everything to the
      // bottom, which is why placement didn't match).

      const result = await injectVisualsIntoReport({
        report: {
          id:          report.id,
          name:        report.name,
          workspaceId: report.workspaceId,
          datasetId:   report.datasetId,
        },
        reportParts,
        format:        parsedFormat,
        targetPageDir,
        visuals:       finalVisuals,
        theme:         canvasTheme,
        onProgress:    (pct, stage) => { setProgressPct(pct); setProgressStage(stage) },
      })
      onSuccess?.({ ...result, pageDir: targetPageDir, pageName: targetPage?.displayName })
    } catch (err) {
      setInjectError(err.message || 'Inject failed')
    }
    setInjecting(false)
  }

  if (loading) return <CenteredMsg><Spinner size={22} />Fetching report definition…</CenteredMsg>
  if (loadError) return <CenteredMsg color="var(--danger)"><AlertTriangle size={20} /> {loadError}</CenteredMsg>
  if (!pages.length) return <CenteredMsg color="var(--danger)">No pages found in report.</CenteredMsg>

  // S5 — pick the page to inject onto before authoring (mockup).
  if (!targetPageDir) {
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <InjectorPagePicker report={report} pages={pages} onPick={handlePickPage} />
      </div>
    )
  }

  // targetPageDir set → author directly in the canvas (S6), same as a new project.
  if (!authoredSpec) return <CenteredMsg><Spinner size={20} /> Preparing canvas…</CenteredMsg>
  return (
    <InjectorPageCanvas
      spec={authoredSpec}
      setSpec={setAuthoredSpec}
      currentPageId={getCurrentPage(authoredSpec, null)?.id}
      selectedVisualId={selectedVisualId}
      setSelectedVisualId={setSelectedVisualId}
      canvasTheme={canvasTheme}
      measures={measures}
      dimensions={dimensions}
      datasetId={report?.datasetId || ''}
      pageName={pages.find(p => p.dirName === targetPageDir)?.displayName || targetPageDir}
      existingVisuals={(() => {
        const targetRaw = rawPages.find(p => p.id === targetPageDir)
        return (targetRaw?.visuals || []).map(v => ({
          x: v.position?.x, y: v.position?.y, width: v.position?.width, height: v.position?.height, visualType: v.visualType,
        }))
      })()}
      existingNote={(() => {
        const tp = pages.find(p => p.dirName === targetPageDir)
        const base = tp?.visualCount
          ? `Injecting below ${tp.visualCount} existing visual${tp.visualCount === 1 ? '' : 's'}`
          : `Authoring for ${tp?.displayName || 'page'}`
        const ds = datasetWarn ? `⚠ ${datasetWarn}`
          : datasetLabel ? `data: ${datasetLabel}`
          : (report?.datasetId ? '' : '⚠ report has no datasetId — using globally connected model')
        return ds ? `${base} · ${ds}` : base
      })()}
      embed={{ embedUrl: report?.raw?.embedUrl || null, reportId: report?.id, pageName: targetPageDir }}
      onBack={() => { setTargetPageDir(null); setAuthoredSpec(null); setSelectedVisualId(null) }}
      onInject={handleInject}
      injecting={injecting}
      progressPct={progressPct}
      progressStage={progressStage}
      injectError={injectError}
      aiStatus={aiStatus}
      availableModels={availableModels}
      selectedProvider={selectedProvider}
      setSelectedProvider={setSelectedProvider}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      PROVIDERS={PROVIDERS}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Position helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the lowest empty Y on the target page so injected visuals don't overlap
 * existing ones. Handles both PBIR (visual.json per visual) and PBIR-Legacy
 * (visualContainers inside report.json sections[]).
 */
function computeFreeYBand(reportParts, pageId) {
  let maxBottom = 0

  // PBIR: scan visual.json files under the target page directory
  for (const part of reportParts) {
    const m = part.path.match(new RegExp(`^definition/pages/${pageId}/visuals/[^/]+/visual\\.json$`))
    if (!m) continue
    try {
      const v = JSON.parse(part.content)
      const y = Number(v?.position?.y) || 0
      const h = Number(v?.position?.height) || 0
      if (y + h > maxBottom) maxBottom = y + h
    } catch { /* ignore malformed */ }
  }

  // PBIR-Legacy: read report.json sections[].visualContainers[]
  if (maxBottom === 0) {
    const reportPart = reportParts.find((p) =>
      p.path === 'report.json' || p.path === 'definition/report.json',
    )
    if (reportPart) {
      try {
        const report = JSON.parse(reportPart.content)
        const section = (report.sections || []).find(
          (s) => s.name === pageId || s.displayName === pageId,
        )
        for (const c of (section?.visualContainers || [])) {
          // Position lives at container level OR inside config.layouts[0].position
          let y = Number(c?.y) || 0
          let h = Number(c?.height) || 0
          if (!y && !h && typeof c?.config === 'string') {
            try {
              const inner = JSON.parse(c.config)
              const pos = inner?.layouts?.[0]?.position
              y = Number(pos?.y) || 0
              h = Number(pos?.height) || 0
            } catch { /* ignore inner parse */ }
          }
          if (y + h > maxBottom) maxBottom = y + h
        }
      } catch { /* ignore malformed report.json */ }
    }
  }

  return maxBottom > 0 ? Math.ceil(maxBottom) + 16 : 24
}

/**
 * Lay out new visuals starting at startY, wrapping rows to fit pageWidth.
 * Each visual gets an HTML-Content-friendly default size if it doesn't have one.
 */
function stackVisuals(visuals, startY, pageWidth) {
  const out = []
  let x = 0
  let y = startY
  let rowMaxH = 0
  for (const v of visuals) {
    const w = Number(v.width)  > 0 ? Number(v.width)  : 420
    const h = Number(v.height) > 0 ? Number(v.height) : 280
    if (x + w > pageWidth) {
      x = 0
      y += rowMaxH + 12
      rowMaxH = 0
    }
    out.push({ ...v, x, y, width: w, height: h })
    x += w + 12
    if (h > rowMaxH) rowMaxH = h
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview card — small placeholder showing visual type + measures
// ─────────────────────────────────────────────────────────────────────────────

function VisualPreviewCard({ visual }) {
  const measures = (visual.measures || []).join(', ')
  const dim = visual.dimension || ''
  return (
    <div style={{
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)', padding: 12,
    }}>
      <Badge variant="accent">{visual.type}</Badge>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 600, margin: '6px 0' }}>
        {visual.title || measures || visual.id}
      </div>
      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {measures && <div>{measures}</div>}
        {dim && <div>{dim}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Done screen
// ─────────────────────────────────────────────────────────────────────────────

function DoneScreen({ report, result, onReset, onBack }) {
  const url = report
    ? `https://app.powerbi.com/groups/${report.workspaceId}/reports/${report.id}`
    : null

  return (
    <div style={{ maxWidth: 720, margin: '60px auto', textAlign: 'center', padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--success)' }}><CircleCheck size={52} /></div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)', color: 'var(--text-primary)', fontWeight: 700, marginBottom: 12 }}>
        Injected {result?.injectedVisualIds?.length || 0} visual{(result?.injectedVisualIds?.length || 0) === 1 ? '' : 's'}
      </div>
      <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
        Refresh <strong style={{ color: 'var(--text-primary)' }}>{report?.name}</strong> in Power BI Service to see the new visuals on
        <strong style={{ color: 'var(--accent)', marginLeft: 4 }}>{result?.pageName || result?.pageDir}</strong>.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Button variant="canvas" iconRight={<ArrowRight size={15} />}>Open in PBI Service</Button>
          </a>
        )}
        <Button variant="secondary" onClick={onReset}>Inject more</Button>
        <Button variant="ghost" onClick={onBack}>Home</Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout chrome
// ─────────────────────────────────────────────────────────────────────────────

function Topbar({ onBack, report, connectionInfo }) {
  return (
    <div className="titlebar-drag" style={{
      height: 52, flexShrink: 0, background: 'var(--surface-raised)',
      display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {/* window-control dots removed — the vilsem shell owns window controls */}
      <div className="no-drag"><Button variant="ghost" size="sm" onClick={onBack} iconLeft={<ArrowLeft size={15} />}>Home</Button></div>
      <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Layers size={16} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}>PBI Injector</span>
      </span>
      {report && (
        <>
          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{report.name}</span>
        </>
      )}
      <div style={{ flex: 1 }} />
      {connectionInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
          <StatusDot tone="success" /> Connected
        </div>
      )}
    </div>
  )
}

function StepIndicator({ steps, current, onJump }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '14px 24px', flexShrink: 0,
      borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)',
    }}>
      {steps.map((s, i) => {
        const isActive = i === current
        const isDone   = i < current
        return (
          <React.Fragment key={s.id}>
            <button onClick={() => onJump(i)} disabled={!isDone && !isActive}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                borderRadius: 'var(--radius-md)', padding: '6px 12px',
                cursor: (isDone || isActive) ? 'pointer' : 'default',
                fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                color: isActive ? 'var(--accent)' : isDone ? 'var(--text-secondary)' : 'var(--text-faint)',
                fontWeight: isActive ? 600 : 500,
              }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: isActive || isDone ? 'var(--accent)' : 'var(--surface-sunken)',
                color: isActive || isDone ? 'var(--accent-contrast)' : 'var(--text-faint)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>
                {isDone ? '✓' : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>›</span>}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function Footer({ canPrev, onPrev, stepLabel }) {
  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--surface-raised)',
    }}>
      <Button variant="secondary" size="sm" onClick={onPrev} disabled={!canPrev} iconLeft={<ArrowLeft size={14} />}>Previous</Button>
      <div style={{ flex: 1, fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{stepLabel}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers + styles
// ─────────────────────────────────────────────────────────────────────────────

function CenteredMsg({ children, color }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: color || 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </Card>
  )
}

const inputStyle = {
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  padding: '8px 12px', fontSize: 'var(--fs-sm)',
  borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit',
}

const selectStyle = {
  flex: '0 0 40%',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  padding: '6px 8px', fontSize: 'var(--fs-sm)',
  borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit',
  cursor: 'pointer',
}

const errorBoxStyle = {
  background: 'var(--danger-subtle)',
  color: 'var(--danger)',
  borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: 'var(--fs-sm)',
  alignSelf: 'center',
}

function tabBtnStyle(active) {
  return {
    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)',
    background: active ? 'var(--accent-subtle)' : 'transparent',
    border: active ? '1px solid var(--accent-border)' : '1px solid var(--border-default)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }
}

function primaryBtnStyle(disabled, larger = false) {
  return {
    background: disabled ? 'var(--accent-subtle)' : 'var(--accent)',
    border: 'none', color: disabled ? 'var(--text-faint)' : 'var(--accent-contrast)', borderRadius: 'var(--radius-md)',
    padding: larger ? '11px 22px' : '9px 16px',
    fontSize: larger ? 'var(--fs-body)' : 'var(--fs-sm)', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }
}
