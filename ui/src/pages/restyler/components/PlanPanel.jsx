import React, { useState, useMemo } from 'react'
import { PRESET_LIST, getPreset, buildPlan } from '../knowledge/presets.js'
import { FONT_PAIRINGS, fontRiskAssessment } from '../knowledge/fontWhitelist.js'

/**
 * PlanPanel — three columns:
 *   1. Brand kit (accent + brand font + chrome mode)
 *   2. Preset chooser
 *   3. Custom overrides (typography pairing, chrome treatment, layout)
 *
 * Emits a plan via onPlanChange(plan) every time anything changes.
 * The parent (PbiRestyler) holds the plan state and passes it forward to
 * Preview + Apply steps.
 */
export default function PlanPanel({ plan, onPlanChange }) {
  // Local controls — collapsed view of the plan
  const presetId       = plan?.presetId       || 'elevated_cards'
  const accent         = plan?.color?.defaultAccent || getPreset(presetId).color.defaultAccent
  const fontPairingKey = plan?.fontPairing    || 'modern_sans'
  const brandFont      = plan?.brandFont      || ''
  const chromeMode     = plan?.chromeMode     || 'light'
  const writeStrategy  = plan?.writeStrategy  || 'preserve'
  const snapToGrid     = plan?.layout?.snapToGrid !== false

  function update(overrides) {
    const next = buildPlan(overrides.presetId || presetId, {
      accent: overrides.accent ?? accent,
      mode: overrides.chromeMode ?? chromeMode,
      fontPairing: overrides.fontPairing ?? fontPairingKey,
      brandFont: overrides.brandFont ?? brandFont,
    })
    next.writeStrategy = overrides.writeStrategy ?? writeStrategy
    next.layout = { ...next.layout, snapToGrid: overrides.snapToGrid ?? snapToGrid }
    onPlanChange?.(next)
  }

  const fontRisk = useMemo(() => fontRiskAssessment(brandFont || null), [brandFont])

  return (
    <div style={{ padding: '8px 24px 24px' }}>

      {/* ── Top row: Preset cards ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>Choose a starting style</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {PRESET_LIST.map(p => (
            <PresetCard key={p.id}
              preset={p}
              active={p.id === presetId}
              onClick={() => update({ presetId: p.id, chromeMode: p.chromeMode })} />
          ))}
        </div>
      </div>

      {/* ── Two-column body: brand + custom ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── BRAND KIT ── */}
        <Card label="Brand kit">
          <Row>
            <Label>Accent color</Label>
            <ColorInput value={accent} onChange={v => update({ accent: v })} />
          </Row>
          <Row>
            <Label>Brand font</Label>
            <input type="text" value={brandFont} placeholder="Optional — e.g. Inter, Manrope"
              onChange={e => update({ brandFont: e.target.value })}
              style={textInputStyle} />
          </Row>
          {brandFont && (
            <div style={{
              fontSize: 10, padding: '8px 10px', borderRadius: 6, marginTop: 6,
              background: fontRisk.risk === 'high' ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.06)',
              border: fontRisk.risk === 'high' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(34,197,94,0.2)',
              color: fontRisk.risk === 'high' ? '#FCD34D' : '#86EFAC',
              lineHeight: 1.5,
            }}>
              {fontRisk.message}
            </div>
          )}
          <Row>
            <Label>Mode</Label>
            <ToggleGroup value={chromeMode}
              options={[['light', '☀ Light'], ['dark', '☾ Dark']]}
              onChange={v => update({ chromeMode: v })} />
          </Row>
        </Card>

        {/* ── CUSTOM TWEAKS ── */}
        <Card label="Custom tweaks">
          <Row>
            <Label>Typography</Label>
            <select value={fontPairingKey} onChange={e => update({ fontPairing: e.target.value })}
              style={selectStyle}>
              {Object.entries(FONT_PAIRINGS).map(([key, p]) => (
                <option key={key} value={key} style={{ background: '#1A1F2E' }}>
                  {p.label}
                </option>
              ))}
            </select>
          </Row>
          <Row>
            <Label>Layout normalizer</Label>
            <ToggleGroup value={snapToGrid ? 'on' : 'off'}
              options={[['on', 'Snap to 8pt'], ['off', 'Keep as-is']]}
              onChange={v => update({ snapToGrid: v === 'on' })} />
          </Row>
          <Row>
            <Label>Write strategy</Label>
            <ToggleGroup value={writeStrategy}
              options={[['preserve', 'Preserve'], ['aggressive', 'Aggressive']]}
              onChange={v => update({ writeStrategy: v })} />
          </Row>
          <div style={{ fontSize: 10, color: 'var(--v-text-faint)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
            <strong style={{ color: 'var(--v-text-2)' }}>Preserve:</strong> writes theme + chrome on every visual; keeps existing per-visual data overrides (axis fonts, fills) intact.
            <br />
            <strong style={{ color: 'var(--v-text-2)' }}>Aggressive:</strong> strips conflicting per-visual overrides so the theme cascade rules everything (more disruptive, more consistent).
          </div>
        </Card>
      </div>

      {/* ── Plan summary ── */}
      <div style={{
        marginTop: 16, padding: 14, borderRadius: 8,
        background: 'rgba(167,139,250,0.06)',
        border: '1px solid rgba(167,139,250,0.15)',
      }}>
        <div style={{ fontSize: 11, color: '#A78BFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          ✦ Plan
        </div>
        <div style={{ fontSize: 11, color: 'var(--v-text-2)', lineHeight: 1.7 }}>
          Apply <strong style={{ color: 'var(--v-text)' }}>{getPreset(presetId).label}</strong> in <strong style={{ color: 'var(--v-text)' }}>{chromeMode}</strong> mode
          with accent <code style={{ background: accent, color: 'transparent', padding: '0 4px', borderRadius: 3 }}>X</code>
          <code style={{ background: 'rgba(255,255,255,0.04)', padding: '0 4px', borderRadius: 3, color: '#A78BFA' }}>{accent}</code>
          {' '}using <strong style={{ color: 'var(--v-text)' }}>{FONT_PAIRINGS[fontPairingKey].label}</strong>
          {brandFont && <> + brand font <strong style={{ color: 'var(--v-text)' }}>{brandFont}</strong></>}.
          {snapToGrid && ' Layout will snap to 8pt grid.'}
          {' '}Write mode: <strong style={{ color: 'var(--v-text)' }}>{writeStrategy}</strong>.
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function PresetCard({ preset, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.02)',
        border: active ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: 14, textAlign: 'left',
        cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
        transition: 'all 0.15s',
      }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#A78BFA' : 'var(--v-text)', marginBottom: 4 }}>
        {preset.label}
      </div>
      <div style={{ fontSize: 10, color: 'var(--v-text-muted)', lineHeight: 1.5 }}>
        {preset.description}
      </div>
      {/* Mini swatch */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
        {[preset.color.defaultAccent, '#FFFFFF', 'var(--v-bg-1)', 'var(--v-text-2)'].map((c, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: 3, background: c,
            border: '1px solid rgba(255,255,255,0.1)',
          }} />
        ))}
      </div>
    </button>
  )
}

function Card({ label, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{
        fontSize: 11, color: '#A78BFA', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
      }}>{label}</div>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--v-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--v-text-2)', minWidth: 110 }}>{children}</div>
}

function ColorInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())}
        style={{
          width: 32, height: 28, padding: 0, border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, cursor: 'pointer', background: 'transparent',
        }} />
      <input type="text" value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
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
            border: 'none',
            color: value === val ? '#A78BFA' : 'var(--v-text-2)',
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

const textInputStyle = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--v-text)',
  padding: '5px 10px', fontSize: 11,
  borderRadius: 6, outline: 'none',
  fontFamily: 'inherit',
}

const selectStyle = {
  ...textInputStyle, flex: 1, cursor: 'pointer',
}
