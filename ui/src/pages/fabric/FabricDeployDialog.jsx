import React, { useEffect, useRef, useState } from 'react'

// Deploy-to-Fabric (Rayfin) dialog — SPIKE, isolated + feature-flagged. Rendered
// only when FLAGS.fabricExport is on and the fabric IPC is present. Self-contained
// (own overlay) so it touches no existing export/publish UI.
export default function FabricDeployDialog({ spec, appTitle, datasetId, onClose }) {
  const [prereq, setPrereq] = useState(null)
  const [info, setInfo] = useState(null)
  const [workspace, setWorkspace] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('idle') // idle | deploying | done | error
  const [result, setResult] = useState(null)
  const [templateOnly, setTemplateOnly] = useState(false)
  const preRef = useRef(null)

  useEffect(() => {
    window.semantica?.fabricPrereqCheck?.().then(setPrereq).catch(() => setPrereq({ ok: false, missing: ['check failed'], results: {} }))
    window.semantica?.fabricConfigInfo?.().then(setInfo).catch(() => {})
  }, [])

  useEffect(() => {
    const off = window.semantica?.onFabricOutput?.((chunk) => {
      setOutput(o => o + (chunk?.text || ''))
      requestAnimationFrame(() => { if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight })
    })
    return () => { off && off() }
  }, [])

  const runDeploy = async (dryRun) => {
    setStatus('deploying'); setOutput(''); setResult(null)
    try {
      const res = await window.semantica.fabricDeploy({ spec, opts: { appName: appTitle, workspace: workspace.trim(), datasetId, dryRun, injectChart: !templateOnly } })
      setResult(res); setStatus(res?.ok ? 'done' : 'error')
    } catch (e) {
      setResult({ ok: false, error: { code: 'IPC', message: String(e?.message || e) } }); setStatus('error')
    }
  }

  const canDeploy = prereq?.ok && workspace.trim() && status !== 'deploying'
  const row = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }
  const ok = (b) => (b ? '#22C55E' : '#F43F5E')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 640, maxWidth: '96vw', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface-raised, #14181e)', color: 'var(--text-primary, #E8ECF1)', border: '1px solid var(--border-default, #2A313A)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Deploy to Fabric <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#E0A458', border: '1px solid #4A3F2A', borderRadius: 999, padding: '2px 8px', marginLeft: 6 }}>PREVIEW SPIKE</span></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #9BA6B4)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #9BA6B4)', lineHeight: 1.5, marginBottom: 14 }}>
          Generates a Rayfin data-app from <b>{appTitle || 'this dashboard'}</b> (one visual for the spike) and runs <code>rayfin up</code>. Deployed apps currently run inside the Fabric portal.
          {info && <span style={{ display: 'block', marginTop: 4, fontFamily: 'monospace', fontSize: 10, opacity: 0.7 }}>targets Rayfin preview {info.previewTargetedAt} · template {info.templateName}</span>}
        </div>

        {/* Prereqs */}
        <div style={{ background: 'var(--surface-sunken, #0E1013)', border: '1px solid var(--border-subtle, #222)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint, #6B7684)', marginBottom: 6 }}>Prerequisites</div>
          {!prereq && <div style={{ fontSize: 12, opacity: 0.6 }}>Checking…</div>}
          {prereq && Object.entries(prereq.results).map(([k, r]) => (
            <div key={k} style={row}>
              <span style={{ color: ok(r.found && r.versionOk), fontWeight: 700 }}>{r.found && r.versionOk ? '✓' : (r.required ? '✕' : '○')}</span>
              <span style={{ flex: 1 }}>{r.label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}>{r.found ? r.version : (r.required ? 'missing' : 'not found (optional)')}</span>
            </div>
          ))}
          {prereq && !prereq.ok && <div style={{ fontSize: 11, color: '#F43F5E', marginTop: 6 }}>Install: {prereq.missing.join(', ')}. Rayfin itself is fetched via npx.</div>}
        </div>

        {/* One-time login — done in-app now (spawns the Rayfin browser sign-in). */}
        <div style={{ background: 'rgba(224,164,88,0.1)', border: '1px solid rgba(224,164,88,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11.5, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <b style={{ color: '#E0A458' }}>First time, or session expired?</b> Click <b>Sign in to Fabric</b> — it opens a browser sign-in and caches your Fabric session for deploys. No terminal needed.
          </div>
          <button onClick={() => window.semantica?.fabricLogin?.()} disabled={status === 'deploying'}
            title="Open a browser sign-in and cache your Fabric session"
            style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(224,164,88,0.5)', cursor: status === 'deploying' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, background: 'rgba(224,164,88,0.15)', color: '#E0A458', whiteSpace: 'nowrap' }}>
            Sign in to Fabric
          </button>
        </div>

        {/* Target workspace */}
        <label style={{ fontSize: 11, color: 'var(--text-muted, #9BA6B4)', display: 'block', marginBottom: 4 }}>Target Fabric workspace name</label>
        <input value={workspace} onChange={e => setWorkspace(e.target.value)} placeholder="my-workspace" disabled={status === 'deploying'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-default, #2A313A)', background: 'var(--surface-sunken, #0E1013)', color: 'inherit', fontSize: 13, marginBottom: 12 }} />

        {/* Template-only first run — deploys the scaffolded data-app WITHOUT our
            (still-preview-guessed) vilsem chart, so you get a published app first. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted, #9BA6B4)', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={templateOnly} onChange={e => setTemplateOnly(e.target.checked)} disabled={status === 'deploying'} />
          Deploy template only (skip the vilsem chart) — recommended for the very first publish
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => runDeploy(false)} disabled={!canDeploy}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', cursor: canDeploy ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 13, background: canDeploy ? '#58AECB' : 'var(--surface-hover, #1C2128)', color: canDeploy ? '#0E1013' : 'var(--text-faint, #6B7684)' }}>
            {status === 'deploying' ? 'Deploying…' : 'Deploy'}
          </button>
          <button onClick={() => runDeploy(true)} disabled={!canDeploy}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-default, #2A313A)', cursor: canDeploy ? 'pointer' : 'not-allowed', fontSize: 13, background: 'transparent', color: 'inherit' }}>
            Dry run
          </button>
          <button onClick={() => window.semantica?.fabricLogout?.()} disabled={status === 'deploying'}
            title="Clear the cached Fabric session (then Sign in to Fabric again) — 401/403 recovery"
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-default, #2A313A)', cursor: 'pointer', fontSize: 13, background: 'transparent', color: 'var(--text-muted, #9BA6B4)' }}>
            Sign out
          </button>
        </div>

        {/* Streamed output */}
        {(output || status !== 'idle') && (
          <pre ref={preRef} style={{ maxHeight: 240, overflow: 'auto', background: '#0B0B12', border: '1px solid var(--border-subtle, #222)', borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
            {output || '…'}
          </pre>
        )}

        {/* Result / error */}
        {result && result.ok && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', fontSize: 12 }}>
            ✓ Deploy finished — open the app from the Fabric portal (see the URL in the log). Project at <code>{result.projectDir}</code>.
          </div>
        )}
        {result && !result.ok && result.error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', fontSize: 12 }}>
            <b>{result.error.code}</b>{result.stage ? ` (${result.stage})` : ''}: {result.error.message}
          </div>
        )}
      </div>
    </div>
  )
}
