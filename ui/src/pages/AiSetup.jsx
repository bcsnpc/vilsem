import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, ArrowRight } from 'lucide-react'
import '../vilsem/tokens.css'

// S1.5 — first-run AI-provider onboarding. Shown after sign-in when no provider
// is configured. Wires to the same key storage as Settings (saveAiKey/getAiStatus);
// keys live in the OS keychain. The user can set one up or skip to Home.

const PROVIDERS = [
  { id: 'anthropic', statusKey: 'claude',  name: 'Anthropic',      sub: 'Claude — recommended', letter: 'A',  accent: '#D97757', placeholder: 'sk-ant-api03-…' },
  { id: 'openai',    statusKey: 'openai',  name: 'OpenAI',         sub: 'GPT-4o / GPT-5',       letter: 'OA', accent: '#10A37F', placeholder: 'sk-…' },
  { id: 'gemini',    statusKey: 'gemini',  name: 'Google Gemini',  sub: 'Gemini 2.x',           letter: 'G',  accent: '#4285F4', placeholder: 'AIza…' },
  { id: 'groq',      statusKey: 'groq',    name: 'Groq',           sub: 'Fast open models',     letter: 'GQ', accent: '#F55036', placeholder: 'gsk_…' },
]

export default function AiSetup({ onComplete }) {
  const [status, setStatus]   = useState(null)
  const [selected, setSelected] = useState('anthropic')
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const load = () => window.semantica?.getAiStatus?.().then(setStatus).catch(() => {})
  useEffect(() => { load() }, [])

  const sel = PROVIDERS.find(p => p.id === selected)
  const isConfigured = (p) => !!status?.[p.statusKey]?.configured
  const anyConfigured = !!status?.anyConfigured

  async function save() {
    if (!keyInput.trim()) { setErr('Paste an API key first.'); return }
    setSaving(true); setErr('')
    try {
      await window.semantica.saveAiKey({ provider: selected, apiKey: keyInput.trim() })
      setKeyInput(''); setShowKey(false)
      await load()
    } catch (e) {
      setErr(e?.message || 'Could not save the key.')
    }
    setSaving(false)
  }

  return (
    <div className="vilsem-root" style={{ height: '100%', overflow: 'auto', background: 'radial-gradient(1200px 700px at 50% -10%, #1a212b 0%, var(--v-bg-0) 60%)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--v-accent)' }} />
          <span style={{ font: '600 16px var(--v-font)', color: 'var(--v-text)', letterSpacing: '-.01em' }}>vilsem</span>
        </div>

        <div style={{ font: '600 11px var(--v-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--v-accent)', marginBottom: 8 }}>Almost there</div>
        <h1 style={{ font: '600 24px var(--v-font)', color: 'var(--v-text)', margin: '0 0 8px', letterSpacing: '-.02em' }}>Set up an AI provider</h1>
        <p style={{ font: '400 13px/1.55 var(--v-font)', color: 'var(--v-text-muted)', margin: '0 0 24px', maxWidth: 460 }}>
          Bring your own key. Keys are stored in your OS keychain — never in project files or exports. You can also do this later in Settings.
        </p>

        {/* Provider rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {PROVIDERS.map(p => {
            const active = selected === p.id
            const configured = isConfigured(p)
            return (
              <button key={p.id} onClick={() => { setSelected(p.id); setKeyInput(''); setErr('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', textAlign: 'left', cursor: 'pointer',
                  background: active ? 'var(--v-accent-quiet)' : 'var(--v-surface)',
                  border: `1px solid ${active ? 'var(--v-accent-border)' : 'var(--v-border)'}`, borderRadius: 'var(--v-r-2)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 'var(--v-r)', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 12px var(--v-mono)', flexShrink: 0 }}>{p.letter}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px var(--v-font)', color: 'var(--v-text)' }}>{p.name}</div>
                  <div style={{ font: '400 11px var(--v-font)', color: 'var(--v-text-faint)' }}>{p.sub}</div>
                </div>
                {configured
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 10px var(--v-mono)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--v-accent)' }}><Check size={12} /> Configured</span>
                  : <span style={{ font: '500 10px var(--v-mono)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--v-text-faint)' }}>Not set</span>}
              </button>
            )
          })}
        </div>

        {/* Key input for the selected provider */}
        <div style={{ padding: 14, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', marginBottom: 20 }}>
          <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-2)', marginBottom: 8 }}>{sel?.name} API key</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input type={showKey ? 'text' : 'password'} value={keyInput} onChange={e => { setKeyInput(e.target.value); setErr('') }}
                placeholder={sel?.placeholder} autoComplete="off" spellCheck={false}
                onKeyDown={e => { if (e.key === 'Enter') save() }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 34px 9px 10px', background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '400 12px var(--v-mono)', outline: 'none' }} />
              <button onClick={() => setShowKey(s => !s)} title={showKey ? 'Hide' : 'Show'}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--v-text-faint)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button onClick={save} disabled={saving || !keyInput.trim()}
              style={{ padding: '0 16px', background: keyInput.trim() ? 'var(--v-accent)' : 'var(--v-surface-3)', color: keyInput.trim() ? '#04121a' : 'var(--v-text-faint)', border: 'none', borderRadius: 'var(--v-r)', font: '600 12px var(--v-font)', cursor: keyInput.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
              {saving ? 'Saving…' : 'Save key'}
            </button>
          </div>
          {err && <div style={{ font: '400 11px var(--v-font)', color: 'var(--v-amber)', marginTop: 8 }}>{err}</div>}
          {!err && isConfigured(sel) && <div style={{ font: '400 11px var(--v-font)', color: 'var(--v-accent)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} /> Key stored in keychain as vilsem/{selected}.</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => onComplete(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--v-text-muted)', font: '500 13px var(--v-font)', cursor: 'pointer', padding: '8px 4px' }}>
            Skip for now
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => onComplete(true)} disabled={!anyConfigured}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 'var(--v-r)', border: 'none',
              background: anyConfigured ? 'var(--v-accent)' : 'var(--v-surface-3)', color: anyConfigured ? '#04121a' : 'var(--v-text-faint)',
              font: '600 13px var(--v-font)', cursor: anyConfigured ? 'pointer' : 'default' }}>
            Continue <ArrowRight size={15} />
          </button>
        </div>

        <p style={{ font: '400 11px/1.5 var(--v-font)', color: 'var(--v-text-faint)', margin: '20px 0 0', maxWidth: 460 }}>
          Prompts and resolved field names are sent to the selected provider. Row-level data never leaves your machine unless a visual embeds a snapshot.
        </p>
      </div>
    </div>
  )
}
