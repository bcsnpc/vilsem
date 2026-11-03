import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageManager        from './PageManager.jsx'
import LiveCanvas         from './LiveCanvas.jsx'
import InspectorPanel     from './InspectorPanel.jsx'
import { parseReportParts } from './reportParser.js'
import { buildReportParts } from './reportBuilder.js'
import { publishHtmlContentFlow } from './publishHtmlContentFlow.js'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'

/**
 * ReportEditor — main editing view of Power BI Mode.
 *
 * Owns all editor state. Three columns:
 *   PageManager (240px) │ CanvasPreview (flex) │ InspectorPanel (320px)
 *
 * On mount, if an existing report.id is provided, calls
 * pbiGetReportDefinition. Page parsing from .pbix is intentionally
 * minimal here — full parser comes in the next step. We gracefully
 * fall back to a single default page if anything fails.
 */
export default function ReportEditor({
  report,
  workspaceId,
  datasetId,
  connectionInfo,
  reportName: reportNameProp,
  onRenameReport,
  initialDraft,
  onPublish,
  onBack,
}) {
  const T = getThemeTokens('dark')

  const isNewReport = !report?.id
  const reportName  = reportNameProp || report?.name || 'New Semantica Report'

  // ── Editor state ──────────────────────────────────────────────────────
  const [pages, setPages] = useState(() => [makePage('Page 1')])
  const [activePageId, setActivePageId] = useState(() => pages[0].id)
  const [selectedVisualId, setSelectedVisualId] = useState(null)

  const [injectionScope, setInjectionScope] = useState('fullpage')
  const [renderer,       setRenderer]       = useState('htmlcontent')

  // Canvas display state — theme + collapse toggles for the bigger-canvas Phase C
  const [canvasTheme,         setCanvasTheme]         = useState('dark')   // 'dark' | 'light'
  const [pageManagerCollapsed,setPageManagerCollapsed]= useState(false)
  const [inspectorCollapsed,  setInspectorCollapsed]  = useState(false)

  const [loadingDef, setLoadingDef] = useState(false)
  const [loadError,  setLoadError]  = useState(null)
  const [originalParts, setOriginalParts] = useState(null)
  // True while the load effect is fetching the report definition from Fabric.
  // Used to disable Publish so the user can't click before originalParts arrives.
  const [reportLoading, setReportLoading] = useState(false)
  // Mirror originalParts into a ref so handlePublish always reads the latest
  // value, even if it was captured by a closure before the load effect resolved.
  const originalPartsRef = useRef(null)

  // Draft state — local SQLite persistence
  const [draftBanner,    setDraftBanner]    = useState(null)   // { draft, savedAt } | null
  const [savingDraft,    setSavingDraft]    = useState(false)
  const [lastSavedAt,    setLastSavedAt]    = useState(null)
  const [showSavedToast, setShowSavedToast] = useState(false)
  // Detect "actual" changes by snapshotting pages JSON; auto-save only when this differs.
  const lastSavedSignatureRef  = useRef(null)
  const initialDraftAppliedRef = useRef(false)
  // Tracks whether the user has touched the editor since the last report load.
  // If true, the load effect must NOT overwrite pages with parsed-from-Fabric data
  // (otherwise it races and wipes any visuals the user just added).
  const userMutatedRef = useRef(false)

  // Publish flow state
  const [publishing,      setPublishing]      = useState(false)
  const [publishProgress, setPublishProgress] = useState(0)
  const [publishStage,    setPublishStage]    = useState('')
  const [publishError,    setPublishError]    = useState(null)

  // Measures + dimensions for the visual picker — same source as AppGenerator
  const [measures,   setMeasures]   = useState([])
  const [dimensions, setDimensions] = useState([])

  useEffect(() => {
    if (!window.semantica) return
    window.semantica.getMeasures()
      .then((m) => setMeasures(m?.measures || []))
      .catch(() => {})
    window.semantica.getDimensions()
      .then((d) => setDimensions(d?.tables || []))
      .catch(() => {})
  }, [])

  // ── Load existing report definition (Fabric Items API) ─────────────
  useEffect(() => {
    let cancelled = false

    // Reset the user-mutated flag whenever the effect runs for a different
    // report id. The effect deps include report?.id so a new report id triggers
    // a fresh run, and we want a fresh slate for tracking edits.
    if (userMutatedRef.lastResetForReportId !== report?.id) {
      userMutatedRef.current = false
      userMutatedRef.lastResetForReportId = report?.id
    }

    async function load() {
      console.log('[PBI Load] effect running, report:', report?.id, 'isNew:', !report?.id)

      // If the user came in via "Continue Draft" we apply the draft directly
      // and skip the network round-trip — they're explicitly resuming local work.
      if (initialDraft && !initialDraftAppliedRef.current) {
        initialDraftAppliedRef.current = true
        applyDraftToState(initialDraft)
        return
      }

      if (isNewReport) {
        // Even for new reports we want to surface any saved draft for this name
        // so the user doesn't accidentally start over. Skip silently if no IPC.
        return
      }
      if (!window.semantica?.pbiGetReportDefinitionV2) return
      if (!workspaceId || !report?.id) return

      setReportLoading(true)
      setLoadingDef(true)
      setLoadError(null)
      setOriginalParts(null)
      // Only clear the ref when the user is actually switching to a different
      // report. React StrictMode runs the effect twice in dev — without this
      // guard, the second run would null-out a ref that the first run already
      // populated, then potentially get cancelled before re-fetching.
      if (originalPartsRef.currentReportId !== report?.id) {
        originalPartsRef.current = null
        originalPartsRef.currentReportId = report?.id
      }

      try {
        // Check for an existing draft for this report — if present, surface
        // it via the restore banner (don't auto-restore unless user clicks).
        if (window.semantica?.pbiGetDraftForReport) {
          try {
            const draftRes = await window.semantica.pbiGetDraftForReport({
              workspaceId,
              reportId: report.id,
            })
            if (!cancelled && draftRes?.success && draftRes.draft) {
              setDraftBanner({ draft: draftRes.draft, savedAt: draftRes.draft.updatedAt })
            }
          } catch { /* draft check is best-effort */ }
        }

        const res = await window.semantica.pbiGetReportDefinitionV2({
          workspaceId,
          reportId: report.id,
        })
        if (cancelled) return

        console.log('[PBI Load] res:', res?.success, 'parts count:', res?.parts?.length, 'format:', res?.format)

        // Debug logging requested in FIX 2 — visible in renderer DevTools
        console.log('[PowerBI] PBI definition parts:',
          res?.parts?.map((p) => p.path) || res)

        if (!res?.success) {
          // Surface the actual failure detail — Chrome collapses object logs as
          // "Object" so we explicitly stringify the message + status here.
          console.error('[PBI Load] FAILURE message:', res?.message, 'status:', res?.status, 'full res:', res)
          setLoadError(res?.message || 'Failed to load report definition')
          const fallback = [makePage('Page 1')]
          setPages(fallback)
          setActivePageId(fallback[0].id)
          return
        }

        // Keep the original parts around so the builder can mutate them on publish
        setOriginalParts(res.parts || [])
        originalPartsRef.current = res.parts || []
        console.log('[PBI Load] originalParts set to:', originalPartsRef.current?.length)

        // Parse the parts → editor pages
        const parsed = parseReportParts(res.parts || [])
        if (cancelled) return

        // Debug logging requested in FIX 2
        console.log('[PowerBI] Parsed pages:', parsed.pages, 'format:', parsed.format)

        // PROBE — dump every visualType string found in the loaded report so we
        // can discover the exact identifier Power BI assigns to org-uploaded
        // custom visuals (it's NOT always the pbiviz.json guid).
        const probeTypes = parsed.pages.flatMap((p) =>
          (p.visuals || []).map((v) => ({
            id:   v.id,
            type: v.type,
            name: v.title || v.name || '',
          }))
        )
        console.log('[PBI Probe] ALL visual types in this report:', probeTypes)
        for (const pt of probeTypes) {
          console.log('[PBI Probe] visualType string →', JSON.stringify(pt.type))
        }

        if (parsed.pages && parsed.pages.length > 0) {
          // RACE GUARD: if the user has already added/edited visuals while
          // the API call was in flight, do NOT overwrite their work. We still
          // keep originalParts (already set above) so publish has the
          // canonical layout to mutate.
          if (userMutatedRef.current) {
            console.warn('[PBI Load] Skipping setPages — user has already mutated the editor since load started. Keeping their visuals; originalParts still updated.')
            // No setPages, no setActivePageId — the user's state stays intact.
          } else {
            const normalized = parsed.pages.map((p) => ({
              id:         p.id,
              name:       p.name,
              width:      p.width,
              height:     p.height,
              background: p.background,
              visuals:    (p.visuals || []).map((v) => ({
                id:         v.id,
                type:       mapPbiTypeToSemantica(v.type),
                title:      v.title || '',
                x:          v.x,
                y:          v.y,
                width:      v.width,
                height:     v.height,
                measures:   [],
                dimension:  null,
                isExisting: !v.isSemantica,  // existing non-Semantica visuals show as grey ghosts
              })),
              settings: p.settings || { hideHeaders: true, hideNav: false, gridlines: false },
            }))
            setPages(normalized)
            setActivePageId(normalized[0].id)
            // Reset auto-save signature so the freshly-loaded report isn't immediately re-saved
            lastSavedSignatureRef.current = signatureFor(normalized, injectionScope, renderer, reportName)
            if (parsed.error) {
              setLoadError(`${parsed.error} — loaded ${normalized.length} page${normalized.length !== 1 ? 's' : ''} anyway.`)
            }
          }
        } else {
          setLoadError(parsed.error || 'No pages found in report')
          const fallback = [makePage('Page 1')]
          setPages(fallback)
          setActivePageId(fallback[0].id)
        }
      } catch (e) {
        if (cancelled) return
        setLoadError(e.message || 'Failed to load report definition')
        const fallback = [makePage('Page 1')]
        setPages(fallback)
        setActivePageId(fallback[0].id)
      } finally {
        if (!cancelled) {
          setLoadingDef(false)
          setReportLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, workspaceId, initialDraft])

  // ── Derived state ────────────────────────────────────────────────────
  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) || null,
    [pages, activePageId]
  )

  const hasAnyVisual = useMemo(
    () => pages.some((p) => (p.visuals?.length || 0) > 0),
    [pages]
  )

  // ── Draft persistence ────────────────────────────────────────────────

  /**
   * Replace editor state with a saved draft. Used by both initial mount
   * (when launched from "Continue Draft") and the restore-banner button.
   */
  function applyDraftToState(draft) {
    if (!draft) return
    const dpages = Array.isArray(draft.pages) && draft.pages.length > 0
      ? draft.pages
      : [makePage('Page 1')]
    setPages(dpages)
    setActivePageId(dpages[0]?.id || null)
    setSelectedVisualId(null)
    if (draft.injectionScope) setInjectionScope(draft.injectionScope)
    if (draft.renderer)       setRenderer(draft.renderer)
    if (draft.reportName && onRenameReport) onRenameReport(draft.reportName)
    setDraftBanner(null)
    // Reset auto-save signature so we don't immediately re-save the restored state
    lastSavedSignatureRef.current = signatureFor(dpages, draft.injectionScope, draft.renderer, draft.reportName)
    setLastSavedAt(draft.updatedAt || draft.savedAt || null)
  }

  const saveDraft = useCallback(async ({ silent } = {}) => {
    if (!window.semantica?.pbiSaveDraft) return
    if (!workspaceId)                    return
    if (savingDraft)                     return

    setSavingDraft(true)
    try {
      const res = await window.semantica.pbiSaveDraft({
        reportId:       report?.id || null,
        workspaceId,
        reportName,
        pages,
        injectionScope,
        renderer,
      })
      if (res?.success) {
        const sig = signatureFor(pages, injectionScope, renderer, reportName)
        lastSavedSignatureRef.current = sig
        setLastSavedAt(res.savedAt || new Date().toISOString())
        if (!silent) {
          setShowSavedToast(true)
          setTimeout(() => setShowSavedToast(false), 2000)
        }
      }
    } catch {
      /* swallow — draft save is best-effort */
    } finally {
      setSavingDraft(false)
    }
  }, [workspaceId, reportName, pages, injectionScope, renderer, report?.id, savingDraft])

  // Auto-save every 2 minutes if state has changed since last save
  useEffect(() => {
    if (!window.semantica?.pbiSaveDraft) return
    const interval = setInterval(() => {
      const sig = signatureFor(pages, injectionScope, renderer, reportName)
      if (sig !== lastSavedSignatureRef.current) {
        saveDraft({ silent: true })
      }
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [pages, injectionScope, renderer, reportName, saveDraft])

  // ── Page mutators ────────────────────────────────────────────────────
  function handleAddPage() {
    userMutatedRef.current = true
    setPages((prev) => {
      const next = [...prev, makePage(`Page ${prev.length + 1}`)]
      return next
    })
    // Activate the freshly added page
    setTimeout(() => {
      setPages((latest) => {
        const last = latest[latest.length - 1]
        if (last) setActivePageId(last.id)
        return latest
      })
    }, 0)
  }

  function handleRenamePage(id, name) {
    userMutatedRef.current = true
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  function handleDeletePage(id) {
    userMutatedRef.current = true
    setPages((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((p) => p.id !== id)
      if (id === activePageId) setActivePageId(next[0].id)
      return next
    })
  }

  function handleUpdatePage(id, patch) {
    userMutatedRef.current = true
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  // ── Visual mutators ──────────────────────────────────────────────────
  function handleAddVisual(template) {
    console.log('[Editor] Visual received from inspector:', template)
    console.log('[Editor] Visual measures:', template?.measures)
    if (!activePage) return
    userMutatedRef.current = true
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== activePageId) return p
        const existing = p.visuals || []
        // Naive auto-layout: stack at 40,40 then offset by 30 for each existing
        const offset = existing.length * 30
        const v = {
          id:          uid(),
          type:        template.type,
          title:       template.title,
          measures:    template.measures || [],
          dimension:   template.dimension || null,
          colorScheme: template.colorScheme || 'teal',
          x: 40 + offset,
          y: 40 + offset,
          width:  420,
          height: 280,
        }
        console.log('[Editor] Stored visual in pages state:', v)
        return { ...p, visuals: [...existing, v] }
      })
    )
  }

  function handleSelectVisual(visualId) {
    setSelectedVisualId(visualId)
  }

  function handleDeleteVisual(visualId) {
    userMutatedRef.current = true
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== activePageId) return p
        return { ...p, visuals: (p.visuals || []).filter((v) => v.id !== visualId) }
      })
    )
    if (selectedVisualId === visualId) setSelectedVisualId(null)
  }

  // ── Publish flow (Fabric Items API) ──────────────────────────────────
  async function handlePublish() {
    console.log('[PBI Publish] starting publish...')
    console.log('[PBI Publish] workspaceId:', workspaceId)
    console.log('[PBI Publish] report:', report)
    console.log('[PBI Publish] originalParts:', originalParts?.map((p) => p.path))
    console.log('[PBI Publish] pages:', pages)

    if (reportLoading) {
      console.warn('[PBI] Publish blocked — report still loading')
      return
    }
    if (publishing) return
    if (!hasAnyVisual) {
      setPublishError('Add at least one visual first.')
      return
    }
    const isExisting = !!report?.id
    const ipcReady = isExisting
      ? !!window.semantica?.pbiUpdateReportDefinition
      : !!window.semantica?.pbiCreateReport
    if (!ipcReady) {
      setPublishError('Publishing is only available inside the Semantica desktop app.')
      return
    }
    if (!workspaceId) {
      setPublishError('No active workspace.')
      return
    }

    setPublishError(null)
    setPublishing(true)
    setPublishProgress(8)
    setPublishStage('Pre-fetching visual data…')

    try {
      // Phase D — pre-fetch data for every visual on every page so the
      // builder can render each visual to a static HTML string before we
      // ship the parts to Fabric. Visuals without measures are skipped
      // (they're filtered out by the builder anyway).
      const visualDataMap = new Map()
      const totalVisuals = pages.reduce((n, p) => n + (p.visuals?.length || 0), 0)
      let fetched = 0
      for (const page of pages) {
        for (const v of (page.visuals || [])) {
          if (!Array.isArray(v.measures) || v.measures.length === 0) continue
          try {
            const dim = parseDimensionString(v.dimension)
            const result = dim
              ? await window.semantica.queryTable({
                  groupBy: [v.dimension],
                  measures: v.measures,
                  filters: {},
                  limit:   v.limit || 25,
                  orderBy: 'desc',
                })
              : await window.semantica.query({
                  measures: v.measures,
                  filters: {},
                })
            visualDataMap.set(v.id, result)
          } catch (e) {
            console.warn('[PBI Publish] data fetch failed for', v.id, e?.message)
            visualDataMap.set(v.id, null)
          }
          fetched++
          setPublishProgress(8 + Math.round((fetched / Math.max(totalVisuals, 1)) * 14))
        }
      }
      console.log('[PBI Publish] pre-fetched data for', visualDataMap.size, 'visuals')

      setPublishStage('Building report parts…')
      // Build the parts array — modifies originalParts if present, or
      // assembles a minimal report.json + definition.pbir + .platform skeleton.
      // Read from the ref so we always see the latest value, never a stale closure.
      const liveOriginalParts = originalPartsRef.current
      console.log('[PBI] originalParts at build time:', liveOriginalParts)

      // Load the bundled vilsem Renderer .pbiviz so buildReportParts can
      // embed it in every report. This bypasses the tenant's org-visual
      // library entirely — every report is self-contained.
      let pbiviz = null
      try {
        pbiviz = await window.semantica.pbiGetBundledPbiviz()
        if (!pbiviz?.success) {
          console.warn('[PBI Publish] bundled .pbiviz unavailable:', pbiviz?.message)
          pbiviz = null
        } else {
          console.log('[PBI Publish] bundled .pbiviz loaded:',
            pbiviz.filename, 'guid=' + pbiviz.guid, pbiviz.sizeBytes + ' bytes')
        }
      } catch (e) {
        console.warn('[PBI Publish] failed to load bundled .pbiviz:', e?.message)
      }

      const parts = buildReportParts({
        originalParts: liveOriginalParts,
        pages,
        datasetId,
        reportName,
        // Display names — needed only by the new-report path to construct
        // the connectionString in definition.pbir. Pulled from connectionInfo
        // which is already passed in from PowerBIMode.
        workspaceName: connectionInfo?.workspaceName || '',
        datasetName:   connectionInfo?.datasetName   || '',
        injectionScope,
        renderer,
        measuresList: measures,
        // Phase D: pre-rendered HTML data for each visual.
        visualDataMap,
        canvasTheme,
        pbiviz,
      })

      console.log('[PBI Publish] built parts:', parts?.map((p) => p.path))

      setPublishProgress(30)
      setPublishStage(isExisting ? 'Updating report on Fabric…' : 'Creating report on Fabric…')

      const res = isExisting
        ? await window.semantica.pbiUpdateReportDefinition({
            workspaceId,
            reportId: report.id,
            parts,
          })
        : await window.semantica.pbiCreateReport({
            workspaceId,
            reportName,
            parts,
          })

      console.log('[PBI Publish] IPC result:', JSON.stringify(res, null, 2))

      // The IPC handler does the LRO polling internally and only resolves
      // once the operation has Succeeded or Failed.
      setPublishProgress(85)
      setPublishStage(`Status: ${res?.status || (res?.success ? 'Succeeded' : 'Failed')}`)

      if (!res?.success) {
        throw new Error(res?.message || 'Publish failed')
      }

      setPublishProgress(100)
      setPublishStage('Done')

      const finalReportId = res.reportId || (isExisting ? report.id : null)

      // Brief pause so the user actually sees 100%
      await new Promise((r) => setTimeout(r, 350))

      onPublish?.({
        success:     true,
        reportId:    finalReportId,
        reportName,
        operationId: res.operationId || null,
        importState: res.status || 'Succeeded',
      })
    } catch (e) {
      const msg = e.message || 'Publish failed'
      setPublishError(msg)
      // Surface failures to the parent so PublishResult can render them
      onPublish?.({
        success:   false,
        reportId:  null,
        reportName,
        error:     msg,
      })
    } finally {
      setPublishing(false)
    }
  }

  // ── HTML Content publish flow (separate path, additive) ──────────────
  // Pushes auto-generated DAX measures into the dataset via TMDL
  // updateDefinition, then publishes a PBIR report that binds each
  // visual to its measure via Daniel Marsh-Patrick's HTML Content visual.
  // Completely independent of handlePublish() above — nothing is shared
  // beyond reading pages/measures state.
  async function handlePublishHtmlContent() {
    if (publishing) return
    if (reportLoading) return
    if (!hasAnyVisual) { setPublishError('Add at least one visual first.'); return }
    const workspaceId = connectionInfo?.workspaceId
    const datasetId   = connectionInfo?.datasetId
    if (!workspaceId || !datasetId) { setPublishError('No active workspace/dataset.'); return }

    setPublishError(null)
    setPublishing(true)
    setPublishProgress(5)
    setPublishStage('Starting…')

    try {
      const result = await publishHtmlContentFlow({
        pages,
        workspaceId,
        datasetId,
        reportId:      report?.id || null,
        reportName,
        workspaceName: connectionInfo?.workspaceName || '',
        datasetName:   connectionInfo?.datasetName   || '',
        canvasTheme,
        originalParts: originalPartsRef.current,
        onProgress: (pct, stage) => {
          setPublishProgress(pct)
          setPublishStage(stage)
        },
      })
      onPublish?.({
        success:            true,
        reportId:           result.reportId,
        reportName:         result.reportName,
        mode:               'htmlcontent',
        measuresByVisualId: result.measuresByVisualId,
        tableName:          result.tableName,
      })
    } catch (err) {
      const msg = err?.message || String(err)
      console.error('[HTMLContent Publish] FAILED:', msg)
      setPublishError(msg)
      onPublish?.({ success: false, reportId: null, reportName, error: msg, mode: 'htmlcontent' })
    } finally {
      setPublishing(false)
    }
  }

  // Expose the HTML Content publish as a window-level test trigger so we
  // can fire it from DevTools without adding UI. Temporary — becomes a
  // proper button once the flow is verified end-to-end.
  useEffect(() => {
    window.__publishHtmlContent = handlePublishHtmlContent
    return () => { if (window.__publishHtmlContent === handlePublishHtmlContent) delete window.__publishHtmlContent }
  })

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      background: '#0a0a14',
      color: T.textPrimary,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <PageManager
        reportName={reportName}
        onRenameReport={onRenameReport}
        pages={pages}
        activePageId={activePageId}
        onSelectPage={setActivePageId}
        onAddPage={handleAddPage}
        onRenamePage={handleRenamePage}
        onDeletePage={handleDeletePage}
        onBack={onBack}
        onPublish={handlePublishHtmlContent}
        publishing={publishing}
        reportLoading={reportLoading}
        onSaveDraft={() => saveDraft({ silent: false })}
        savingDraft={savingDraft}
        showSavedToast={showSavedToast}
        lastSavedAt={lastSavedAt}
        collapsed={pageManagerCollapsed}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <CanvasTopBar
          T={T}
          pageManagerCollapsed={pageManagerCollapsed}
          onTogglePageManager={() => setPageManagerCollapsed((p) => !p)}
          inspectorCollapsed={inspectorCollapsed}
          onToggleInspector={() => setInspectorCollapsed((p) => !p)}
          canvasTheme={canvasTheme}
          onToggleTheme={() => setCanvasTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
        {loadingDef && <LoadingBar T={T} message="Loading report definition…" />}
        {draftBanner && (
          <DraftRestoreBanner
            T={T}
            draft={draftBanner.draft}
            onRestore={() => applyDraftToState(draftBanner.draft)}
            onDismiss={() => setDraftBanner(null)}
          />
        )}
        {loadError && (
          <div style={{
            padding: '8px 14px',
            background: 'rgba(248,113,113,0.06)',
            borderBottom: `1px solid rgba(248,113,113,0.2)`,
            color: '#FCA5A5', fontSize: 11,
          }}>
            ⚠ {loadError} — starting with an empty page.
          </div>
        )}
        <LiveCanvas
          page={activePage}
          measures={measures}
          theme={canvasTheme}
          selectedVisualId={selectedVisualId}
          onSelectVisual={handleSelectVisual}
          onDeleteVisual={handleDeleteVisual}
        />
      </div>

      <InspectorPanel
        page={activePage}
        measures={measures}
        dimensions={dimensions}
        onAddVisual={handleAddVisual}
        onUpdatePage={handleUpdatePage}
        injectionScope={injectionScope}
        setInjectionScope={setInjectionScope}
        renderer={renderer}
        setRenderer={setRenderer}
        publishing={publishing}
        publishError={publishError}
        hasAnyVisual={hasAnyVisual}
        onPublish={handlePublishHtmlContent}
        reportLoading={reportLoading}
        collapsed={inspectorCollapsed}
        onExpand={() => setInspectorCollapsed(false)}
      />

      {publishing && (
        <PublishOverlay
          T={T}
          progress={publishProgress}
          stage={publishStage}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function CanvasTopBar({
  T,
  pageManagerCollapsed, onTogglePageManager,
  inspectorCollapsed,   onToggleInspector,
  canvasTheme,          onToggleTheme,
}) {
  const teal = COLOR_SCHEMES.teal
  const btnStyle = (active) => ({
    width: 28, height: 28, borderRadius: 6,
    background: active ? `${teal.start}22` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? teal.start + '66' : T.CARD_BORDER}`,
    color: active ? teal.mid : T.textSecondary,
    fontSize: 13, lineHeight: 1, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.12s ease',
  })
  return (
    <div style={{
      height: 36,
      flexShrink: 0,
      borderBottom: `1px solid ${T.CARD_BORDER}`,
      background: 'rgba(15,17,23,0.6)',
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 12px',
    }}>
      <button
        onClick={onTogglePageManager}
        title={pageManagerCollapsed ? 'Show pages panel' : 'Hide pages panel'}
        style={btnStyle(pageManagerCollapsed)}
      >
        {pageManagerCollapsed ? '▶' : '◀'}
      </button>
      <span style={{ fontSize: 9, color: T.textFaint, marginLeft: 2 }}>Pages</span>

      <div style={{ flex: 1 }} />

      <button
        onClick={onToggleTheme}
        title={`Switch to ${canvasTheme === 'dark' ? 'light' : 'dark'} theme`}
        style={btnStyle(false)}
      >
        {canvasTheme === 'dark' ? '☀' : '☾'}
      </button>

      <div style={{ width: 6 }} />

      <span style={{ fontSize: 9, color: T.textFaint, marginRight: 2 }}>Inspector</span>
      <button
        onClick={onToggleInspector}
        title={inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
        style={btnStyle(inspectorCollapsed)}
      >
        {inspectorCollapsed ? '◀' : '▶'}
      </button>
    </div>
  )
}

function LoadingBar({ T, message }) {
  return (
    <div style={{
      padding: '7px 14px',
      background: 'rgba(20,184,166,0.06)',
      borderBottom: `1px solid rgba(20,184,166,0.18)`,
      fontSize: 11, color: COLOR_SCHEMES.teal.mid,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ animation: 'pbi-spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
      {message}
    </div>
  )
}

function PublishOverlay({ T, progress, stage }) {
  const teal = COLOR_SCHEMES.teal
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500,
    }}>
      <div style={{
        width: 380, padding: '28px 30px',
        background: 'linear-gradient(180deg, rgba(20,20,34,0.98) 0%, rgba(11,11,20,0.99) 100%)',
        border: `1px solid ${T.CARD_BORDER}`,
        borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
              Publishing to Fabric
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
              {stage || 'Starting…'}
            </div>
          </div>
        </div>

        <div style={{
          width: '100%', height: 8, borderRadius: 99,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${Math.max(0, Math.min(100, progress))}%`,
            background: `linear-gradient(90deg, ${teal.start}, ${teal.mid})`,
            transition: 'width 0.35s ease',
            boxShadow: `0 0 12px ${teal.start}88`,
          }} />
        </div>

        <div style={{
          fontSize: 10, color: T.textMuted, fontFamily: 'monospace', textAlign: 'right',
        }}>
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

function makePage(name) {
  return {
    id:         uid(),
    name,
    width:      1280,
    height:     720,
    background: '#0F1117',
    visuals:    [],
    settings: {
      hideHeaders: true,
      hideNav:     false,
      gridlines:   false,
    },
  }
}

/**
 * Map a Power BI visual type id (from a parsed .pbix) to a Semantica
 * registry key when possible. Anything we don't recognise is preserved
 * as-is so the editor can still display it (as a ghosted block).
 */
function mapPbiTypeToSemantica(pbiType) {
  if (!pbiType) return 'unknown'
  const map = {
    card:                    'kpi',
    multiRowCard:            'kpi',
    barChart:                'bar',
    columnChart:             'bar',
    clusteredBarChart:       'bar',
    clusteredColumnChart:    'bar',
    stackedBarChart:         'stacked_bar',
    stackedColumnChart:      'stacked_bar',
    lineChart:               'line',
    areaChart:               'area',
    stackedAreaChart:        'area',
    donutChart:              'donut',
    pieChart:                'donut',
    gauge:                   'gauge',
    radarChart:              'radar',
    scatterChart:            'scatter',
    treemap:                 'treemap',
    funnel:                  'funnel',
    sankey:                  'sankey',
    tableEx:                 'table',
    pivotTable:              'table',
  }
  return map[pbiType] || pbiType
}

function DraftRestoreBanner({ T, draft, onRestore, onDismiss }) {
  const teal = COLOR_SCHEMES.teal
  const when = draft?.updatedAt || draft?.savedAt
  return (
    <div style={{
      padding: '10px 14px',
      background: `${teal.start}10`,
      borderBottom: `1px solid ${teal.start}55`,
      display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 11, color: T.textSecondary,
    }}>
      <span style={{ fontSize: 14 }}>💾</span>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <strong style={{ color: T.textPrimary }}>You have unsaved work</strong> for this report
        {when ? <> from <span style={{ color: teal.mid }}>{relativeTime(when)}</span></> : null}.
        {' '}
        {draft.pageCount} page{draft.pageCount !== 1 ? 's' : ''} · {draft.visualCount} visual{draft.visualCount !== 1 ? 's' : ''}.
      </div>
      <button
        onClick={onRestore}
        style={{
          padding: '6px 12px', borderRadius: 6,
          background: teal.start, color: 'white',
          border: 'none', fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Restore Draft
      </button>
      <button
        onClick={onDismiss}
        style={{
          padding: '6px 12px', borderRadius: 6,
          background: 'rgba(255,255,255,0.05)', color: T.textSecondary,
          border: `1px solid ${T.CARD_BORDER}`, fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Start Fresh
      </button>
    </div>
  )
}

/**
 * Compute a deterministic signature of the editor state used to detect
 * dirty changes for auto-save. JSON.stringify is good enough — pages are
 * shallow and editor mutates them through React setters.
 */
/**
 * Parse a `Table[Column]` dimension reference into its parts. Returns null
 * if the input is empty or malformed. Used by the publish pre-fetch loop to
 * decide between window.semantica.query and queryTable.
 */
function parseDimensionString(dim) {
  if (!dim || typeof dim !== 'string') return null
  const m = dim.match(/^(.+?)\[(.+)\]$/)
  if (!m) return null
  return { table: m[1], column: m[2] }
}

function signatureFor(pages, injectionScope, renderer, reportName) {
  try {
    return JSON.stringify({ pages, injectionScope, renderer, reportName })
  } catch {
    return String(Date.now())
  }
}

function relativeTime(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diff = Date.now() - then
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60)  return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60)  return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 30)  return `${day} day${day !== 1 ? 's' : ''} ago`
  const mo = Math.floor(day / 30)
  return `${mo} month${mo !== 1 ? 's' : ''} ago`
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('pbi-spin-keyframes')) {
  const style = document.createElement('style')
  style.id = 'pbi-spin-keyframes'
  style.textContent = `@keyframes pbi-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`
  document.head.appendChild(style)
}
