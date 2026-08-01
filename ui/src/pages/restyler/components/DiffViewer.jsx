import React, { useState, useMemo } from 'react'
import { applyRestyle } from '../styleApplier.js'

/**
 * Apply step. Computes the restyle (parsed + plan → mutated parts), shows
 * a diff summary + an Apply button that writes back via Fabric REST.
 */
export default function DiffViewer({ report, parsed, plan, onApplied }) {
  const [applying, setApplying] = useState(false)
  const [result,   setResult]   = useState(null)   // { success, message, reportId }

  // Compute the restyle synchronously — applier is pure
  const computed = useMemo(() => {
    if (!parsed || !plan) return null
    try {
      const r = applyRestyle({ parsed, plan, parts: parsed.sourceParts || [] })
      return { ok: true, ...r }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [parsed, plan])

  async function handleApply() {
    if (!computed?.ok || applying) return
    setApplying(true); setResult(null)

    try {
      const res = await window.semantica?.pbiUpdateReportDefinition?.({
        workspaceId: report.workspaceId,
        reportId:    report.id,
        parts:       computed.mutatedParts.map(p => ({ path: p.path, content: p.content })),
      })
      if (res?.success) {
        setResult({ success: true, message: 'Report restyled successfully. Refresh in Power BI Service to see changes.' })
        onApplied?.(res)
      } else {
        setResult({ success: false, message: res?.message || 'Update rejected by Fabric. Check the rollup error in console.' })
      }
    } catch (err) {
      setResult({ success: false, message: err.message })
    }
    setApplying(false)
  }

  if (!parsed || !plan) {
    return <Empty>Pick a report and choose a style plan to preview the diff.</Empty>
  }

  if (!computed?.ok) {
    return (
      <ErrorPanel error={computed?.error || 'Could not compute restyle'} />
    )
  }

  const { stats, diff, theme } = computed

  return (
    <div style={{ padding: '8px 24px 24px' }}>

      {/* Header summary */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v-text)' }}>Review changes</div>
          <div style={{ fontSize: 11, color: 'var(--v-text-muted)', marginTop: 2 }}>
            <strong style={{ color: '#A78BFA' }}>{stats.visualsTouched}</strong> visuals across <strong style={{ color: '#A78BFA' }}>{stats.pagesTouched}</strong> pages
            {stats.errors.length > 0 && <span style={{ color: '#F87171' }}> · {stats.errors.length} error{stats.errors.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={handleApply}
          disabled={applying || !computed.mutatedParts.length}
          style={{
            background: applying ? 'rgba(20,184,166,0.4)' : 'linear-gradient(135deg, #14B8A6, #0EA5A4)',
            border: 'none', color: 'white', borderRadius: 8,
            padding: '10px 22px', fontSize: 12, fontWeight: 700,
            cursor: applying ? 'wait' : 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(20,184,166,0.35)',
          }}>
          {applying ? 'Writing to Fabric…' : '✦ Apply restyle'}
        </button>
      </div>

      {/* ── Coverage stats — diagnostic of how the plan actually fared ── */}
      {(() => {
        const skipped = stats.skipped || []
        const total = stats.visualsTouched + skipped.length
        const noMatchSkipped = skipped.filter(s => /no matching rule/i.test(s.reason || '')).length
        const ruleSkipped    = skipped.filter(s => /rule/i.test(s.reason || '') && !/no matching/i.test(s.reason || '')).length
        const policySkipped  = skipped.filter(s => /policy/i.test(s.reason || '')).length
        const matchPct = total > 0 ? Math.round((stats.visualsTouched / total) * 100) : 0
        // Color coding — under-applied is the warning case
        const matchColor = matchPct >= 60 ? '#22C55E' : matchPct >= 30 ? '#FBBF24' : '#F87171'
        return (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: 14, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
                Coverage
              </div>
              <div style={{ fontSize: 11, color: matchColor, fontWeight: 700 }}>
                {matchPct}% of visuals will be styled
              </div>
              {matchPct < 30 && (
                <div style={{ fontSize: 10, color: '#FBBF24', fontStyle: 'italic' }}>
                  ⚠ Plan may be under-applied — most visuals fell through to "no matching rule"
                </div>
              )}
            </div>

            {/* Bar */}
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', marginBottom: 10 }}>
              {stats.visualsTouched > 0 && (
                <div style={{ width: `${(stats.visualsTouched / total) * 100}%`, background: '#22C55E' }} title={`${stats.visualsTouched} styled`} />
              )}
              {ruleSkipped > 0 && (
                <div style={{ width: `${(ruleSkipped / total) * 100}%`, background: '#A78BFA' }} title={`${ruleSkipped} explicitly skipped by rules`} />
              )}
              {policySkipped > 0 && (
                <div style={{ width: `${(policySkipped / total) * 100}%`, background: 'var(--v-text-muted)' }} title={`${policySkipped} skipped by policy (images/shapes/buttons/etc.)`} />
              )}
              {noMatchSkipped > 0 && (
                <div style={{ width: `${(noMatchSkipped / total) * 100}%`, background: '#F87171' }} title={`${noMatchSkipped} unmatched — no rule applied`} />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 10 }}>
              <Legend color="#22C55E" label={`${stats.visualsTouched} styled`} />
              {ruleSkipped > 0    && <Legend color="#A78BFA" label={`${ruleSkipped} skip rules fired`} />}
              {policySkipped > 0  && <Legend color="var(--v-text-muted)" label={`${policySkipped} default skips (image/shape/button)`} />}
              {noMatchSkipped > 0 && <Legend color="#F87171" label={`${noMatchSkipped} unmatched — no rule fired`} hint />}
            </div>

            {noMatchSkipped > 5 && (
              <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 10, padding: 8, background: 'rgba(248,113,113,0.05)', borderRadius: 6, lineHeight: 1.6 }}>
                <strong>Why this matters:</strong> {noMatchSkipped} visuals had no matching rule and were left untouched.
                If your plan included rules that key on page name (<code>match.page</code>),
                the page names may not exactly match the report's actual page names — the LLM may have invented names.
                Try refining the plan with a message like "use position-based matching, not page names" or
                explicitly listing the actual page names from the report.
              </div>
            )}
          </div>
        )
      })()}

      {/* Result banner */}
      {result && (
        <div style={{
          background: result.success ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)',
          border: result.success ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(248,113,113,0.3)',
          color: result.success ? '#86EFAC' : '#F87171',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16,
        }}>
          {result.success ? '✓ ' : '⚠ '}{result.message}
        </div>
      )}

      {/* Layout changes — surface what the layout normalizer + repacker moved */}
      {stats.layoutChanges?.length > 0 && (() => {
        const counts = stats.layoutSummary || {}
        return (
          <details style={{
            background: 'rgba(167,139,250,0.05)',
            border: '1px solid rgba(167,139,250,0.15)',
            borderRadius: 8, padding: 12, marginBottom: 16,
          }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: '#A78BFA', fontWeight: 600 }}>
              Layout changes ({stats.layoutChanges.length})
              <span style={{ marginLeft: 12, color: 'var(--v-text-2)', fontWeight: 400 }}>
                {Object.entries(counts).map(([k, n]) => `${n} ${k.replace(/-/g, ' ')}`).join(' · ')}
              </span>
            </summary>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--v-text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              These are visual position/size changes. PBI rendering will reflect them on next refresh.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {stats.layoutChanges.slice(0, 30).map((c, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, fontSize: 10, color: 'var(--v-text-2)',
                  padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 4,
                  fontFamily: 'monospace',
                }}>
                  <span style={{ color: '#A78BFA', fontWeight: 700, minWidth: 100 }}>{c.kind}</span>
                  <span style={{ color: 'var(--v-text-muted)', minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.visualId}</span>
                  <span style={{ color: 'var(--v-text-faint)' }}>
                    {`${c.before.x},${c.before.y} ${c.before.width}×${c.before.height}`}
                  </span>
                  <span style={{ color: 'var(--v-text-muted)' }}>→</span>
                  <span style={{ color: '#22C55E' }}>
                    {`${c.after.x},${c.after.y} ${c.after.width}×${c.after.height}`}
                  </span>
                </div>
              ))}
              {stats.layoutChanges.length > 30 && <div style={{ fontSize: 10, color: 'var(--v-text-faint)', padding: 4 }}>+{stats.layoutChanges.length - 30} more</div>}
            </div>
          </details>
        )
      })()}

      {/* Errors from applier */}
      {stats.errors.length > 0 && (
        <details style={{
          background: 'rgba(248,113,113,0.05)',
          border: '1px solid rgba(248,113,113,0.15)',
          borderRadius: 8, padding: 12, marginBottom: 16,
        }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, color: '#FCA5A5', fontWeight: 600 }}>
            Applier warnings ({stats.errors.length})
          </summary>
          <pre style={{ fontSize: 10, color: '#FCA5A5', marginTop: 8, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {stats.errors.join('\n')}
          </pre>
        </details>
      )}

      {/* Skipped visuals — grouped by reason */}
      {stats.skipped?.length > 0 && (() => {
        // Group by reason category
        const groups = {}
        for (const s of stats.skipped) {
          const reason = s.reason || 'unknown'
          const category = /no matching rule/i.test(reason) ? 'No rule matched (rule-mode default = leave alone)'
                         : /policy/i.test(reason)            ? 'Policy skip (images / shapes / buttons / etc.)'
                         : /rule/i.test(reason)              ? `Rule "${reason.match(/rule[" ](\w+)/)?.[1] || 'unknown'}" → skip`
                         : reason
          groups[category] = groups[category] || []
          groups[category].push(s)
        }
        return (
          <details style={{
            background: 'rgba(100,116,139,0.05)',
            border: '1px solid rgba(100,116,139,0.15)',
            borderRadius: 8, padding: 12, marginBottom: 16,
          }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--v-text-2)', fontWeight: 600 }}>
              Skipped breakdown ({stats.skipped.length})
            </summary>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(groups).map(([category, items]) => (
                <div key={category}>
                  <div style={{ fontSize: 10, color: 'var(--v-text-2)', fontWeight: 700, marginBottom: 4 }}>
                    {category} <span style={{ color: 'var(--v-text-muted)', fontWeight: 400 }}>({items.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 8 }}>
                    {items.slice(0, 15).map((s, i) => (
                      <span key={i} style={{
                        fontSize: 9, color: 'var(--v-text-muted)', fontFamily: 'monospace',
                        background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: 3,
                      }}>
                        {s.visualType}
                      </span>
                    ))}
                    {items.length > 15 && <span style={{ fontSize: 9, color: 'var(--v-text-faint)' }}>+{items.length - 15} more</span>}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )
      })()}

      {/* Diff list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <SectionLabel>Per-visual changes</SectionLabel>
        {diff.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--v-text-muted)', padding: 20, textAlign: 'center' }}>
            No visuals matched the plan's overrides.
          </div>
        ) : (
          diff.slice(0, 40).map((d, i) => <DiffRow key={i} diff={d} />)
        )}
        {diff.length > 40 && (
          <div style={{ fontSize: 11, color: 'var(--v-text-faint)', padding: 8, textAlign: 'center', fontStyle: 'italic' }}>
            +{diff.length - 40} more visuals will be updated
          </div>
        )}
      </div>

      {/* Theme JSON preview */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--v-text-2)', fontWeight: 600, padding: '8px 0' }}>
          Generated theme JSON ({theme ? Object.keys(theme.visualStyles || {}).length : 0} visualStyles entries)
        </summary>
        <pre style={{
          fontSize: 10, color: 'var(--v-text-2)',
          background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6,
          maxHeight: 320, overflow: 'auto', fontFamily: 'monospace',
        }}>{JSON.stringify(theme, null, 2)}</pre>
      </details>
    </div>
  )
}

function DiffRow({ diff }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
      borderRadius: 6, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color: '#A78BFA',
        background: 'rgba(167,139,250,0.12)',
        padding: '2px 6px', borderRadius: 3,
        fontFamily: 'monospace', whiteSpace: 'nowrap',
      }}>
        {diff.visualType}
      </span>
      <span style={{ fontSize: 11, color: 'var(--v-text-2)', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {diff.visualId}
      </span>
      {diff.page && (
        <span style={{ fontSize: 10, color: 'var(--v-text-muted)' }}>
          {diff.page}
        </span>
      )}
      <span style={{ fontSize: 10, color: '#22C55E', fontFamily: 'monospace' }}>
        +{diff.changes.length} change{diff.changes.length === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function Legend({ color, label, hint }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: hint ? '#FCA5A5' : 'var(--v-text-2)' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function Empty({ children }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>✦</div>
      <div style={{ color: 'var(--v-text-muted)', fontSize: 12 }}>{children}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, fontWeight: 700 }}>
      {children}
    </div>
  )
}

function ErrorPanel({ error }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{
        background: 'rgba(248,113,113,0.06)',
        border: '1px solid rgba(248,113,113,0.2)',
        borderRadius: 10, padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5', marginBottom: 6 }}>
          ⚠ Could not compute restyle
        </div>
        <div style={{ fontSize: 11, color: 'var(--v-text-2)' }}>{error}</div>
      </div>
    </div>
  )
}
