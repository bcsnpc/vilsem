import React, { useState, useMemo, useEffect } from 'react'
import ReportPicker  from './restyler/components/ReportPicker.jsx'
import AuditCard     from './restyler/components/AuditCard.jsx'
import DirectorChat  from './restyler/components/DirectorChat.jsx'
import PreviewSplit  from './restyler/components/PreviewSplit.jsx'
import DiffViewer    from './restyler/components/DiffViewer.jsx'
import BackupHistory from './restyler/components/BackupHistory.jsx'
import { parseReportDefinition } from './restyler/pbirParser.js'

/**
 * PbiRestyler — separate top-level feature for restyling existing Power BI
 * reports. NOT connected to AppGenerator. See docs/plan-pbi-restyler.md for
 * the 10-step build order. This file is the wizard shell only — each step
 * delegates to its component, which is currently a skeleton placeholder.
 */
const STEPS = [
  { id: 'pick',    label: 'Pick report' },
  { id: 'audit',   label: 'Audit' },
  { id: 'plan',    label: 'Style plan' },
  { id: 'preview', label: 'Preview' },
  { id: 'apply',   label: 'Apply' },
]

export default function PbiRestyler({ authCreds, connectionInfo, onBack }) {
  const [stepIdx,    setStepIdx]    = useState(0)
  const [report,     setReport]     = useState(null)
  const [definition, setDefinition] = useState(null)   // { parts: [{path, content}], format }
  const [loadingDef, setLoadingDef] = useState(false)
  const [defError,   setDefError]   = useState('')
  const [backupInfo, setBackupInfo] = useState(null)   // { file, timestamp }
  const [plan,       setPlan]       = useState(null)   // current design plan (built from preset + brand kit)

  // Parse once when definition arrives — used by every step downstream
  const parsed = useMemo(() => {
    if (!definition?.parts) return null
    const p = parseReportDefinition(definition.parts)
    if (p && !p.sourceParts) p.sourceParts = definition.parts
    return p
  }, [definition])

  // Plan is produced by the AI Director (DirectorChat). No auto-init —
  // the user kicks off the analysis when ready.

  const step = STEPS[stepIdx]
  const canPrev = stepIdx > 0
  const canNext = stepIdx < STEPS.length - 1 && (stepIdx > 0 || !!report)

  async function handleSelectReport(r) {
    setReport(r)
    setStepIdx(1)
    setLoadingDef(true)
    setDefError('')
    setDefinition(null)
    setBackupInfo(null)

    try {
      // Fetch the report definition (Fabric REST — handles PBIR + PBIR-Legacy)
      const res = await window.semantica?.pbiGetReportDefinitionV2?.({
        workspaceId: r.workspaceId,
        reportId:    r.id,
        format:      'PBIR',
      })
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to fetch report definition')
      }
      setDefinition({ parts: res.parts, format: res.format })

      // Snapshot the original — taken once per fresh fetch
      const backup = await window.semantica?.restyler?.backupWrite?.({
        reportId:    r.id,
        reportName:  r.name,
        workspaceId: r.workspaceId,
        parts:       res.parts,
      })
      if (backup?.success) {
        setBackupInfo({ file: backup.file, timestamp: backup.timestamp })
        console.log('[restyler] backup written:', backup.file)
      }
    } catch (err) {
      setDefError(err?.message || 'Failed to load report')
      console.error('[restyler] handleSelectReport failed:', err)
    }
    setLoadingDef(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #0B0B14 0%, #111827 100%)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Topbar */}
      <div className="titlebar-drag" style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* window-control dots removed — the vilsem shell owns window controls */}
        <button onClick={onBack} className="no-drag"
          style={{ background: 'transparent', border: 'none', color: 'var(--v-text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px' }}>
          ← Home
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ color: '#A78BFA', fontSize: 16, fontWeight: 800 }}>✨</span>
        <span style={{ color: 'var(--v-surface-3)', fontSize: 14, fontWeight: 700 }}>PBI Restyler</span>
        {report && (
          <>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ color: 'var(--v-text-2)', fontSize: 12 }}>
              {report.name}
            </span>
          </>
        )}
        <div style={{ flex: 1 }} />
        {connectionInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--v-text-muted)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
            Connected
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: '14px 24px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {STEPS.map((s, i) => {
          const isActive = i === stepIdx
          const isDone   = i < stepIdx
          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => { if (isDone) setStepIdx(i) }}
                disabled={!isDone && !isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
                  borderRadius: 6, padding: '6px 12px',
                  cursor: (isDone || isActive) ? 'pointer' : 'default',
                  fontFamily: 'inherit', fontSize: 11,
                  color: isActive ? '#A78BFA' : isDone ? 'var(--v-text-2)' : 'var(--v-text-faint)',
                  fontWeight: isActive ? 600 : 400,
                }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: isActive ? '#A78BFA' : isDone ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)',
                  color: isActive || isDone ? '#0B0B14' : 'var(--v-text-faint)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {isDone ? '✓' : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <span style={{ color: 'var(--v-border)', fontSize: 10 }}>›</span>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Body — step content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 0' }}>
          {step.id === 'pick' && (
            <ReportPicker authCreds={authCreds} onSelect={handleSelectReport} />
          )}

          {/* Definition fetch overlay banner — visible on every step after pick */}
          {step.id !== 'pick' && (loadingDef || defError || backupInfo) && (
            <div style={{ padding: '0 24px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingDef && (
                <div style={{
                  background: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.2)',
                  borderRadius: 8, padding: '8px 12px',
                  fontSize: 11, color: '#A78BFA',
                }}>
                  Fetching report definition from Fabric…
                </div>
              )}
              {defError && (
                <div style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  borderRadius: 8, padding: '8px 12px',
                  fontSize: 11, color: '#F87171',
                }}>
                  ⚠ {defError}
                </div>
              )}
              {!loadingDef && !defError && backupInfo && definition && (
                <div style={{
                  background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 8, padding: '8px 12px',
                  fontSize: 11, color: '#86EFAC',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <span>✓ Loaded</span>
                  <span style={{ color: 'var(--v-text-2)' }}>{definition.parts.length} parts · format <code style={{ background: 'rgba(255,255,255,0.04)', padding: '0 4px', borderRadius: 3 }}>{definition.format}</code></span>
                  <span style={{ color: 'var(--v-text-faint)' }}>·</span>
                  <span style={{ color: 'var(--v-text-2)' }}>backup snapshot saved</span>
                </div>
              )}
              {report && (
                <BackupHistory report={report} />
              )}
            </div>
          )}

          {step.id === 'audit'   && <AuditCard report={report} definition={definition} />}
          {step.id === 'plan'    && <DirectorChat report={report} definition={definition} plan={plan} onPlanChange={setPlan} />}
          {step.id === 'preview' && <PreviewSplit />}
          {step.id === 'apply'   && <DiffViewer report={report} parsed={parsed} plan={plan} />}
        </div>
      </div>

      {/* Footer nav */}
      <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <button onClick={() => canPrev && setStepIdx(stepIdx - 1)}
          disabled={!canPrev}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: canPrev ? 'var(--v-text)' : 'var(--v-text-faint)', borderRadius: 8,
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            cursor: canPrev ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            opacity: canPrev ? 1 : 0.4,
          }}>
          ← Previous
        </button>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--v-text-muted)' }}>
          Step {stepIdx + 1} of {STEPS.length} · <span style={{ color: 'var(--v-text-2)' }}>{step.label}</span>
        </div>
        <button onClick={() => canNext && setStepIdx(stepIdx + 1)}
          disabled={!canNext}
          style={{
            background: canNext ? 'linear-gradient(135deg, #A78BFA, #8B5CF6)' : 'rgba(255,255,255,0.04)',
            border: 'none',
            color: canNext ? 'white' : 'var(--v-text-faint)', borderRadius: 8,
            padding: '8px 18px', fontSize: 12, fontWeight: 600,
            cursor: canNext ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            opacity: canNext ? 1 : 0.5,
            boxShadow: canNext ? '0 4px 14px rgba(167,139,250,0.3)' : 'none',
          }}>
          Next →
        </button>
      </div>
    </div>
  )
}
