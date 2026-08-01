import React, { useState, useEffect, useCallback } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'

function Card({ title, children, style = {} }) {
  return (
    <div style={{
      background: 'white', border: '1px solid var(--v-border)', borderRadius: 10,
      padding: '20px 24px', ...style,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--v-surface-2)' }}>
      <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || 'var(--gray-900)' }}>{value}</span>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--v-border)', borderRadius: 10, padding: '18px 20px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--gray-900)', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function timeUntilExpiry(iso) {
  if (!iso) return '—'
  const diff = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000))
  if (diff < 60) return `${diff}s`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function AiProviderCard({ provider, label, icon, link, keyPlaceholder, status, keyInput, setKeyInput, testResult, setTestResult, onTest, onSave, onRemove, models, selectedModel, onModelChange, extraNote, defaultProvider, onMakeDefault }) {
  const configured = status?.configured
  const isDefault = configured && defaultProvider === provider
  return (
    <div style={{ border: '1px solid var(--v-border)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <strong style={{ fontSize: 13, color: 'var(--gray-900)' }}>{label}</strong>
        <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blue)', marginLeft: 4 }}>{link.replace('https://', '')}</a>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDefault && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--v-accent)', background: 'var(--v-accent-quiet)', border: '1px solid var(--v-accent-border)', borderRadius: 3, padding: '2px 6px' }}>Default</span>
          )}
          {configured && !isDefault && onMakeDefault && (
            <button onClick={() => onMakeDefault(provider)} style={{ fontSize: 11, color: 'var(--v-text-muted)', background: 'transparent', border: '1px solid var(--v-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Make default</button>
          )}
          {configured
            ? <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Configured</span>
            : <span style={{ fontSize: 11, color: 'var(--v-text-faint)', fontWeight: 500 }}>Not configured</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="password"
          value={keyInput}
          onChange={e => { setKeyInput(e.target.value); setTestResult(null) }}
          placeholder={configured ? '••••••••••••••••' : keyPlaceholder}
          style={{ flex: 1, padding: '7px 10px', border: '1.5px solid var(--v-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        />
        <button onClick={() => onTest(provider, keyInput)} disabled={!keyInput}
          style={{ padding: '7px 12px', background: 'var(--v-surface-3)', border: '1px solid var(--v-border)', borderRadius: 6, fontSize: 12, cursor: keyInput ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          Test
        </button>
        <button onClick={() => onSave(provider, keyInput)} disabled={!testResult?.valid}
          style={{ padding: '7px 12px', background: testResult?.valid ? 'var(--blue)' : 'var(--v-text-faint)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: testResult?.valid ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          Save
        </button>
        {configured && (
          <button onClick={() => onRemove(provider)}
            style={{ padding: '7px 10px', background: 'rgba(224,101,110,.10)', color: 'var(--v-danger)', border: '1px solid var(--v-danger)', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Remove
          </button>
        )}
      </div>
      {testResult && (
        <div style={{ fontSize: 12, color: testResult.valid ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>
          {testResult.valid ? '✓ Valid key' : `✗ ${testResult.error}`}
        </div>
      )}
      {configured && models && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v-text-muted)', marginBottom: 6 }}>Model</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {models.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input type="radio" name={`model-${provider}`} value={m.id} checked={selectedModel === m.id} onChange={() => onModelChange(provider, m.id)} />
                <span style={{ fontWeight: selectedModel === m.id ? 600 : 400 }}>{m.label}</span>
                <span style={{ color: 'var(--v-text-faint)', fontSize: 11 }}>— {m.description}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {configured && (
        <div style={{ fontSize: 10, color: 'var(--v-text-faint)', marginTop: 10, fontFamily: 'var(--v-mono)' }}>
          Stored in your OS keychain as <span style={{ color: 'var(--v-text-muted)' }}>vilsem/{provider}</span>.
        </div>
      )}
      {extraNote}
    </div>
  )
}

export default function Health() {
  const [health, setHealth]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // AI state
  const [aiStatus, setAiStatus]                 = useState(null)
  const [claudeKeyInput, setClaudeKeyInput]     = useState('')
  const [openaiKeyInput, setOpenaiKeyInput]     = useState('')
  const [groqKeyInput, setGroqKeyInput]         = useState('')
  const [geminiKeyInput, setGeminiKeyInput]     = useState('')
  const [claudeTestResult, setClaudeTestResult] = useState(null)
  const [openaiTestResult, setOpenaiTestResult] = useState(null)
  const [groqTestResult, setGroqTestResult]     = useState(null)
  const [geminiTestResult, setGeminiTestResult] = useState(null)
  const [claudeModel, setClaudeModel]           = useState('claude-sonnet-4-6')
  const [openaiModel, setOpenaiModel]           = useState('gpt-4o')
  const [groqModel, setGroqModel]               = useState('llama-3.3-70b-versatile')
  const [geminiModel, setGeminiModel]           = useState('gemini-2.5-flash-preview-05-20')
  const [defaultProvider, setDefaultProvider]   = useState('anthropic')

  async function loadAiStatus() {
    try {
      const s = await window.semantica.getAiStatus()
      setAiStatus(s)
      setClaudeModel(s.claudeModel || 'claude-sonnet-4-6')
      setOpenaiModel(s.openaiModel || 'gpt-4o')
      setGroqModel(s.groqModel || 'llama-3.3-70b-versatile')
      setGeminiModel(s.geminiModel || 'gemini-2.5-flash-preview-05-20')
      setDefaultProvider(s.defaultProvider || 'anthropic')
    } catch { /* optional feature */ }
  }

  async function handleTestKey(provider, apiKey) {
    if (!apiKey) return
    const result = await window.semantica.testAiKey({ provider, apiKey })
    if (provider === 'anthropic') setClaudeTestResult(result)
    else if (provider === 'openai') setOpenaiTestResult(result)
    else if (provider === 'gemini') setGeminiTestResult(result)
    else setGroqTestResult(result)
  }

  async function handleSaveKey(provider, apiKey) {
    try {
      await window.semantica.saveAiKey({ provider, apiKey })
      if (provider === 'anthropic') { setClaudeKeyInput(''); setClaudeTestResult(null) }
      else if (provider === 'openai') { setOpenaiKeyInput(''); setOpenaiTestResult(null) }
      else if (provider === 'gemini') { setGeminiKeyInput(''); setGeminiTestResult(null) }
      else { setGroqKeyInput(''); setGroqTestResult(null) }
      await loadAiStatus()
    } catch (e) { alert(e.message) }
  }

  async function handleRemoveKey(provider) {
    await window.semantica.removeAiKey({ provider })
    await loadAiStatus()
  }

  async function handleModelChange(provider, model) {
    await window.semantica.setAiModel({ provider, model })
    if (provider === 'anthropic') setClaudeModel(model)
    else if (provider === 'openai') setOpenaiModel(model)
    else if (provider === 'gemini') setGeminiModel(model)
    else setGroqModel(model)
  }

  const [geminiRefreshState, setGeminiRefreshState] = useState(null) // null | 'loading' | number (count)

  async function handleRefreshGeminiModels() {
    setGeminiRefreshState('loading')
    try {
      const models = await window.semantica.getGeminiModels()
      setAiStatus(prev => prev ? { ...prev, geminiModels: models } : prev)
      setGeminiRefreshState(models.length)
      setTimeout(() => setGeminiRefreshState(null), 3000)
    } catch (e) {
      setGeminiRefreshState('error')
      setTimeout(() => setGeminiRefreshState(null), 3000)
    }
  }

  async function handleDefaultProviderChange(provider) {
    setDefaultProvider(provider)
    await window.semantica.setDefaultProvider({ provider })
  }

  const refresh = useCallback(async () => {
    if (!window.semantica) return
    try {
      const h = await window.semantica.getHealth()
      setHealth(h)
      setLastUpdated(new Date())
    } catch { /* keep last data */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    loadAiStatus()
    const iv = setInterval(refresh, 10_000)
    return () => clearInterval(iv)
  }, [refresh])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  const h = health || {}
  const reqPerMin = h.queue?.reqPerMin ?? 0
  const pct = Math.min(100, Math.round(reqPerMin / 120 * 100))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--gray-50)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>Health Dashboard</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            Auto-refreshes every 10s {lastUpdated && `· Last: ${lastUpdated.toLocaleTimeString()}`}
          </div>
        </div>
        <button onClick={refresh} style={{ background: 'white', border: '1px solid var(--v-border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Row 1 — Metric cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <MetricCard label="Total Queries"     value={h.audit?.totalQueries ?? 0} />
        <MetricCard label="Cache Hit Rate"    value={h.cache?.hitRate ?? '—'} color="var(--green)" />
        <MetricCard label="Requests / min"    value={reqPerMin} sub="of 120 max" />
        <MetricCard label="Total Writebacks"  value={h.audit?.totalWritebacks ?? 0} />
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="Engine Status">
          <Row label="Fabric connection" value={h.fabric === 'connected' ? '✓ Connected' : '✗ Not connected'} color={h.fabric === 'connected' ? 'var(--green)' : 'var(--red)'} />
          <Row label="XMLA fallback"     value={h.xmla?.fallbackAvailable ? 'Available' : 'N/A'} />
          <Row label="XMLA endpoint"     value={h.xmla?.endpoint ? '✓ Configured' : '—'} />

          {/* Connected workspaces */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Connected Workspaces</div>
            {(h.workspaces || []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>No workspaces configured</div>
            ) : (h.workspaces || []).map(ws => (
              <div key={ws.id} style={{ padding: '8px 10px', borderRadius: 7, background: ws.isActive ? 'rgba(87,185,138,.10)' : 'var(--v-surface-2)', border: `1px solid ${ws.isActive ? 'rgba(87,185,138,.20)' : 'var(--v-surface-3)'}`, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-900)' }}>
                    {ws.isActive && <span style={{ color: 'var(--green)', marginRight: 4 }}>●</span>}
                    {ws.workspaceName || ws.datasetName || ws.id}
                    {ws.isActive && <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 6 }}>(active)</span>}
                  </span>
                  <span style={{ fontSize: 11, color: ws.tokenValid === true ? 'var(--green)' : ws.tokenValid === false ? 'var(--red)' : 'var(--gray-400)', fontWeight: 600 }}>
                    {ws.tokenValid === true ? '✓ Valid' : ws.tokenValid === false ? '✗ Expired' : '—'}
                    {ws.tokenExpiresIn != null && ws.tokenValid ? ` · ${timeUntilExpiry(ws.tokenExpiresAt)}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                  {ws.authMode === 'interactive' ? 'Microsoft Account' : ws.authMode === 'service_principal' ? 'Service Principal' : ws.authMode || '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Cache Status">
          <Row label="Engine"     value={h.cache?.engine || 'SQLite'} />
          <Row label="Entries"    value={h.cache?.entries ?? 0} />
          <Row label="Hit rate"   value={h.cache?.hitRate ?? '0%'} color="var(--green)" />
          <Row label="Measures"   value={h.measures?.count ?? 0} />
          <Row label="Refreshed"  value={h.measures?.refreshedAt ? new Date(h.measures.refreshedAt).toLocaleTimeString() : '—'} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={async () => {
                if (!window.confirm('Reset ALL stored data? This clears query cache, saved visuals, measure registry, dimensions, and audit log. Cannot be undone.')) return
                await window.semantica.clearCache()
                refresh()
              }}
              style={{ background: 'rgba(224,101,110,.10)', border: '1px solid var(--v-danger)', color: 'var(--red)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              ⚠ Reset All Data
            </button>
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Removes all cached query results</span>
          </div>
        </Card>
      </div>

      {/* Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Card title="Rate Limiter">
          <Row label="Requests / min" value={`${reqPerMin} / 120`} />
          <div style={{ margin: '12px 0', background: 'var(--v-surface-3)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--red)' : 'var(--blue)', borderRadius: 999, transition: 'width 0.5s ease' }} />
          </div>
          <Row label="Queue waiting"  value={h.queue?.waiting ?? 0} />
          <Row label="Queue active"   value={h.queue?.active ?? 0} />
        </Card>

        <Card title="Lakehouse">
          <Row label="Name"             value={h.lakehouse?.name || '—'} />
          <Row label="Status"           value={h.lakehouse?.status === 'connected' ? '✓ Connected' : h.lakehouse?.status || '—'} color={h.lakehouse?.status === 'connected' ? 'var(--green)' : 'var(--amber)'} />
          <Row label="ID"               value={h.lakehouse?.id ? h.lakehouse.id.slice(0, 16) + '…' : '—'} />
          <Row label="Total writebacks" value={h.audit?.totalWritebacks ?? 0} />
        </Card>

        <Card title="Batching">
          <Row label="Queries requested"       value={h.batching?.queriesRequested ?? 0} />
          <Row label="Fabric calls made"       value={h.batching?.fabricCallsMade ?? 0} />
          <Row
            label="Calls saved by batching"
            value={h.batching?.batchSavings ?? 0}
            color={(h.batching?.batchSavings ?? 0) > 0 ? 'var(--green)' : undefined}
          />
          <Row
            label="Coalesce window"
            value="10 ms"
          />
          {(h.batching?.queriesRequested ?? 0) > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 4 }}>Efficiency</div>
              <div style={{ background: 'var(--v-surface-3)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.round(((h.batching?.batchSavings ?? 0) / h.batching.queriesRequested) * 100)}%`,
                  height: '100%',
                  background: 'var(--green)',
                  borderRadius: 999,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 3, textAlign: 'right' }}>
                {Math.round(((h.batching?.batchSavings ?? 0) / h.batching.queriesRequested) * 100)}% saved
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* AI Engine Settings */}
      <div style={{ marginTop: 20 }}>
        <Card title="AI Engine Settings">
          <AiProviderCard
            provider="anthropic"
            label="Claude (Anthropic)"
            icon="🟠"
            link="https://console.anthropic.com"
            keyPlaceholder="sk-ant-..."
            status={aiStatus?.claude}
            keyInput={claudeKeyInput}
            setKeyInput={setClaudeKeyInput}
            testResult={claudeTestResult}
            setTestResult={setClaudeTestResult}
            onTest={handleTestKey}
            onSave={handleSaveKey}
            onRemove={handleRemoveKey}
            models={aiStatus?.anthropicModels}
            selectedModel={claudeModel}
            onModelChange={handleModelChange}
            defaultProvider={defaultProvider}
            onMakeDefault={handleDefaultProviderChange}
          />
          <AiProviderCard
            provider="openai"
            label="GPT-4o (OpenAI)"
            icon="🟢"
            link="https://platform.openai.com"
            keyPlaceholder="sk-proj-..."
            status={aiStatus?.openai}
            keyInput={openaiKeyInput}
            setKeyInput={setOpenaiKeyInput}
            testResult={openaiTestResult}
            setTestResult={setOpenaiTestResult}
            onTest={handleTestKey}
            onSave={handleSaveKey}
            onRemove={handleRemoveKey}
            models={aiStatus?.openaiModels}
            selectedModel={openaiModel}
            onModelChange={handleModelChange}
            defaultProvider={defaultProvider}
            onMakeDefault={handleDefaultProviderChange}
          />
          <AiProviderCard
            provider="groq"
            label="Groq (Free tier available)"
            icon="🟣"
            link="https://console.groq.com"
            keyPlaceholder="gsk_..."
            status={aiStatus?.groq}
            keyInput={groqKeyInput}
            setKeyInput={setGroqKeyInput}
            testResult={groqTestResult}
            setTestResult={setGroqTestResult}
            onTest={handleTestKey}
            onSave={handleSaveKey}
            onRemove={handleRemoveKey}
            models={aiStatus?.groqModels}
            selectedModel={groqModel}
            onModelChange={handleModelChange}
            defaultProvider={defaultProvider}
            onMakeDefault={handleDefaultProviderChange}
          />
          <AiProviderCard
            provider="gemini"
            label="Gemini (Google) — Free tier available"
            icon="🔵"
            link="https://aistudio.google.com/apikey"
            keyPlaceholder="AIza..."
            status={aiStatus?.gemini}
            keyInput={geminiKeyInput}
            setKeyInput={setGeminiKeyInput}
            testResult={geminiTestResult}
            setTestResult={setGeminiTestResult}
            onTest={handleTestKey}
            onSave={handleSaveKey}
            onRemove={handleRemoveKey}
            models={aiStatus?.geminiModels}
            selectedModel={geminiModel}
            onModelChange={handleModelChange}
            extraNote={
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--v-text-muted)' }}>
                ℹ Free tier at aistudio.google.com — no credit card needed.
                <button
                  onClick={handleRefreshGeminiModels}
                  disabled={geminiRefreshState === 'loading'}
                  style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--v-accent)', cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}
                >
                  {geminiRefreshState === 'loading' ? '↻ Fetching…' : '↻ Refresh Models'}
                </button>
                {typeof geminiRefreshState === 'number' && (
                  <span style={{ marginLeft: 6, color: 'var(--v-success)' }}>✓ {geminiRefreshState} models loaded</span>
                )}
                {geminiRefreshState === 'error' && (
                  <span style={{ marginLeft: 6, color: 'var(--v-danger)' }}>✗ Failed — check console</span>
                )}
              </div>
            }
          />

          {/* Local AI (Phi-4-mini) removed for v1-beta — cloud LLM providers only. */}

          {aiStatus?.anyConfigured && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v-text-muted)', marginBottom: 8 }}>Default AI Engine</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { id: 'anthropic', label: '🟠 Claude',       available: !!aiStatus?.claude?.configured },
                  { id: 'openai',    label: '🟢 GPT-4o',       available: !!aiStatus?.openai?.configured },
                  { id: 'groq',      label: '🟣 Groq',         available: !!aiStatus?.groq?.configured   },
                  { id: 'gemini',    label: '🔵 Gemini',       available: !!aiStatus?.gemini?.configured  },
                ].filter(p => p.available).map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="default-provider" value={p.id} checked={defaultProvider === p.id} onChange={() => handleDefaultProviderChange(p.id)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--v-surface-2)', border: '1px solid var(--v-accent-quiet)', borderRadius: 8, fontSize: 12, color: 'var(--v-text-2)', lineHeight: 1.6 }}>
            ℹ Your API keys are stored in your OS keychain. Never saved to files, logs, or sent to vilsem. You pay only for your own usage (~$0.003/visual).
          </div>
        </Card>
      </div>
    </div>
  )
}
