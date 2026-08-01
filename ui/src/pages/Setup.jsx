import React, { useState } from 'react'
import { Card } from '../ui/Surface.jsx'
import { Logo } from '../ui/Logo.jsx'
import { Button } from '../ui/Button.jsx'
import { Input, Field as DSField } from '../ui/Input.jsx'
import { CircleCheck, AlertTriangle, ArrowRight } from '../ui/icons.js'
import { Eye, EyeOff } from 'lucide-react'
import '../vilsem/tokens.css'

const STEPS = ['auth']  // workspace/dataset/lakehouse moved to Create Project dialog

// ── Shared UI components (design-system backed) ───────────────────────────────

function Field({ label, type = 'text', value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <DSField label={label}>
        <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
      </DSField>
    </div>
  )
}

function PrimaryBtn({ children, onClick, disabled, loading, small }) {
  return (
    <Button variant="primary" size={small ? 'sm' : 'md'} fullWidth onClick={onClick} disabled={disabled} loading={loading}>
      {loading ? 'Working…' : children}
    </Button>
  )
}

function SuccessBanner({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--success-subtle)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--success)', fontSize: 'var(--fs-sm)', marginBottom: 12, fontWeight: 600 }}>
      <CircleCheck size={15} /> {children}
    </div>
  )
}

function ErrorBanner({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-subtle)', borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--danger)', fontSize: 'var(--fs-sm)', marginBottom: 12 }}>
      <AlertTriangle size={15} /> {children}
    </div>
  )
}

function SelectList({ items, selected, onSelect, labelKey = 'name', valueKey = 'id', emptyMsg = 'None found' }) {
  if (!items.length) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-body)' }}>
      {emptyMsg}
    </div>
  )
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 20 }}>
      {items.map((item, i) => {
        const sel = selected?.[valueKey] === item[valueKey]
        return (
          <button key={item[valueKey]} onClick={() => onSelect(item)} style={{
            width: '100%', textAlign: 'left', padding: '11px 16px',
            border: 'none', borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-body)',
            background: sel ? 'var(--accent-subtle)' : 'transparent',
            color: sel ? 'var(--accent)' : 'var(--text-primary)',
            fontWeight: sel ? 600 : 400, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${sel ? 'var(--accent)' : 'var(--border-strong)'}`,
              background: sel ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
            </span>
            {item[labelKey]}
          </button>
        )
      })}
    </div>
  )
}

function StepIndicator({ current }) {
  const labels = ['Auth', 'Workspace', 'Dataset', 'Lakehouse']
  const idx = STEPS.indexOf(current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i <= idx ? 'var(--accent)' : 'var(--surface-sunken)',
              color: i <= idx ? 'var(--accent-contrast)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i <= idx ? 'var(--accent)' : 'var(--text-muted)', fontWeight: i === idx ? 600 : 400 }}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < idx ? 'var(--accent)' : 'var(--border-default)', margin: '0 4px', marginBottom: 16 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Microsoft logo SVG ────────────────────────────────────────────────────────

function MsLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none">
      <rect x="0"  y="0"  width="10" height="10" fill="#F25022"/>
      <rect x="11" y="0"  width="10" height="10" fill="#7FBA00"/>
      <rect x="0"  y="11" width="10" height="10" fill="#00A4EF"/>
      <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Setup({ onComplete }) {
  const [step, setStep] = useState('auth')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Auth state
  const [msTokens,   setMsTokens]   = useState(null)   // { accessToken, refreshToken, expiresIn }
  const [spAuthOk,   setSpAuthOk]   = useState(false)

  // SP credential fields
  const [tenantId,     setTenantId]     = useState(() => localStorage.getItem('setup_tenantId')  || '')
  const [clientId,     setClientId]     = useState(() => localStorage.getItem('setup_clientId')  || '')
  const [clientSecret, setClientSecret] = useState('')

  // vilsem auth UI
  const [authTab,    setAuthTab]    = useState('ms')   // 'ms' | 'sp'
  const [showSecret, setShowSecret] = useState(false)
  const hasSavedSp = !!(localStorage.getItem('setup_tenantId') && localStorage.getItem('setup_clientId'))

  // Step 2 — workspace
  const [workspaces,        setWorkspaces]        = useState([])
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)

  // Step 3 — dataset
  const [datasets,       setDatasets]       = useState([])
  const [selectedDataset, setSelectedDataset] = useState(null)

  // Step 4 — lakehouse
  const [lakehouses,       setLakehouses]       = useState([])
  const [selectedLakehouse, setSelectedLakehouse] = useState(null)

  const authOk = !!(msTokens || spAuthOk)

  // Credentials object passed to IPC calls (either access token or SP creds)
  const creds = msTokens
    ? { accessToken: msTokens.accessToken }
    : { tenantId, clientId, clientSecret }

  function setErr(msg) { setError(msg); setBusy(false) }

  // ── Auth handlers ─────────────────────────────────────────────────────────

  async function handleMsLogin() {
    setError(''); setBusy(true)
    const res = await window.semantica.startMsLogin()
    setBusy(false)
    if (!res.success) { setError(res.error || 'Sign-in failed'); return }
    setMsTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken, expiresIn: res.expiresIn })
  }

  async function handleTestSpAuth() {
    setError(''); setBusy(true)
    const res = await window.semantica.testAuth(creds)
    if (!res.success) { setErr(res.error || 'Authentication failed'); return }
    setSpAuthOk(true)
    setBusy(false)
    localStorage.setItem('setup_tenantId', tenantId)
    localStorage.setItem('setup_clientId', clientId)
  }

  // After auth → go straight to Home with just the auth creds.
  // Workspace + dataset selection happens in the Create Project dialog.
  async function handleAuthComplete() {
    setBusy(true); setError('')
    onComplete({
      authMode:   msTokens ? 'interactive' : 'service_principal',
      authOnly:   true,
      ...(msTokens
        ? { accessToken: msTokens.accessToken, refreshToken: msTokens.refreshToken, expiresIn: msTokens.expiresIn }
        : { tenantId, clientId, clientSecret }
      ),
    })
  }

  async function handleNextToWorkspace() {
    setBusy(true); setError('')
    const res = await window.semantica.getWorkspaces(creds)
    if (!res.success) { setErr(res.error || 'Failed to fetch workspaces'); return }
    setWorkspaces(res.workspaces)
    setStep('workspace')
    setBusy(false)
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────

  async function handleNextToDataset() {
    if (!selectedWorkspace) { setError('Select a workspace'); return }
    setBusy(true); setError('')
    const res = await window.semantica.getDatasets({ ...creds, workspaceId: selectedWorkspace.id })
    if (!res.success) { setErr(res.error || 'Failed to fetch datasets'); return }
    setDatasets(res.datasets)
    setStep('dataset')
    setBusy(false)
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────

  async function handleNextToLakehouse() {
    if (!selectedDataset) { setError('Select a dataset'); return }
    setBusy(true); setError('')
    const res = await window.semantica.getLakehouses({ ...creds, workspaceId: selectedWorkspace.id })
    if (!res.success) { setLakehouses([]) }
    else setLakehouses(res.lakehouses)
    setStep('lakehouse')
    setBusy(false)
  }

  // ── Step 4 ────────────────────────────────────────────────────────────────

  async function handleConnect(lakehouse) {
    setBusy(true); setError('')
    const config = {
      authMode:      msTokens ? 'interactive' : 'service_principal',
      ...(msTokens
        ? { accessToken: msTokens.accessToken, refreshToken: msTokens.refreshToken, expiresIn: msTokens.expiresIn }
        : { tenantId, clientId, clientSecret }
      ),
      workspaceId:   selectedWorkspace.id,
      workspaceName: selectedWorkspace.name,
      datasetId:     selectedDataset.id,
      datasetName:   selectedDataset.name,
      lakehouseId:   lakehouse?.id   || null,
      lakehouseName: lakehouse?.name || null,
    }
    const res = await window.semantica.saveWorkspace(config)
    if (!res.success) { setErr(res.error || 'Failed to save workspace'); return }
    setBusy(false)
    onComplete({
      workspaceName: selectedWorkspace.name,
      datasetName:   selectedDataset.name,
      datasetId:     selectedDataset.id,
      authMode:      config.authMode,
    })
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="vilsem-root" style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(900px 460px at 50% -10%, rgba(88,174,203,.06), transparent 60%), var(--v-bg-0)',
      padding: 24,
    }}>
      <Card style={{ padding: '30px 32px', width: '100%', maxWidth: 460, background: 'var(--v-surface)', border: '1px solid var(--v-border)', boxShadow: 'var(--v-shadow-modal)' }}>

        {/* vilsem brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <span style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--v-accent)', boxShadow: '0 0 0 1px var(--v-accent-border)' }} />
          <span style={{ font: '600 18px var(--v-font)', letterSpacing: '.02em', color: 'var(--v-text)' }}>vilsem</span>
        </div>
        <div style={{ font: '400 13px var(--v-font)', color: 'var(--v-text-muted)', marginBottom: 22 }}>
          Connect to your Power BI tenant to begin.
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        {/* ── Step 1: Auth (Slate two-tab) ── */}
        {step === 'auth' && (
          <>
            {/* Segmented method choice — one method visible at a time */}
            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', marginBottom: 18 }}>
              {[{ k: 'ms', label: 'Microsoft' }, { k: 'sp', label: 'Service Principal' }].map(t => (
                <button key={t.k} onClick={() => setAuthTab(t.k)} style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: 'var(--v-r)', cursor: 'pointer',
                  font: '600 12px var(--v-font)',
                  background: authTab === t.k ? 'var(--v-surface-3)' : 'transparent',
                  color: authTab === t.k ? 'var(--v-text)' : 'var(--v-text-muted)',
                  boxShadow: authTab === t.k ? 'inset 0 0 0 1px var(--v-border-strong)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>

            {authTab === 'ms' ? (
              <div>
                <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 16 }}>
                  <MsLogo size={22} />
                  <div>
                    <div style={{ font: '600 13px var(--v-font)', color: 'var(--v-text)' }}>Sign in with Microsoft</div>
                    <div style={{ font: '400 12px var(--v-font)', color: 'var(--v-text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                      Interactive OAuth · MFA · personal &amp; work accounts. Reads workspaces, reports &amp; semantic models — never row-level data without you.
                    </div>
                  </div>
                </div>
                {msTokens
                  ? <SuccessBanner>Signed in successfully</SuccessBanner>
                  : <Button variant="primary" fullWidth onClick={handleMsLogin} disabled={busy} iconLeft={<MsLogo size={15} />}>{busy && !spAuthOk ? 'Signing in…' : 'Sign in with Microsoft'}</Button>}
              </div>
            ) : (
              <div>
                {hasSavedSp && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--v-text-faint)', marginBottom: 6 }}>Saved profile</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--v-surface-3)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', font: '400 11px var(--v-mono)', color: 'var(--v-text-2)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--v-accent)', flexShrink: 0 }} />
                      {clientId ? `${clientId.slice(0, 8)}…` : 'prefilled'}<span style={{ color: 'var(--v-text-faint)' }}> · tenant {tenantId.slice(0, 8)}…</span>
                    </div>
                    {/* VILSEM_STUB: multiple named SP profiles (v1.1) */}
                  </div>
                )}
                <Field label="Tenant ID" value={tenantId} onChange={v => { setTenantId(v); setSpAuthOk(false) }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                <Field label="Client ID" value={clientId} onChange={v => { setClientId(v); setSpAuthOk(false) }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                <div style={{ marginBottom: 12 }}>
                  <div style={{ font: '600 11px var(--v-font)', color: 'var(--v-text-2)', marginBottom: 5 }}>Client Secret</div>
                  <div style={{ position: 'relative' }}>
                    <input value={clientSecret} onChange={e => { setClientSecret(e.target.value); setSpAuthOk(false) }} type={showSecret ? 'text' : 'password'} placeholder="Your client secret value"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 34px 8px 10px', background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '400 12px var(--v-mono)', outline: 'none' }} />
                    <button type="button" onClick={() => setShowSecret(s => !s)} title={showSecret ? 'Hide' : 'Reveal'}
                      style={{ position: 'absolute', right: 4, top: 4, bottom: 4, width: 28, border: 'none', background: 'transparent', color: 'var(--v-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {spAuthOk
                  ? <SuccessBanner>Authenticated successfully</SuccessBanner>
                  : <Button variant="secondary" fullWidth onClick={handleTestSpAuth} disabled={busy || !tenantId || !clientId || !clientSecret}>{busy && !msTokens ? 'Testing…' : 'Test connection'}</Button>}
              </div>
            )}

            {/* Continue — sits with whichever method you used */}
            {authOk && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--v-border)' }}>
                <Button variant="primary" fullWidth onClick={handleAuthComplete} loading={busy} iconRight={<ArrowRight size={16} />}>Continue</Button>
              </div>
            )}
          </>
        )}

        {/* ── Step 2: Workspace ── */}
        {step === 'workspace' && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Select Workspace</div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', marginBottom: 20 }}>
              Found {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </div>
            <SelectList items={workspaces} selected={selectedWorkspace} onSelect={setSelectedWorkspace} emptyMsg="No workspaces found for this account" />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep('auth')}>← Back</Button>
              <div style={{ flex: 1 }}>
                <PrimaryBtn onClick={handleNextToDataset} loading={busy} disabled={!selectedWorkspace}>Next — Select Dataset →</PrimaryBtn>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Dataset ── */}
        {step === 'dataset' && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Select Dataset</div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', marginBottom: 20 }}>
              Workspace: <strong>{selectedWorkspace?.name}</strong> · {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
            </div>
            <SelectList items={datasets} selected={selectedDataset} onSelect={setSelectedDataset} emptyMsg="No datasets found in this workspace" />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep('workspace')}>← Back</Button>
              <div style={{ flex: 1 }}>
                <PrimaryBtn onClick={handleNextToLakehouse} loading={busy} disabled={!selectedDataset}>Next — Select Lakehouse →</PrimaryBtn>
              </div>
            </div>
          </>
        )}

        {/* ── Step 4: Lakehouse ── */}
        {step === 'lakehouse' && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Select Lakehouse</div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', marginBottom: 20 }}>
              Optional — needed for writeback. Skip if not required.
            </div>
            {lakehouses.length > 0 ? (
              <SelectList items={lakehouses} selected={selectedLakehouse} onSelect={setSelectedLakehouse} />
            ) : (
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', marginBottom: 20 }}>
                No lakehouses found in this workspace.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PrimaryBtn onClick={() => handleConnect(selectedLakehouse)} loading={busy} disabled={lakehouses.length > 0 && !selectedLakehouse}>
                {selectedLakehouse ? `Connect with ${selectedLakehouse.name}` : 'Connect'}
              </PrimaryBtn>
              <Button variant="ghost" fullWidth onClick={() => handleConnect(null)} disabled={busy}>Skip — no writeback needed</Button>
              <Button variant="ghost" size="sm" fullWidth onClick={() => setStep('dataset')}>← Back</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
