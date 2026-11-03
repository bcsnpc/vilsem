import React, { useEffect, useMemo, useState } from 'react'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'
import { VISUAL_MAP } from '../../appspec/AppSpecRenderer'

/**
 * InspectorPanel — right column of ReportEditor.
 * Three tabs: Visual / Page / Inject.
 *
 * Visual types come dynamically from VISUAL_MAP exported by AppSpecRenderer
 * — no hardcoded list. Whatever is registered there shows up here.
 */
export default function InspectorPanel({
  page,
  measures,
  dimensions,
  onAddVisual,
  onUpdatePage,
  injectionScope,
  setInjectionScope,
  renderer,
  setRenderer,
  publishing,
  publishError,
  hasAnyVisual,
  onPublish,
  reportLoading,
  collapsed,
  onExpand,
}) {
  // When collapsed, render a thin clickable strip that expands on click
  if (collapsed) {
    return <CollapsedInspector T={getThemeTokens('dark')} onExpand={onExpand} />
  }

  const T    = getThemeTokens('dark')
  const teal = COLOR_SCHEMES.teal

  const [tab, setTab] = useState('visual')

  return (
    <aside style={{
      width: 320, flexShrink: 0,
      background: 'rgba(15,17,23,0.7)',
      borderLeft: `1px solid ${T.CARD_BORDER}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Tab strip */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${T.CARD_BORDER}`,
        flexShrink: 0,
      }}>
        {[
          { id: 'visual', label: 'Visual' },
          { id: 'page',   label: 'Page'   },
          { id: 'inject', label: 'Inject' },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '11px 0',
                background: active ? 'rgba(20,184,166,0.08)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? teal.start : 'transparent'}`,
                color: active ? T.textPrimary : T.textMuted,
                fontSize: 11, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s ease',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
        {tab === 'visual' && (
          <VisualTab
            T={T} teal={teal}
            measures={measures}
            dimensions={dimensions}
            onAddVisual={onAddVisual}
            reportLoading={reportLoading}
          />
        )}
        {tab === 'page' && page && (
          <PageTab
            T={T} teal={teal}
            page={page}
            onUpdatePage={onUpdatePage}
          />
        )}
        {tab === 'inject' && (
          <InjectTab
            T={T} teal={teal}
            injectionScope={injectionScope}
            setInjectionScope={setInjectionScope}
            renderer={renderer}
            setRenderer={setRenderer}
            publishing={publishing}
            publishError={publishError}
            hasAnyVisual={hasAnyVisual}
            onPublish={onPublish}
          />
        )}
      </div>
    </aside>
  )
}

// ─── Tab 1: Visual ──────────────────────────────────────────────────────────

function VisualTab({ T, teal, measures, dimensions, onAddVisual, reportLoading }) {
  // Dynamic visual type list from AppSpecRenderer registry
  const visualTypes = useMemo(() => Object.keys(VISUAL_MAP || {}), [])

  // Step state machine: 'pickType' → 'configure'
  const [step, setStep] = useState('pickType')   // 'pickType' | 'configure'
  const [selectedType, setSelectedType] = useState(null)

  // Per-visual config (reset after each Add)
  const [title, setTitle]                     = useState('')
  const [colorScheme, setColorScheme]         = useState('teal')
  const [showDataLabels, setShowDataLabels]   = useState(false)
  const [pickedMeasures, setPickedMeasures]   = useState([])  // array of { name, table }
  const [pickedDimension, setPickedDimension] = useState(null) // string `Table[Column]`
  const [aiPrompt, setAiPrompt]               = useState('')
  const [toast, setToast]                     = useState(null) // { text, color }

  // Search inputs
  const [measureQuery, setMeasureQuery] = useState('')
  const [dimQuery,     setDimQuery]     = useState('')

  const filteredMeasures = useMemo(() => {
    const q = measureQuery.trim().toLowerCase()
    if (!q) return measures.slice(0, 12)
    return measures.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 12)
  }, [measureQuery, measures])

  const dimensionItems = useMemo(() => {
    const items = []
    for (const t of (dimensions || [])) {
      for (const c of (t.columns || [])) {
        items.push({ ref: `${t.name}[${c.name}]`, table: t.name, column: c.name })
      }
    }
    return items
  }, [dimensions])

  const filteredDimensions = useMemo(() => {
    const q = dimQuery.trim().toLowerCase()
    if (!q) return dimensionItems.slice(0, 10)
    return dimensionItems.filter((d) => d.ref.toLowerCase().includes(q)).slice(0, 10)
  }, [dimQuery, dimensionItems])

  function pickType(vt) {
    setSelectedType(vt)
    setStep('configure')
    setTitle(prettyType(vt))
  }

  function backToTypePicker() {
    setStep('pickType')
    setSelectedType(null)
    resetConfig()
  }

  function resetConfig() {
    setTitle('')
    setColorScheme('teal')
    setShowDataLabels(false)
    setPickedMeasures([])
    setPickedDimension(null)
    setMeasureQuery('')
    setDimQuery('')
    setAiPrompt('')
  }

  function toggleMeasure(m) {
    setPickedMeasures((prev) => {
      const exists = prev.find((x) => x.name === m.name)
      if (exists) return prev.filter((x) => x.name !== m.name)
      return [...prev, { name: m.name, table: m.table || '' }]
    })
  }

  function removeMeasureChip(name) {
    setPickedMeasures((prev) => prev.filter((m) => m.name !== name))
  }

  function pickDimension(ref) {
    setPickedDimension((prev) => (prev === ref ? null : ref))
    setDimQuery('')
  }

  function showToast(text, color = teal.mid) {
    setToast({ text, color })
    setTimeout(() => setToast(null), 2000)
  }

  function handleAdd() {
    if (!selectedType || pickedMeasures.length === 0) return
    const visualConfig = {
      type:        selectedType,
      title:       title || prettyType(selectedType),
      measures:    pickedMeasures.map((m) => m.name),
      dimension:   pickedDimension || null,
      colorScheme,
      dataLabels:  showDataLabels,
    }
    console.log('[Inspector] Adding visual with measures:', pickedMeasures)
    console.log('[Inspector] Adding visual with dimension:', pickedDimension)
    console.log('[Inspector] Full visual config being added:', visualConfig)
    onAddVisual(visualConfig)
    showToast(`✓ Visual added`)
    // Stay on Visual tab, ready for next visual — clear config but keep type
    setTitle('')
    setPickedMeasures([])
    setPickedDimension(null)
    setMeasureQuery('')
    setDimQuery('')
    setAiPrompt('')
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (step === 'pickType') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionLabel T={T}>Pick a visual</SectionLabel>
        {visualTypes.length === 0 ? (
          <div style={{ fontSize: 11, color: T.textMuted }}>
            No visual types registered in AppSpecRenderer.
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          }}>
            {visualTypes.map((vt) => (
              <button
                key={vt}
                onClick={() => pickType(vt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 11px',
                  borderRadius: 7,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${T.CARD_BORDER}`,
                  color: T.textSecondary,
                  fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.12s ease', textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background  = `${teal.start}14`
                  e.currentTarget.style.borderColor = `${teal.start}66`
                  e.currentTarget.style.color       = T.textPrimary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = T.CARD_BORDER
                  e.currentTarget.style.color       = T.textSecondary
                }}
              >
                <span style={{ fontSize: 14 }}>{visualIcon(vt)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prettyType(vt)}
                </span>
              </button>
            ))}
          </div>
        )}

        {toast && <ToastBubble text={toast.text} color={toast.color} T={T} />}
      </div>
    )
  }

  // step === 'configure'
  // Block Add to Page while the load effect is still fetching the report —
  // otherwise the user's add can race with the load response and be wiped.
  const canAdd = pickedMeasures.length > 0 && !reportLoading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selected type header — prominent */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '11px 13px',
        background: `linear-gradient(135deg, ${teal.start}18, ${teal.start}08)`,
        border: `1px solid ${teal.start}66`,
        borderRadius: 9,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${teal.start}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: teal.mid, flexShrink: 0,
        }}>
          {visualIcon(selectedType)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textMuted }}>
            Configuring
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
            {prettyType(selectedType)}
          </div>
        </div>
        <button
          onClick={backToTypePicker}
          title="Pick a different visual type"
          style={{
            padding: '5px 9px', borderRadius: 5,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${T.CARD_BORDER}`,
            color: T.textSecondary, fontSize: 10, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Change
        </button>
      </div>

      {/* AI prompt header (Step B) — Generate is a stub for now */}
      <div style={{
        padding: '12px 13px',
        background: 'rgba(255,255,255,0.025)',
        border: `1px dashed ${T.CARD_BORDER}`,
        borderRadius: 9,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textPrimary,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 13 }}>✨</span>
          Describe this visual
        </div>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Show revenue by region…"
          rows={2}
          style={{
            width: '100%',
            padding: '7px 9px', borderRadius: 6,
            background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${T.CARD_BORDER}`,
            color: T.textPrimary, fontSize: 11, fontFamily: 'inherit',
            outline: 'none', resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => showToast('AI generation coming soon — use Manual below', '#FCD34D')}
            disabled={!aiPrompt.trim()}
            style={{
              flex: 1,
              padding: '7px 10px', borderRadius: 6,
              background: aiPrompt.trim() ? `${teal.start}33` : 'rgba(255,255,255,0.05)',
              color: aiPrompt.trim() ? teal.mid : T.textFaint,
              border: `1px solid ${aiPrompt.trim() ? teal.start + '66' : T.CARD_BORDER}`,
              fontSize: 10, fontWeight: 600,
              cursor: aiPrompt.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >
            ✨ Generate with AI
          </button>
          <button
            onClick={() => { /* Manual is always visible below — this just nudges focus */ }}
            style={{
              flex: 1,
              padding: '7px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              color: T.textSecondary,
              border: `1px solid ${T.CARD_BORDER}`,
              fontSize: 10, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Manual ↓
          </button>
        </div>
      </div>

      {/* Measures section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FieldLabel T={T}>Measures</FieldLabel>
          {pickedMeasures.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
              background: `${teal.start}22`, color: teal.mid,
              border: `1px solid ${teal.start}55`,
            }}>
              {pickedMeasures.length} selected
            </span>
          )}
        </div>
        <Input T={T} value={measureQuery} onChange={setMeasureQuery} placeholder={`/m search ${measures.length} measures…`} />

        {/* Selected measure chips */}
        {pickedMeasures.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {pickedMeasures.map((m) => (
              <span
                key={m.name}
                title={`${m.table ? m.table + ' · ' : ''}${m.name}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 4px 3px 8px',
                  background: `${teal.start}22`,
                  border: `1px solid ${teal.start}55`,
                  borderRadius: 99,
                  color: T.textPrimary, fontSize: 10, fontWeight: 600,
                  maxWidth: 220,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}
                </span>
                <button
                  onClick={() => removeMeasureChip(m.name)}
                  title="Remove"
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.10)',
                    border: 'none', color: T.textPrimary, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, lineHeight: 1, padding: 0, fontFamily: 'inherit',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Measure list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 180, overflow: 'auto' }}>
          {filteredMeasures.length === 0 && (
            <div style={{ fontSize: 11, color: T.textMuted, padding: '4px 2px' }}>
              No measures found.
            </div>
          )}
          {filteredMeasures.map((m) => {
            const checked = !!pickedMeasures.find((x) => x.name === m.name)
            return (
              <button
                key={m.name}
                onClick={() => toggleMeasure(m)}
                title={m.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 9px', borderRadius: 5,
                  background: checked ? `${teal.start}1A` : 'transparent',
                  border: `1px solid ${checked ? teal.start + '66' : 'transparent'}`,
                  color: checked ? T.textPrimary : T.textSecondary,
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 3,
                  border: `1px solid ${checked ? teal.start : T.CARD_BORDER}`,
                  background: checked ? teal.start : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 9, flexShrink: 0,
                }}>
                  {checked ? '✓' : ''}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {m.name}
                </span>
                {m.table && <span style={{ fontSize: 9, color: T.textFaint }}>{m.table}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dimension section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FieldLabel T={T}>Dimension</FieldLabel>
        <Input T={T} value={dimQuery} onChange={setDimQuery} placeholder="/d Table[Column] (optional)" />

        {/* Selected dimension chip */}
        {pickedDimension && (
          <div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 4px 3px 8px',
              background: `${teal.start}22`,
              border: `1px solid ${teal.start}55`,
              borderRadius: 99,
              color: T.textPrimary, fontSize: 10, fontWeight: 600,
              fontFamily: 'monospace',
            }}>
              {pickedDimension}
              <button
                onClick={() => setPickedDimension(null)}
                title="Remove"
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.10)',
                  border: 'none', color: T.textPrimary, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, lineHeight: 1, padding: 0, fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </span>
          </div>
        )}

        {/* Dimension list (single-pick / radio) */}
        {(dimQuery || filteredDimensions.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 140, overflow: 'auto' }}>
            {filteredDimensions.length === 0 && (
              <div style={{ fontSize: 11, color: T.textMuted, padding: '4px 2px' }}>
                No matches.
              </div>
            )}
            {filteredDimensions.map((d) => {
              const active = pickedDimension === d.ref
              return (
                <button
                  key={d.ref}
                  onClick={() => pickDimension(d.ref)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 9px', borderRadius: 5,
                    background: active ? `${teal.start}1A` : 'transparent',
                    border: `1px solid ${active ? teal.start + '66' : 'transparent'}`,
                    color: active ? T.textPrimary : T.textSecondary,
                    fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    width: 11, height: 11, borderRadius: '50%',
                    border: `1.5px solid ${active ? teal.start : T.CARD_BORDER}`,
                    background: 'transparent', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: teal.start }} />}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {d.ref}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Config section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldLabel T={T}>Title</FieldLabel>
        <Input T={T} value={title} onChange={setTitle} placeholder={prettyType(selectedType)} />

        <FieldLabel T={T}>Color Scheme</FieldLabel>
        <select
          value={colorScheme}
          onChange={(e) => setColorScheme(e.target.value)}
          style={{
            padding: '7px 9px', borderRadius: 6,
            background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${T.CARD_BORDER}`,
            color: T.textPrimary, fontSize: 11, fontFamily: 'inherit', outline: 'none',
          }}
        >
          {Object.values(COLOR_SCHEMES).map((c) => (
            <option key={c.id} value={c.id} style={{ background: '#1E293B' }}>
              {c.label}
            </option>
          ))}
        </select>

        <Toggle T={T} teal={teal}
          label="Show data labels"
          value={showDataLabels}
          onChange={setShowDataLabels}
        />
      </div>

      {/* Preview summary line */}
      {canAdd && (
        <div style={{
          fontSize: 10, color: T.textMuted, lineHeight: 1.5,
          padding: '8px 11px', borderRadius: 6,
          background: 'rgba(255,255,255,0.025)',
          border: `1px solid ${T.CARD_BORDER}`,
        }}>
          <span style={{ color: T.textFaint }}>Adding: </span>
          <strong style={{ color: T.textPrimary }}>{prettyType(selectedType)}</strong>
          <span style={{ color: T.textFaint }}> · </span>
          <span style={{ color: teal.mid }}>{pickedMeasures.map((m) => m.name).join(', ')}</span>
          {pickedDimension && (
            <>
              <span style={{ color: T.textFaint }}> · by </span>
              <span style={{ color: teal.mid, fontFamily: 'monospace' }}>{pickedDimension}</span>
            </>
          )}
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={!canAdd}
        style={{
          marginTop: 2,
          width: '100%', padding: '11px 12px',
          background: canAdd ? teal.start : 'rgba(255,255,255,0.06)',
          color: canAdd ? 'white' : T.textMuted,
          border: 'none', borderRadius: 7,
          fontSize: 12, fontWeight: 700,
          cursor: canAdd ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          boxShadow: canAdd ? `0 6px 18px ${teal.start}33` : 'none',
        }}
      >
        + Add to Page
      </button>

      {!canAdd && (
        <div style={{ fontSize: 10, color: T.textFaint, fontStyle: 'italic', textAlign: 'center' }}>
          {reportLoading
            ? 'Waiting for report to finish loading…'
            : 'Select at least one measure'}
        </div>
      )}

      {toast && <ToastBubble text={toast.text} color={toast.color} T={T} />}
    </div>
  )
}

function ToastBubble({ text, color, T }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 18, right: 18,
      padding: '8px 14px',
      background: 'rgba(11,11,20,0.96)',
      border: `1px solid ${color || T.CARD_BORDER}`,
      borderRadius: 8,
      color: color || T.textPrimary,
      fontSize: 11, fontWeight: 600,
      boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
      zIndex: 10000,
      animation: 'pbi-toast-in 0.2s ease',
    }}>
      {text}
    </div>
  )
}

// ─── Tab 2: Page ────────────────────────────────────────────────────────────

const BG_PRESETS = ['#0F1117', '#080B10', '#FFFFFF', '#1A1A2E', '#0D1117']

function PageTab({ T, teal, page, onUpdatePage }) {
  function patch(patch) { onUpdatePage(page.id, patch) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionLabel T={T}>Page Settings</SectionLabel>

      <FieldLabel T={T}>Page Name</FieldLabel>
      <Input T={T} value={page.name} onChange={(v) => patch({ name: v })} />

      <FieldLabel T={T}>Background Color</FieldLabel>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="color"
          value={page.background || '#0F1117'}
          onChange={(e) => patch({ background: e.target.value })}
          style={{ width: 30, height: 30, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
        />
        <Input T={T} value={page.background || '#0F1117'} onChange={(v) => patch({ background: v })} />
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {BG_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => patch({ background: c })}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: 5,
              background: c,
              border: `1px solid ${page.background === c ? teal.start : T.CARD_BORDER}`,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <FieldLabel T={T}>Dimensions</FieldLabel>
      <div style={{ display: 'flex', gap: 6 }}>
        <NumInput T={T} value={page.width  || 1280} onChange={(v) => patch({ width: v })}  label="W" />
        <NumInput T={T} value={page.height || 720}  onChange={(v) => patch({ height: v })} label="H" />
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {[
          { label: '16:9',   w: 1280, h: 720 },
          { label: '4:3',    w: 1024, h: 768 },
          { label: 'Custom', w: null, h: null },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => p.w && patch({ width: p.w, height: p.h })}
            style={{
              padding: '5px 9px', borderRadius: 5, fontSize: 10, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: T.textSecondary,
              border: `1px solid ${T.CARD_BORDER}`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <FieldLabel T={T}>Toggles</FieldLabel>
      <Toggle T={T} teal={teal}
        label="Hide visual headers"
        value={page.settings?.hideHeaders ?? true}
        onChange={(v) => patch({ settings: { ...page.settings, hideHeaders: v } })}
      />
      <Toggle T={T} teal={teal}
        label="Hide page navigation"
        value={page.settings?.hideNav ?? false}
        onChange={(v) => patch({ settings: { ...page.settings, hideNav: v } })}
      />
      <Toggle T={T} teal={teal}
        label="Show gridlines"
        value={page.settings?.gridlines ?? false}
        onChange={(v) => patch({ settings: { ...page.settings, gridlines: v } })}
      />
    </div>
  )
}

// ─── Tab 3: Inject ──────────────────────────────────────────────────────────

const SCOPES = [
  { id: 'single',    label: 'Single Visual', desc: 'Add one visual to existing page',         best: 'Best for: enhancing existing reports' },
  { id: 'fullpage',  label: 'Full Page',     desc: 'Replace entire page with Semantica visuals', best: 'Dark theme applied automatically' },
  { id: 'multipage', label: 'Multi-page',    desc: 'Create/replace multiple pages',            best: 'Full report transformation' },
]

function InjectTab({
  T, teal,
  injectionScope, setInjectionScope,
  renderer, setRenderer,
  publishing, publishError, hasAnyVisual,
  onPublish,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionLabel T={T}>Injection Scope</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SCOPES.map((s) => {
          const active = injectionScope === s.id
          return (
            <button
              key={s.id}
              onClick={() => setInjectionScope(s.id)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 8,
                background: active ? `${teal.start}14` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? teal.start + '99' : T.CARD_BORDER}`,
                color: active ? T.textPrimary : T.textSecondary,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: active ? T.textPrimary : T.textPrimary }}>
                {s.label}
              </div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{s.desc}</div>
              <div style={{ fontSize: 9, color: T.textFaint, fontStyle: 'italic' }}>{s.best}</div>
            </button>
          )
        })}
      </div>

      <div style={{ height: 1, background: T.CARD_BORDER }} />

      <SectionLabel T={T}>HTML Renderer</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Radio
          T={T} teal={teal}
          checked={renderer === 'htmlcontent'}
          onChange={() => setRenderer('htmlcontent')}
          label="HTML Content Visual (AppSource)"
          sub="Default — uses pre-installed HTML Content visual"
        />
        <Radio
          T={T} teal={teal}
          checked={renderer === 'semantica'}
          onChange={() => setRenderer('semantica')}
          label="vilsem Renderer (.pbiviz)"
          sub="Custom visual — requires admin install"
        />
      </div>

      {renderer === 'semantica' && (
        <div style={{
          padding: '10px 12px',
          background: `${teal.start}10`,
          border: `1px dashed ${teal.start}55`,
          borderRadius: 7,
          fontSize: 10, color: T.textSecondary, lineHeight: 1.5,
        }}>
          Download and send to your Power BI Admin to install in your org.
          <button
            onClick={() => alert('vilsem Renderer .pbiviz build coming in a later step.')}
            style={{
              marginTop: 8, width: '100%', padding: '7px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${teal.start}66`,
              color: teal.mid,
              borderRadius: 6, fontSize: 10, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↓ Download vilsem Renderer .pbiviz
          </button>
        </div>
      )}

      <div style={{ height: 1, background: T.CARD_BORDER }} />

      {publishError && (
        <div style={{
          padding: '8px 11px', borderRadius: 7,
          background: 'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.3)',
          color: '#FCA5A5', fontSize: 11, lineHeight: 1.4,
        }}>
          {publishError}
        </div>
      )}

      {!hasAnyVisual && (
        <div style={{ fontSize: 10, color: T.textMuted, fontStyle: 'italic' }}>
          Add at least one visual before publishing.
        </div>
      )}

      <button
        onClick={onPublish}
        disabled={publishing || !hasAnyVisual}
        style={{
          width: '100%', padding: '13px 14px',
          background: (publishing || !hasAnyVisual) ? 'rgba(255,255,255,0.06)' : teal.start,
          color: (publishing || !hasAnyVisual) ? T.textMuted : 'white',
          border: 'none', borderRadius: 8,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.01em',
          cursor: (publishing || !hasAnyVisual) ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: (publishing || !hasAnyVisual) ? 'none' : `0 8px 20px ${teal.start}44`,
        }}
      >
        {publishing ? '⚡ Publishing…' : 'Publish to Fabric →'}
      </button>
    </div>
  )
}

// ─── Shared atoms ───────────────────────────────────────────────────────────

function SectionLabel({ children, T }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: T.textMuted, fontWeight: 600,
    }}>
      {children}
    </div>
  )
}
function FieldLabel({ children, T }) {
  return (
    <div style={{
      fontSize: 10, color: T.textMuted, fontWeight: 600,
      marginTop: 2, marginBottom: -8,
    }}>
      {children}
    </div>
  )
}

function Input({ T, value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '7px 9px', borderRadius: 6,
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${T.CARD_BORDER}`,
        color: T.textPrimary, fontSize: 11, fontFamily: 'inherit', outline: 'none',
      }}
    />
  )
}

function NumInput({ T, value, onChange, label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600 }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        style={{
          flex: 1, width: 0,
          padding: '5px 7px', borderRadius: 5,
          background: 'rgba(0,0,0,0.35)',
          border: `1px solid ${T.CARD_BORDER}`,
          color: T.textPrimary, fontSize: 11, fontFamily: 'inherit', outline: 'none',
        }}
      />
    </div>
  )
}

function Toggle({ T, teal, label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', borderRadius: 6,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${T.CARD_BORDER}`,
        color: T.textSecondary,
        fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <span style={{
        width: 26, height: 14, borderRadius: 99,
        background: value ? teal.start : 'rgba(255,255,255,0.10)',
        position: 'relative', transition: 'background 0.12s ease',
      }}>
        <span style={{
          position: 'absolute', top: 1, left: value ? 13 : 1,
          width: 12, height: 12, borderRadius: '50%',
          background: 'white',
          transition: 'left 0.14s ease',
        }} />
      </span>
    </button>
  )
}

function Radio({ T, teal, checked, onChange, label, sub }) {
  return (
    <button
      onClick={onChange}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        padding: '8px 10px', borderRadius: 7,
        background: checked ? `${teal.start}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${checked ? teal.start + '88' : T.CARD_BORDER}`,
        color: T.textSecondary, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{
        width: 13, height: 13, borderRadius: '50%',
        border: `2px solid ${checked ? teal.start : T.CARD_BORDER}`,
        background: 'transparent', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: teal.start }} />
        )}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: T.textPrimary, fontWeight: 600 }}>{label}</span>
        <span style={{ color: T.textMuted, fontSize: 10 }}>{sub}</span>
      </span>
    </button>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function prettyType(t) {
  if (!t) return ''
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const ICONS = {
  kpi:         '⊞',
  bar:         '▦',
  stacked_bar: '▤',
  line:        '⌇',
  area:        '◢',
  donut:       '◐',
  gauge:       '◓',
  radar:       '✺',
  scatter:     '⁘',
  treemap:     '⬚',
  funnel:      '▽',
  sankey:      '⇶',
  table:       '☷',
}
function visualIcon(type) { return ICONS[type] || '◇' }

// ─── Collapsed inspector ───────────────────────────────────────────────────

function CollapsedInspector({ T, onExpand }) {
  const teal = COLOR_SCHEMES.teal
  return (
    <aside
      onClick={onExpand}
      title="Click to expand inspector"
      style={{
        width: 36, flexShrink: 0,
        background: 'rgba(15,17,23,0.7)',
        borderLeft: `1px solid ${T.CARD_BORDER}`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '14px 0', gap: 14,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 16, color: teal.mid }}>✦</span>
      <div style={{
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontSize: 10, fontWeight: 600,
        color: T.textSecondary,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Inspector ↓
      </div>
    </aside>
  )
}

// Inject toast keyframes once
if (typeof document !== 'undefined' && !document.getElementById('pbi-toast-keyframes')) {
  const style = document.createElement('style')
  style.id = 'pbi-toast-keyframes'
  style.textContent = `
    @keyframes pbi-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
}
