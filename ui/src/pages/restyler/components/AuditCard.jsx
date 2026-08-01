import React, { useMemo } from 'react'
import { runAudit }      from '../knowledge/auditRules.js'
import { parseReportDefinition, summarize } from '../pbirParser.js'

/**
 * Audit step. Takes the fetched definition `{ parts, format }` from
 * PbiRestyler.jsx, parses it, runs the 13-rule audit engine, and renders
 * a score circle + grouped issue list.
 *
 * If parser fails (unknown format, malformed JSON), shows a clear error
 * panel with the format detected so the user knows where things stand.
 */
export default function AuditCard({ report, definition }) {
  const { parsed, audit, summary } = useMemo(() => {
    if (!definition?.parts) return { parsed: null, audit: null, summary: null }
    const p = parseReportDefinition(definition.parts)
    const s = summarize(p)
    if (p.error || !p.pages?.length) {
      return { parsed: p, audit: null, summary: s }
    }
    const a = runAudit(p)
    return { parsed: p, audit: a, summary: s }
  }, [definition])

  // ── No definition yet (still loading / not picked) ──
  if (!definition) {
    return (
      <Placeholder text="Pick a report in step 1 to run the audit." />
    )
  }

  // ── Parser failure ──
  if (parsed?.error || !parsed?.pages?.length) {
    return (
      <ErrorPanel parsed={parsed} summary={summary} />
    )
  }

  const score = audit?.score ?? 0
  const issues = audit?.issues ?? []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, padding: '8px 24px 24px' }}>

      {/* ── Score panel ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        gap: 16,
      }}>
        <ScoreRing score={score} />

        {/* Summary stats */}
        <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <SummaryStat label="Format"     value={parsed.format} mono />
          <SummaryStat label="Pages"      value={summary?.pageCount} />
          <SummaryStat label="Visuals"    value={summary?.totalVisuals} />
          <SummaryStat label="Issues"     value={issues.length} accent={issues.length > 0 ? '#FBBF24' : '#22C55E'} />
        </div>

        {/* Top visual types */}
        {summary?.top3VisualTypes?.length > 0 && (
          <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--v-text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, fontWeight: 700 }}>
              Top visual types
            </div>
            {summary.top3VisualTypes.map(t => (
              <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--v-text-2)', padding: '2px 0' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{t.type}</span>
                <span style={{ color: 'var(--v-text-muted)' }}>{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Issues list ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v-text)' }}>
            Detected issues
          </div>
          <div style={{ fontSize: 11, color: 'var(--v-text-muted)' }}>
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'} across {Object.keys(audit?.grouped || {}).length} categor{Object.keys(audit?.grouped || {}).length === 1 ? 'y' : 'ies'}
          </div>
        </div>

        {issues.length === 0 ? (
          <div style={{
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10, padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 13, color: '#86EFAC', fontWeight: 600 }}>No design issues detected</div>
            <div style={{ fontSize: 11, color: 'var(--v-text-muted)', marginTop: 4 }}>
              This report already follows the design rules. You can still apply a preset to apply a brand layer.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {issues.map((issue, i) => (
              <IssueRow key={`${issue.ruleId}-${i}`} issue={issue} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  // 0..100 → conic gradient sweep
  const sweep = Math.max(0, Math.min(360, (score / 100) * 360))
  const colorStops =
    score >= 75 ? ['#22C55E', '#10B981'] :
    score >= 50 ? ['#FBBF24', '#F59E0B'] :
    score >= 25 ? ['#FB923C', '#F97316'] :
                  ['#F87171', '#EF4444']
  const ringColor = colorStops[0]

  return (
    <div style={{
      width: 160, height: 160, borderRadius: '50%',
      background: `conic-gradient(${ringColor} 0deg, ${ringColor} ${sweep}deg, rgba(255,255,255,0.05) ${sweep}deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 132, height: 132, borderRadius: '50%',
        background: '#0B0B14',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--v-surface-3)', lineHeight: 1 }}>
          {Math.round(score)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--v-text-muted)', marginTop: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          design score
        </div>
      </div>
    </div>
  )
}

function SummaryStat({ label, value, mono, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
      <span style={{ color: 'var(--v-text-muted)' }}>{label}</span>
      <span style={{
        color: accent || 'var(--v-text)',
        fontWeight: 600,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ── Single issue row ─────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  high: { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', text: '#F87171' },
  med:  { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)',  text: '#FBBF24' },
  low:  { bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.15)', text: '#A78BFA' },
}

function IssueRow({ issue }) {
  const sc = SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.low
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color: sc.text,
        background: sc.bg, border: `1px solid ${sc.border}`,
        padding: '3px 6px', borderRadius: 4, marginTop: 2,
        fontFamily: 'monospace', whiteSpace: 'nowrap', minWidth: 56, textAlign: 'center',
      }}>
        {issue.ruleId}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v-text)' }}>{issue.label}</div>
          <SeverityBadge severity={issue.severity} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--v-text-2)', marginTop: 2 }}>{issue.detail}</div>
        {issue.location && (
          <div style={{ fontSize: 10, color: 'var(--v-text-faint)', marginTop: 4, fontFamily: 'monospace' }}>
            location: {issue.location}
          </div>
        )}
        {issue.fixDescription && (
          <div style={{ fontSize: 10, color: 'var(--v-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
            fix: {issue.fixDescription}
          </div>
        )}
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const c = SEVERITY_COLOR[severity] || SEVERITY_COLOR.low
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, color: c.text,
      background: c.bg, padding: '1px 6px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: 0.4,
    }}>
      {severity}
    </span>
  )
}

// ── Empty / placeholder / error ──────────────────────────────────────────────

function Placeholder({ text }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>📊</div>
      <div style={{ color: 'var(--v-text-muted)', fontSize: 12 }}>{text}</div>
    </div>
  )
}

function ErrorPanel({ parsed, summary }) {
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{
        background: 'rgba(248,113,113,0.06)',
        border: '1px solid rgba(248,113,113,0.2)',
        borderRadius: 10, padding: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5', marginBottom: 8 }}>
          ⚠ Could not parse this report
        </div>
        <div style={{ fontSize: 11, color: 'var(--v-text-2)', lineHeight: 1.6 }}>
          {parsed?.error || 'The report definition could not be normalized for audit.'}
        </div>
        {summary && (
          <div style={{
            marginTop: 14, padding: 12,
            background: 'rgba(0,0,0,0.2)', borderRadius: 6,
            fontFamily: 'monospace', fontSize: 11, color: 'var(--v-text-2)',
          }}>
            <div>Format detected: <code style={{ color: '#A78BFA' }}>{summary.format}</code></div>
            <div>Pages parsed: {summary.pageCount}</div>
            <div>Visuals parsed: {summary.totalVisuals}</div>
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--v-text-muted)', marginTop: 12, fontStyle: 'italic' }}>
          If this is unexpected, the report may use a format variant our parser doesn't cover yet.
          Backup snapshot was already saved — no data lost.
        </div>
      </div>
    </div>
  )
}
