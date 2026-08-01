import React, { useState, useEffect, useMemo } from 'react'
import { runAudit }                from '../knowledge/auditRules.js'
import { parseReportDefinition }   from '../pbirParser.js'
import { fontRiskAssessment }      from '../knowledge/fontWhitelist.js'
import ProfilePicker               from './ProfilePicker.jsx'

/**
 * DirectorChat — replaces PlanPanel as the primary "Style Plan" step.
 *
 * Flow:
 *   1. User picks provider/model (mirrors AppGenerator pattern, doesn't
 *      modify AppGenerator)
 *   2. (Optional) types a prompt describing what they want
 *   3. Clicks "Analyze with AI Director" → calls pbi-restyler-ai-plan IPC
 *   4. Director returns a rule-based plan with narrative + rule list
 *   5. User can chat to refine ("make it darker", "leave the nav alone")
 *   6. Resulting plan flows to DiffViewer (apply step)
 *
 * The plan that flows downstream has Director-shape (rules[]) which
 * styleApplier dispatches via the rule engine.
 */

const PROVIDERS = [
  { id: 'anthropic',  label: 'Anthropic Claude', statusKey: 'anthropic' },
  { id: 'gemini',     label: 'Google Gemini',    statusKey: 'gemini' },
  { id: 'openai',     label: 'OpenAI',            statusKey: 'openai' },
  { id: 'groq',       label: 'Groq',              statusKey: 'groq' },
]

export default function DirectorChat({ report, definition, plan, onPlanChange }) {
  // ── Provider/model selection ──
  const [aiStatus,         setAiStatus]         = useState(null)
  const [selectedProvider, setSelectedProvider] = useState('anthropic')
  const [selectedModel,    setSelectedModel]    = useState('')
  const [availableModels,  setAvailableModels]  = useState({})

  // ── User intent + brand kit ──
  const [userPrompt, setUserPrompt] = useState('')
  const [accent,     setAccent]     = useState('#3B82F6')
  const [brandFont,  setBrandFont]  = useState('')
  const [mode,       setMode]       = useState('light')
  const [boldness,   setBoldness]   = useState('balanced')   // subtle | balanced | dramatic
  const [layoutIntensity, setLayoutIntensity] = useState('preserve')  // preserve | tidy | repack

  // ── Director state ──
  const [analyzing, setAnalyzing] = useState(false)
  const [error,     setError]     = useState('')
  const [history,   setHistory]   = useState([])  // [{role, content, plan?}]

  // Parsed report + audit (for sending to Director)
  const { parsed, audit } = useMemo(() => {
    if (!definition?.parts) return { parsed: null, audit: null }
    const p = parseReportDefinition(definition.parts)
    if (p && !p.sourceParts) p.sourceParts = definition.parts
    const a = p?.pages?.length ? runAudit(p) : null
    return { parsed: p, audit: a }
  }, [definition])

  // Fetch AI status + available models on mount.
  // Uses the SAME IPCs App Generator uses: get-ai-status / get-ai-models.
  useEffect(() => {
    (async () => {
      try {
        const s = await window.semantica?.getAiStatus?.()
        setAiStatus(s)
      } catch { /* ignore */ }
      try {
        const m = await window.semantica?.getAiModels?.()
        setAvailableModels(m || {})
      } catch { /* ignore — model dropdown will be empty until configured */ }
    })()
  }, [])

  // Default-pick first model when provider changes
  useEffect(() => {
    const list = availableModels[selectedProvider] || []
    const ids = list.map(m => m.id)
    if (!ids.includes(selectedModel)) setSelectedModel(ids[0] || '')
  }, [selectedProvider, availableModels])  // eslint-disable-line react-hooks/exhaustive-deps

  const fontRisk = useMemo(() => fontRiskAssessment(brandFont || null), [brandFont])

  async function runDirector(refinementMessage = null) {
    if (!parsed || analyzing) return
    setAnalyzing(true); setError('')

    // For refinements, fold the previous plan + user's new message into the prompt
    let combinedPrompt = userPrompt.trim()
    if (refinementMessage) {
      combinedPrompt = `Previous plan:\n${JSON.stringify(plan, null, 2)}\n\nUser refinement: ${refinementMessage}\n\nProduce an updated plan that incorporates this refinement.`
    }

    try {
      const res = await window.semantica?.restyler?.aiPlan?.({
        parsedSummary: parsed,
        audit,
        brandKit: {
          accent, brandFont, mode,
        },
        userPrompt: combinedPrompt,
        provider:   selectedProvider,
        model:      selectedModel,
        boldness,
        layoutIntensity,
      })

      if (!res?.success) {
        setError(res?.message || 'Director call failed')
        if (res?.raw) setError(prev => prev + '\n\nRaw response (truncated): ' + res.raw)
      } else {
        const newPlan = res.plan
        onPlanChange?.(newPlan)
        setHistory(prev => [
          ...prev,
          ...(refinementMessage ? [{ role: 'user', content: refinementMessage }] : []),
          { role: 'director', content: newPlan.narrative || '(no narrative)', plan: newPlan, provider: res.provider, model: res.model },
        ])
      }
    } catch (err) {
      setError(err.message || 'Unexpected error')
    }
    setAnalyzing(false)
  }

  // Empty state
  if (!parsed) {
    return <Empty>Pick a report first.</Empty>
  }

  return (
    <div style={{ padding: '8px 24px 24px' }}>

      {/* ── Provider selector + brand kit ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card label="AI Provider">
          <Row>
            <Label>Provider</Label>
            <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} style={selectStyle}>
              {PROVIDERS.map(p => {
                const configured = aiStatus?.[p.statusKey]?.configured
                return (
                  <option key={p.id} value={p.id} style={{ background: '#1A1F2E' }} disabled={!configured && aiStatus}>
                    {p.label} {configured === false ? '(not configured)' : ''}
                  </option>
                )
              })}
            </select>
          </Row>
          <Row>
            <Label>Model</Label>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={selectStyle}>
              {(availableModels[selectedProvider] || []).map(m => (
                <option key={m.id} value={m.id} style={{ background: '#1A1F2E' }}>
                  {m.label || m.id}
                </option>
              ))}
            </select>
          </Row>
          {!aiStatus?.anyConfigured && (
            <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 6, padding: 8, background: 'rgba(248,113,113,0.05)', borderRadius: 4 }}>
              No AI providers configured. Open Semantica settings to add API keys.
            </div>
          )}
        </Card>

        <Card label="Brand kit (optional)">
          <Row>
            <Label>Accent color</Label>
            <ColorInput value={accent} onChange={setAccent} />
          </Row>
          <Row>
            <Label>Brand font</Label>
            <input type="text" value={brandFont} placeholder="e.g. Inter, Manrope (optional)"
              onChange={e => setBrandFont(e.target.value)} style={textInputStyle} />
          </Row>
          {brandFont && fontRisk.risk === 'high' && (
            <div style={{ fontSize: 10, color: '#FCD34D', padding: 6, background: 'rgba(251,191,36,0.05)', borderRadius: 4 }}>
              {fontRisk.message}
            </div>
          )}
          <Row>
            <Label>Mode</Label>
            <ToggleGroup value={mode} options={[['light', '☀ Light'], ['dark', '☾ Dark']]} onChange={setMode} />
          </Row>
          <Row>
            <Label>Boldness</Label>
            <ToggleGroup value={boldness}
              options={[['subtle', 'Subtle'], ['balanced', 'Balanced'], ['dramatic', 'Dramatic']]}
              onChange={setBoldness} />
          </Row>
          <div style={{ fontSize: 10, color: 'var(--v-text-faint)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>
            {boldness === 'subtle'    && 'Conservative tweaks — preserves original colors and most styling. Tighten only.'}
            {boldness === 'balanced'  && 'Visible improvements without radical change. Hide gear icons, restyle KPIs and charts, leave nav alone.'}
            {boldness === 'dramatic'  && 'Transform the report — strip per-visual color overrides so brand palette shows, push hero sizes large, override page backgrounds.'}
          </div>
          <Row>
            <Label>Layout</Label>
            <ToggleGroup value={layoutIntensity}
              options={[['preserve', 'Preserve'], ['tidy', 'Tidy'], ['repack', 'Repack']]}
              onChange={setLayoutIntensity} />
          </Row>
          <div style={{ fontSize: 10, color: 'var(--v-text-faint)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>
            {layoutIntensity === 'preserve' && 'Snap to 8pt grid + equalize KPI row heights only. Original visual positions kept.'}
            {layoutIntensity === 'tidy'     && 'Above + push overlapping visuals apart + clamp visuals that extend off-page.'}
            {layoutIntensity === 'repack'   && 'Aggressively re-pack each page into a clean CSS-Grid-like layout. Re-flows x positions at uniform gutters from outer margin. Use when the report looks structurally messy.'}
          </div>
        </Card>
      </div>

      {/* ── Saved profiles (load existing OR save current) ── */}
      <div style={{ marginBottom: 16 }}>
        <ProfilePicker
          plan={plan}
          brandKit={{ accent, brandFont, mode }}
          sourceReportName={report?.name}
          onLoad={(loadedPlan, loadedBrandKit) => {
            onPlanChange?.(loadedPlan)
            if (loadedBrandKit?.accent)    setAccent(loadedBrandKit.accent)
            if (loadedBrandKit?.brandFont) setBrandFont(loadedBrandKit.brandFont)
            if (loadedBrandKit?.mode)      setMode(loadedBrandKit.mode)
            setHistory(prev => [...prev, {
              role: 'director',
              content: `Loaded saved profile. ${loadedPlan.narrative || ''}`,
              plan: loadedPlan,
            }])
          }}
        />
      </div>

      {/* ── User intent + Analyze button ── */}
      <Card label="Tell the Director what you want (optional)">
        <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)}
          placeholder="e.g. 'Make it look like an executive briefing for our board' or 'Match our brand — minimal, dark, accent-driven'"
          rows={3}
          style={{ ...textInputStyle, width: '100%', resize: 'vertical', minHeight: 60 }} />
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 12 }}>
          <button onClick={() => runDirector()} disabled={analyzing || !aiStatus?.anyConfigured}
            style={{
              background: analyzing ? 'rgba(167,139,250,0.4)' : 'linear-gradient(135deg, #A78BFA, #8B5CF6)',
              border: 'none', color: 'white', borderRadius: 8,
              padding: '10px 20px', fontSize: 12, fontWeight: 700,
              cursor: analyzing ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: !aiStatus?.anyConfigured ? 0.4 : 1,
            }}>
            {analyzing ? 'Director analyzing…' : '✦ Analyze with AI Director'}
          </button>
          <div style={{ flex: 1 }} />
          {parsed?.pages && (
            <span style={{ fontSize: 10, color: 'var(--v-text-muted)' }}>
              Will analyze {parsed.pages.length} pages · {parsed.pages.reduce((n, p) => n + (p.visuals?.length || 0), 0)} visuals
              {audit?.score != null && ` · current score ${audit.score}`}
            </span>
          )}
        </div>
      </Card>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.06)',
          border: '1px solid rgba(248,113,113,0.25)',
          color: '#F87171', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 11,
          whiteSpace: 'pre-wrap',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Chat history + plan summary ── */}
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {history.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
        </div>
      )}

      {/* ── Refinement input (shown after first plan) ── */}
      {plan?.rules && (
        <div style={{ marginTop: 16 }}>
          <RefinementInput onSend={(msg) => runDirector(msg)} disabled={analyzing} />
        </div>
      )}

      {/* ── Plan rules summary ── */}
      {plan?.rules?.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--v-text-2)', fontWeight: 600, padding: '8px 0' }}>
            Plan details — {plan.rules.length} rules · archetype: {plan.archetype || 'unknown'} · confidence: {plan.confidence || 'medium'}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {plan.rules.map((rule, i) => (
              <RuleRow key={rule.id || i} rule={rule} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function ChatMessage({ message }) {
  const isDirector = message.role === 'director'
  return (
    <div style={{
      background: isDirector ? 'rgba(167,139,250,0.05)' : 'rgba(255,255,255,0.02)',
      border: isDirector ? '1px solid rgba(167,139,250,0.15)' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: 12, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: isDirector ? '#A78BFA' : 'var(--v-text-2)',
                       textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {isDirector ? '✦ Director' : '👤 You'}
        </span>
        {message.provider && (
          <span style={{ fontSize: 9, color: 'var(--v-text-faint)', marginLeft: 'auto', fontFamily: 'monospace' }}>
            {message.provider} · {message.model?.split('-').slice(-2).join('-')}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--v-text)', lineHeight: 1.6 }}>
        {message.content}
      </div>
    </div>
  )
}

function RefinementInput({ onSend, disabled }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={val} onChange={e => setVal(e.target.value)}
        placeholder="Refine the plan: 'leave the nav alone', 'make it darker', 'use #FF5733 for the accent'..."
        onKeyDown={e => { if (e.key === 'Enter' && val.trim() && !disabled) { onSend(val); setVal('') } }}
        disabled={disabled}
        style={{ ...textInputStyle, flex: 1, padding: '10px 12px' }} />
      <button onClick={() => { if (val.trim() && !disabled) { onSend(val); setVal('') } }}
        disabled={disabled || !val.trim()}
        style={{
          background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
          color: '#A78BFA', borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 600,
          cursor: disabled ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: disabled || !val.trim() ? 0.4 : 1,
        }}>
        Refine
      </button>
    </div>
  )
}

function RuleRow({ rule }) {
  const isSkip = !!rule.skip
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 6, padding: 10, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: isSkip ? 'var(--v-text-2)' : '#A78BFA',
          background: isSkip ? 'rgba(148,163,184,0.1)' : 'rgba(167,139,250,0.12)',
          padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace',
        }}>
          {isSkip ? 'SKIP' : 'APPLY'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--v-text-muted)', fontFamily: 'monospace' }}>{rule.id}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--v-text-muted)', marginBottom: 4, fontFamily: 'monospace' }}>
        match: {JSON.stringify(rule.match || {})}
      </div>
      {rule.apply && (
        <div style={{ fontSize: 10, color: 'var(--v-text-2)', marginBottom: 4, fontFamily: 'monospace' }}>
          apply: {Object.entries(rule.apply).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--v-text)', fontStyle: 'italic' }}>
        {rule.reason}
      </div>
    </div>
  )
}

function Card({ label, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{ fontSize: 11, color: '#A78BFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({ children })   { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>{children}</div> }
function Label({ children }) { return <div style={{ fontSize: 11, color: 'var(--v-text-2)', minWidth: 100 }}>{children}</div> }

function ColorInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())}
        style={{ width: 32, height: 28, padding: 0, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
      <input type="text" value={value} onChange={e => onChange(e.target.value.toUpperCase())}
        style={{ ...textInputStyle, flex: 1, fontFamily: 'monospace' }} />
    </div>
  )
}

function ToggleGroup({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 2, borderRadius: 6, gap: 2 }}>
      {options.map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)}
          style={{
            background: value === val ? 'rgba(167,139,250,0.2)' : 'transparent',
            border: 'none', color: value === val ? '#A78BFA' : 'var(--v-text-2)',
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {label}
        </button>
      ))}
    </div>
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

const textInputStyle = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--v-text)',
  padding: '5px 10px', fontSize: 11,
  borderRadius: 6, outline: 'none', fontFamily: 'inherit',
}

const selectStyle = { ...textInputStyle, flex: 1, cursor: 'pointer' }
