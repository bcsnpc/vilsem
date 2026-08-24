import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '../ui/Surface.jsx'
import { Button } from '../ui/Button.jsx'
import { Input, Select } from '../ui/Input.jsx'
import { Modal } from '../ui/Modal.jsx'
import { Badge, StatusDot, Spinner, Chip } from '../ui/Feedback.jsx'
import { RefreshCw, Trash2, AlertTriangle, Check, Info } from '../ui/icons.js'

// Section card — design-system Surface with a small title header.
function SectionCard({ title, children, style = {} }) {
  return (
    <Card style={{ padding: '20px 24px', ...style }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>
      {children}
    </Card>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <Card style={{ padding: '18px 20px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--text-primary)', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </Card>
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
    <Card style={{ padding: '16px 18px', marginBottom: 12, boxShadow: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</strong>
        <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4, textDecoration: 'none' }}>{link.replace('https://', '')}</a>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDefault && <Badge variant="accent">Default</Badge>}
          {configured && !isDefault && onMakeDefault && (
            <Button variant="ghost" size="sm" onClick={() => onMakeDefault(provider)}>Make default</Button>
          )}
          {configured
            ? <Badge variant="success"><Check size={11} /> Configured</Badge>
            : <Badge>Not configured</Badge>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Input
          type="password"
          value={keyInput}
          onChange={e => { setKeyInput(e.target.value); setTestResult(null) }}
          placeholder={configured ? '••••••••••••••••' : keyPlaceholder}
          style={{ flex: 1 }}
        />
        <Button variant="secondary" size="sm" onClick={() => onTest(provider, keyInput)} disabled={!keyInput}>Test</Button>
        <Button variant="primary" size="sm" onClick={() => onSave(provider, keyInput)} disabled={!testResult?.valid}>Save</Button>
        {configured && (
          <Button variant="ghost" size="sm" onClick={() => onRemove(provider)} style={{ color: 'var(--danger)' }} iconLeft={<Trash2 size={14} />}>Remove</Button>
        )}
      </div>
      {testResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: testResult.valid ? 'var(--success)' : 'var(--danger)' }}>
          {testResult.valid ? <Check size={13} /> : <AlertTriangle size={13} />}
          {testResult.valid ? 'Valid key' : testResult.error}
        </div>
      )}
      {configured && models && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Model</div>
          <Select value={selectedModel} onChange={e => onModelChange(provider, e.target.value)}>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.label}{m.description ? ` — ${m.description}` : ''}</option>
            ))}
          </Select>
        </div>
      )}
      {configured && (
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>
          Stored in your OS keychain as <span style={{ color: 'var(--text-muted)' }}>vilsem/{provider}</span>.
        </div>
      )}
      {extraNote}
    </Card>
  )
}

export default function Health() {
  const [health, setHealth]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <Spinner size={24} />
    </div>
  )

  const h = health || {}
  const reqPerMin = h.queue?.reqPerMin ?? 0
  const pct = Math.min(100, Math.round(reqPerMin / 120 * 100))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--surface-base)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Health Dashboard</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Auto-refreshes every 10s {lastUpdated && `· Last: ${lastUpdated.toLocaleTimeString()}`}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} iconLeft={<RefreshCw size={14} />}>Refresh</Button>
      </div>

      {/* Row 1 — Metric cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <MetricCard label="Total Queries"     value={h.audit?.totalQueries ?? 0} />
        <MetricCard label="Cache Hit Rate"    value={h.cache?.hitRate ?? '—'} color="var(--success)" />
        <MetricCard label="Requests / min"    value={reqPerMin} sub="of 120 max" />
        <MetricCard label="Total Writebacks"  value={h.audit?.totalWritebacks ?? 0} />
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <SectionCard title="Engine Status">
          <Row label="Fabric connection" value={h.fabric === 'connected' ? '✓ Connected' : '✗ Not connected'} color={h.fabric === 'connected' ? 'var(--success)' : 'var(--danger)'} />
          <Row label="XMLA fallback"     value={h.xmla?.fallbackAvailable ? 'Available' : 'N/A'} />
          <Row label="XMLA endpoint"     value={h.xmla?.endpoint ? '✓ Configured' : '—'} />

          {/* Connected workspaces */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Connected Workspaces</div>
            {(h.workspaces || []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No workspaces configured</div>
            ) : (h.workspaces || []).map(ws => (
              <div key={ws.id} style={{ padding: '8px 10px', borderRadius: 7, background: ws.isActive ? 'var(--success-subtle)' : 'var(--surface-sunken)', border: `1px solid ${ws.isActive ? 'var(--success-subtle)' : 'var(--border-subtle)'}`, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {ws.isActive && <StatusDot tone="success" />}
                    {ws.workspaceName || ws.datasetName || ws.id}
                    {ws.isActive && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(active)</span>}
                  </span>
                  <span style={{ fontSize: 11, color: ws.tokenValid === true ? 'var(--success)' : ws.tokenValid === false ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {ws.tokenValid === true ? '✓ Valid' : ws.tokenValid === false ? '✗ Expired' : '—'}
                    {ws.tokenExpiresIn != null && ws.tokenValid ? ` · ${timeUntilExpiry(ws.tokenExpiresAt)}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ws.authMode === 'interactive' ? 'Microsoft Account' : ws.authMode === 'service_principal' ? 'Service Principal' : ws.authMode || '—'}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Cache Status">
          <Row label="Engine"     value={h.cache?.engine || 'SQLite'} />
          <Row label="Entries"    value={h.cache?.entries ?? 0} />
          <Row label="Hit rate"   value={h.cache?.hitRate ?? '0%'} color="var(--success)" />
          <Row label="Measures"   value={h.measures?.count ?? 0} />
          <Row label="Refreshed"  value={h.measures?.refreshedAt ? new Date(h.measures.refreshedAt).toLocaleTimeString() : '—'} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
              iconLeft={<AlertTriangle size={14} />}
            >
              Reset All Data
            </Button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Removes all cached query results</span>
          </div>
        </SectionCard>
      </div>

      {/* Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <SectionCard title="Rate Limiter">
          <Row label="Requests / min" value={`${reqPerMin} / 120`} />
          <div style={{ margin: '12px 0', background: 'var(--surface-sunken)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--danger)' : 'var(--accent)', borderRadius: 999, transition: 'width 0.5s ease' }} />
          </div>
          <Row label="Queue waiting"  value={h.queue?.waiting ?? 0} />
          <Row label="Queue active"   value={h.queue?.active ?? 0} />
        </SectionCard>

        <SectionCard title="Lakehouse">
          <Row label="Name"             value={h.lakehouse?.name || '—'} />
          <Row label="Status"           value={h.lakehouse?.status === 'connected' ? '✓ Connected' : h.lakehouse?.status || '—'} color={h.lakehouse?.status === 'connected' ? 'var(--success)' : 'var(--warning)'} />
          <Row label="ID"               value={h.lakehouse?.id ? h.lakehouse.id.slice(0, 16) + '…' : '—'} />
          <Row label="Total writebacks" value={h.audit?.totalWritebacks ?? 0} />
        </SectionCard>

        <SectionCard title="Batching">
          <Row label="Queries requested"       value={h.batching?.queriesRequested ?? 0} />
          <Row label="Fabric calls made"       value={h.batching?.fabricCallsMade ?? 0} />
          <Row
            label="Calls saved by batching"
            value={h.batching?.batchSavings ?? 0}
            color={(h.batching?.batchSavings ?? 0) > 0 ? 'var(--success)' : undefined}
          />
          <Row
            label="Coalesce window"
            value="10 ms"
          />
          {(h.batching?.queriesRequested ?? 0) > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Efficiency</div>
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.round(((h.batching?.batchSavings ?? 0) / h.batching.queriesRequested) * 100)}%`,
                  height: '100%',
                  background: 'var(--success)',
                  borderRadius: 999,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>
                {Math.round(((h.batching?.batchSavings ?? 0) / h.batching.queriesRequested) * 100)}% saved
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* AI Engine Settings */}
      <div style={{ marginTop: 20 }}>
        <SectionCard title="AI Engine Settings">
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
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Info size={12} /> Free tier at aistudio.google.com — no credit card needed.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshGeminiModels}
                  disabled={geminiRefreshState === 'loading'}
                  iconLeft={<RefreshCw size={13} />}
                >
                  {geminiRefreshState === 'loading' ? 'Fetching…' : 'Refresh Models'}
                </Button>
                {typeof geminiRefreshState === 'number' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}><Check size={12} /> {geminiRefreshState} models loaded</span>
                )}
                {geminiRefreshState === 'error' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}><AlertTriangle size={12} /> Failed — check console</span>
                )}
              </div>
            }
          />

          {/* Local AI (Phi-4-mini) removed for v1-beta — cloud LLM providers only. */}

          {aiStatus?.anyConfigured && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Default AI Engine</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'anthropic', label: '🟠 Claude',       available: !!aiStatus?.claude?.configured },
                  { id: 'openai',    label: '🟢 GPT-4o',       available: !!aiStatus?.openai?.configured },
                  { id: 'groq',      label: '🟣 Groq',         available: !!aiStatus?.groq?.configured   },
                  { id: 'gemini',    label: '🔵 Gemini',       available: !!aiStatus?.gemini?.configured  },
                ].filter(p => p.available).map(p => (
                  <Chip key={p.id} active={defaultProvider === p.id} onClick={() => handleDefaultProviderChange(p.id)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, padding: '10px 12px', display: 'flex', gap: 8, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Your API keys are stored in your OS keychain. Never saved to files, logs, or sent to vilsem. You pay only for your own usage (~$0.003/visual).</span>
          </div>
        </SectionCard>
      </div>

      {/* Reset-all-data confirmation */}
      {showResetConfirm && (
        <Modal
          title="Reset all data?"
          size="sm"
          onClose={() => setShowResetConfirm(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
              <Button
                variant="danger"
                iconLeft={<AlertTriangle size={15} />}
                onClick={async () => {
                  setShowResetConfirm(false)
                  await window.semantica.clearCache()
                  refresh()
                }}
              >
                Reset all data
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This clears query cache, saved visuals, measure registry, dimensions, and audit log. This cannot be undone.
          </div>
        </Modal>
      )}
    </div>
  )
}
