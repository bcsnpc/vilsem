import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { VISUAL_MAP } from './visuals/index.js'
import { paramsToSchema, slotCount } from '../playground/instantiate.js' // Playground Spike — custom-visual param controls + slot binding
import { Input, Select, Toggle, Range } from '../ui/Input.jsx'
import { useTheme } from '../ui/theme.js'
import { FONTS } from './shared/fonts.js'
import { resolveVisualConfig, fieldDefault, isFieldHidden } from './shared/visualDefaults.js'
import { isObjectType } from './schema.js'
import { subscribeTextEdit, getTextEditState, applyTextCmd, applyTextFontSize, insertTextToken } from './shared/textEditBus.js'
import { exportVisualPbiviz } from '../pages/powerbi/exportVisualPbiviz.js'

// ── Reusable field components ────────────────────────────────────────────────

// Inspector field components — design-system backed. Props kept stable so all
// existing call sites (and the schema-driven renderer) are unchanged; legacy
// styling props (inputStyle/baseColor/mutedColor/isDark) are now ignored in
// favour of chrome tokens.
function ElementPanel({ label, children }) {
  return (
    <div style={{ marginBottom: 10, padding: 10, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

function fieldRowStyle() { return { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } }
function fieldLabelStyle() { return { fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', width: 76, flexShrink: 0 } }
const fieldCtrlStyle = { height: 28, fontSize: 'var(--fs-sm)' }

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div style={fieldRowStyle()}>
      <span style={fieldLabelStyle()}>{label}</span>
      <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={fieldCtrlStyle} />
    </div>
  )
}

function NumberField({ label, value, onChange, min = 0, max = 999, step = 1, placeholder }) {
  return (
    <div style={fieldRowStyle()}>
      <span style={fieldLabelStyle()}>{label}</span>
      <Input type="number" min={min} max={max} step={step} value={value === null || value === undefined ? '' : value}
        onChange={e => onChange(e.target.value === '' ? '' : (Number(e.target.value) || 0))}
        placeholder={placeholder} style={fieldCtrlStyle} />
    </div>
  )
}

// Image picker — upload a file (embedded as a data URI so it travels with the spec to
// web export / Fabric) OR paste a URL. Caps upload size to keep the spec reasonable.
function ImageUploadField({ label, value, onChange, inputStyle, mutedColor, baseColor }) {
  const fileRef = useRef(null)
  const isData = typeof value === 'string' && value.startsWith('data:')
  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { window.alert('Image is larger than 3 MB — use a smaller file or paste a URL.'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const btn = { fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--v-accent-border)', background: 'var(--v-accent-quiet)', color: 'var(--v-accent)' }
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4 }}>{label}</div>
      {value ? (
        <img src={value} alt="" style={{ maxWidth: '100%', maxHeight: 84, borderRadius: 5, display: 'block', marginBottom: 6, border: '1px solid var(--v-border)' }} onError={e => { e.currentTarget.style.opacity = '0.3' }} />
      ) : null}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} style={btn}>{value ? 'Replace…' : 'Upload…'}</button>
        {value && <button onClick={() => onChange('')} style={{ ...btn, border: '1px solid var(--v-border)', background: 'transparent', color: mutedColor }}>Clear</button>}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      </div>
      <input value={isData ? '' : (value || '')} placeholder="…or paste an image URL"
        onChange={e => onChange(e.target.value || '')}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginTop: 6 }} />
      {isData && <div style={{ fontSize: 9, color: mutedColor, marginTop: 3 }}>Embedded image — travels with the report.</div>}
    </div>
  )
}

function ColorField({ label, value, onChange, placeholder }) {
  const displayVal = value || (placeholder && placeholder.startsWith('#') ? placeholder : '#000000')
  return (
    <div style={fieldRowStyle()}>
      <span style={fieldLabelStyle()}>{label}</span>
      <input type="color" value={displayVal} onChange={e => onChange(e.target.value)}
        style={{ width: 30, height: 28, border: '1px solid var(--border-default)', padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
      <Input value={value || ''} onChange={e => onChange(e.target.value || null)} placeholder={placeholder || 'auto'} style={{ ...fieldCtrlStyle, width: 80 }} />
    </div>
  )
}

function FontField({ label, value, onChange, fonts }) {
  return (
    <div style={fieldRowStyle()}>
      <span style={fieldLabelStyle()}>{label}</span>
      <Select value={value || ''} onChange={e => onChange(e.target.value || null)} style={fieldCtrlStyle}>
        <option value="">Default</option>
        {fonts.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </Select>
    </div>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div style={fieldRowStyle()}>
      <span style={fieldLabelStyle()}>{label}</span>
      <Select value={value} onChange={e => onChange(e.target.value)} style={fieldCtrlStyle}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
    </div>
  )
}

// Searchable combobox — a button that opens a filter box + scrollable option list.
// Used for measure / axis / dimension pickers so long field lists are searchable.
function SearchableSelect({ label, placeholder = 'Select…', options, onChange, inputStyle, emptyText = 'No matches' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const query = q.trim().toLowerCase()
  const filtered = query ? options.filter(([, l]) => String(l).toLowerCase().includes(query)) : options
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: label ? 'var(--v-text)' : 'var(--v-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label || placeholder}</span>
        <span style={{ color: 'var(--v-text-faint)', flexShrink: 0, fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 20, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', boxShadow: 'var(--v-shadow)', overflow: 'hidden' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'var(--v-bg-1)', border: 'none', borderBottom: '1px solid var(--v-border)', color: 'var(--v-text)', font: '400 11px var(--v-font)', outline: 'none' }} />
          <div style={{ maxHeight: 176, overflow: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '8px 10px', fontSize: 10, color: 'var(--v-text-faint)' }}>{emptyText}</div>}
            {filtered.map(([v, l]) => (
              <button key={v} type="button" onClick={() => { onChange(v); setOpen(false); setQ('') }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--v-surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--v-text)', font: '400 11px var(--v-font)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleField({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 6 }}>
      <span>{label}</span>
      <Toggle checked={!!value} onChange={onChange} />
    </label>
  )
}

function RangeField({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  const v = value ?? 0
  // Display fractional values (step < 1) with 2 decimals; integers otherwise
  const display = step < 1 ? (typeof v === 'number' ? v.toFixed(2) : v) : v
  return (
    <div style={{ ...fieldRowStyle(), marginBottom: 6 }}>
      <span style={fieldLabelStyle()}>{label}</span>
      <Range min={min} max={max} step={step} value={v} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', width: 42, textAlign: 'right' }}>{display}</span>
    </div>
  )
}

// Schema-driven field renderer — reads VISUAL_MAP[type].schema and renders each
// field into the correct control (toggle/range/number/color/select/text).
// Writes go through updateConfig (direct to visual.config, no LLM round-trip).
// Hardcoded Chart Features panel handles keys already listed in HARDCODED_KEYS —
// those are filtered out here to avoid duplication until Phase 4.5 cleanup.
const HARDCODED_KEYS = new Set([
  'gridLines', 'animations', 'dataLabels', 'labelPosition', 'dataLabelColor',
  'gradient', 'rankOpacity', 'highlightMax', 'smooth', 'showDots', 'showAccentStrip',
])

function SchemaFields({ schema, type, cfg, updateConfig, baseColor, mutedColor, inputStyle, isDark, dateColumnOptions }) {
  if (!Array.isArray(schema) || schema.length === 0) return null

  // Hide hardcoded-panel duplicates AND controls the renderer can't honor for this type.
  // bar_race has no generic "Chart Features" panel (its controls are bar/line-centric),
  // so it keeps its own schema fields even where a key overlaps HARDCODED_KEYS (dataLabels).
  const visibleFields = schema.filter(f => (type === 'bar_race' || !HARDCODED_KEYS.has(f.key)) && !isFieldHidden(type, f.key))
  if (visibleFields.length === 0) return null

  // Group fields by schema[i].group (defaults to "Other")
  const byGroup = {}
  for (const f of visibleFields) {
    const g = f.group || 'Other'
    if (!byGroup[g]) byGroup[g] = []
    byGroup[g].push(f)
  }

  const renderField = (f) => {
    // Display the renderer's REAL per-type default when unset (not just schema.default),
    // so the control matches what the chart draws on load — no nudge needed.
    const dflt = fieldDefault(type, f.key, f.default)
    const val = cfg[f.key] !== undefined ? cfg[f.key] : dflt
    const onChange = (v) => updateConfig(f.key, v)
    switch (f.type) {
      case 'boolean':
        return <ToggleField key={f.key} label={f.label} value={val} onChange={onChange} baseColor={baseColor} />
      case 'range':
        return <RangeField key={f.key} label={f.label} value={val} onChange={onChange}
          min={f.min ?? 0} max={f.max ?? 100} step={f.step ?? 1} mutedColor={mutedColor} />
      case 'number':
        return <NumberField key={f.key} label={f.label} value={val} onChange={onChange}
          min={f.min ?? 0} max={f.max ?? 999} step={f.step ?? 1} inputStyle={inputStyle} />
      case 'color':
        return <ColorField key={f.key} label={f.label} value={val} onChange={onChange}
          placeholder={typeof dflt === 'string' ? dflt : '#'} inputStyle={inputStyle} />
      case 'select': {
        const opts = (f.options || []).map(o => [o.value, o.label])
        return <SelectField key={f.key} label={f.label} value={val} options={opts} onChange={onChange} inputStyle={inputStyle} />
      }
      case 'text':
        return <TextField key={f.key} label={f.label} value={val} onChange={onChange} inputStyle={inputStyle} />
      case 'font':
        return <SelectField key={f.key} label={f.label} value={val || ''}
          options={[['', 'Default'], ...FONTS.map(fn => [fn, fn])]} onChange={onChange} inputStyle={inputStyle} />
      case 'imageUpload':
        return <ImageUploadField key={f.key} label={f.label} value={val} onChange={onChange}
          inputStyle={inputStyle} mutedColor={mutedColor} baseColor={baseColor} />
      case 'dateColumn':
        // Time/date column picker — reuses the sparkline axis column list.
        return <SelectField key={f.key} label={f.label} value={val || ''}
          options={dateColumnOptions || [['', 'Auto-detect']]} onChange={v => onChange(v || null)} inputStyle={inputStyle} />
      default:
        return null
    }
  }

  return (
    <>
      {Object.entries(byGroup).map(([groupName, fields]) => (
        <ElementPanel key={groupName} label={groupName} isDark={isDark}>
          {fields.map(renderField)}
        </ElementPanel>
      ))}
    </>
  )
}

// Playground Spike — per-section colour editor. Each colour maps to a category /
// slice / bar in order (config.sectionColors), overriding the theme palette so a
// custom visual can be coloured section-by-section.
const DEFAULT_SECTION_COLORS = ['#14B8A6', '#3B82F6', '#A855F7', '#F59E0B', '#22C55E', '#F43F5E']
function SectionColorsEditor({ colors, onChange, isDark, mutedColor }) {
  const list = (Array.isArray(colors) && colors.length) ? colors : DEFAULT_SECTION_COLORS
  const setAt = (i, val) => { const next = [...list]; next[i] = val; onChange(next) }
  const removeAt = (i) => onChange(list.filter((_, idx) => idx !== i))
  return (
    <ElementPanel label="Section colours" isDark={isDark}>
      <div style={{ fontSize: 9, color: mutedColor, marginBottom: 6 }}>One colour per category / slice / bar, in order. Pie & donut slices apply automatically; bars need a per-data colour template.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {list.map((c, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <input type="color" value={c || '#58AECB'} onChange={e => setAt(i, e.target.value)}
              style={{ width: 30, height: 26, border: '1px solid var(--v-border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', padding: 0 }} />
            <button onClick={() => removeAt(i)} title="Remove"
              style={{ position: 'absolute', top: -6, right: -6, width: 15, height: 15, borderRadius: '50%', border: 'none', background: '#E06C6C', color: '#fff', fontSize: 10, lineHeight: '15px', cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
        <button onClick={() => onChange([...list, '#58AECB'])} title="Add a colour"
          style={{ width: 30, height: 26, border: '1px dashed var(--v-border-strong)', borderRadius: 4, background: 'transparent', color: mutedColor, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>＋</button>
        {Array.isArray(colors) && colors.length > 0 && (
          <button onClick={() => onChange(null)} title="Reset to the colour scheme"
            style={{ marginLeft: 4, fontSize: 10, color: mutedColor, background: 'transparent', border: '1px solid var(--v-border)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>Reset</button>
        )}
      </div>
    </ElementPanel>
  )
}

// Playground Spike — slot-aware binder for CUSTOM visuals. The generic Data tab
// (single Group By + flat measures) can't map a template's named slots (value,
// category, xDim/yDim, start/end…), so custom visuals rendered blank on the
// canvas. This binds each declared slot to a model field and rebuilds
// data.{measures, groupBy, dimensions} in slot order — matching what shapeSlots
// (and the Playground) expects. 1 dim → groupBy; 2 dims → dimensions[].
function CustomSlotBinder({ template, data, modelCtx, inputStyle, mutedColor, isDark, onApply }) {
  const slots = template?.slots || {}
  const measureNames = (modelCtx?.measures || []).filter(m => !m.isHidden).map(m => m.name)
  const columnOpts = []
  for (const t of (modelCtx?.tables || [])) {
    if (t.tableType === 'measure_group') continue
    for (const c of (t.columns || [])) if (!c.isHidden && !c.isKey) columnOpts.push([`${t.name}|${c.name}`, `${t.name} › ${c.name}`])
  }

  // derive current per-slot bindings from the flat data contract
  const measures = data?.measures || []
  const dims = (data?.dimensions?.length ? data.dimensions : (data?.groupBy?.table ? [data.groupBy] : []))
  const bindings = {}
  let mi = 0, di = 0
  for (const [name, slot] of Object.entries(slots)) {
    if (slot.kind === 'measure') { const n = slotCount(slot.count); bindings[name] = measures.slice(mi, mi + n); mi += n }
    else { bindings[name] = dims[di] || null; di += 1 }
  }

  const apply = (next) => {
    const outMeasures = []
    const outDims = []
    for (const [name, slot] of Object.entries(slots)) {
      const b = next[name]
      if (slot.kind === 'measure') { if (Array.isArray(b)) outMeasures.push(...b.filter(Boolean)) }
      else if (b?.table) outDims.push({ table: b.table, column: b.column })
    }
    const patch = { measures: outMeasures }
    if (outDims.length >= 2) { patch.dimensions = outDims; patch.groupBy = null }
    else { patch.groupBy = outDims[0] || null; patch.dimensions = [] }
    onApply(patch)
  }

  return (
    <ElementPanel label="Bind slots" isDark={isDark}>
      {Object.keys(slots).length === 0 && <div style={{ fontSize: 10, color: mutedColor }}>This template has no slots.</div>}
      {Object.entries(slots).map(([name, slot]) => {
        if (slot.kind === 'measure') {
          const n = slotCount(slot.count)
          const arr = bindings[name] || []
          return (
            <div key={name} style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 10, color: mutedColor, marginBottom: 3 }}><b>{name}</b> · measure{n > 1 ? ` ×${n}` : ''}</div>
              {Array.from({ length: n }).map((_, i) => (
                <SelectField key={i} value={arr[i] || ''} inputStyle={inputStyle}
                  options={[['', `— measure ${n > 1 ? i + 1 : ''} —`], ...measureNames.map(m => [m, m])]}
                  onChange={val => { const a = [...arr]; a[i] = val || null; apply({ ...bindings, [name]: a }) }} />
              ))}
            </div>
          )
        }
        const cur = bindings[name]?.table ? `${bindings[name].table}|${bindings[name].column}` : ''
        return (
          <div key={name} style={{ marginBottom: 9 }}>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 3 }}><b>{name}</b> · {slot.kind}</div>
            <SelectField value={cur} inputStyle={inputStyle}
              options={[['', `— ${slot.kind === 'time' ? 'date field' : 'dimension'} —`], ...columnOpts]}
              onChange={val => { const sep = val.indexOf('|'); apply({ ...bindings, [name]: sep > -1 ? { table: val.slice(0, sep), column: val.slice(sep + 1) } : null }) }} />
          </div>
        )
      })}
    </ElementPanel>
  )
}

// Axis switcher editor — stackable list of { label, groupBy: { table, column } }.
// Shown only on chart types (not KPIs). Fewer than 2 entries = no pills render.
function AxisSwitcherEditor({ axisOptions, onChange, columnOptions, primaryAxis, baseColor, mutedColor, isDark, inputStyle }) {
  const items = axisOptions || []
  const setAt = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange(next)
  }
  const removeAt = (idx) => onChange(items.filter((_, i) => i !== idx))
  // When seeding the switcher for the first time, prepend the visual's existing
  // primary axis (its groupBy) so the user only has to add the SECOND option —
  // the switcher needs ≥2 options and the first should be what's already shown.
  const add = () => {
    if (items.length === 0 && primaryAxis?.groupBy?.table && primaryAxis?.groupBy?.column) {
      onChange([
        { label: primaryAxis.label || primaryAxis.groupBy.column, groupBy: { ...primaryAxis.groupBy } },
        { label: '', groupBy: { table: '', column: '' } },
      ])
    } else {
      onChange([...items, { label: '', groupBy: { table: '', column: '' } }])
    }
  }

  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${isDark ? 'var(--v-border)' : 'rgba(0,0,0,0.06)'}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: baseColor, marginBottom: 6 }}>Axis switcher</div>
      {items.length === 0 && (
        <div style={{ fontSize: 10, color: mutedColor, marginBottom: 6 }}>No axis options. Add 2+ to show pill buttons.</div>
      )}
      {items.length === 1 && (
        <div style={{ fontSize: 10, color: '#F59E0B', marginBottom: 6 }}>Need at least 2 options to show switcher.</div>
      )}
      {items.map((it, idx) => {
        const gbKey = it.groupBy?.table && it.groupBy?.column ? `${it.groupBy.table}|${it.groupBy.column}` : ''
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6, padding: 6, background: isDark ? 'var(--v-bg-1)' : 'rgba(0,0,0,0.02)', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="text" value={it.label || ''}
                onChange={e => setAt(idx, { label: e.target.value })}
                placeholder="Label (e.g. Region)"
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => removeAt(idx)}
                style={{ background: 'transparent', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                title="Remove">×</button>
            </div>
            <select value={gbKey}
              onChange={e => {
                const [table, column] = (e.target.value || '').split('|')
                setAt(idx, { groupBy: table && column ? { table, column } : { table: '', column: '' } })
              }}
              style={inputStyle}>
              {columnOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )
      })}
      <button onClick={add}
        style={{
          background: 'transparent', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
          color: baseColor, fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', width: '100%',
        }}>+ Add axis</button>
    </div>
  )
}

// ── Constants ────────────────────────────────────────────────────────────────

const COLOR_SCHEMES = ['teal', 'blue', 'gold', 'green', 'purple', 'violet', 'rose', 'red', 'orange']
const COLOR_HEX = { teal: '#14B8A6', blue: '#3B82F6', gold: '#F59E0B', green: '#22C55E', purple: '#A855F7', violet: '#8B5CF6', rose: '#F43F5E', red: '#EF4444', orange: '#F97316' }
// FONTS imported from shared/fonts.js (single source; expanded 10 → 30 families)

const KPI_TYPES = new Set(['kpi', 'stat_card', 'metric_tile', 'sparkline_kpi', 'bullet', 'progress', 'gauge'])

// Visual-type specific suggestion prompts
const AI_SUGGESTIONS = {
  kpi: [
    'change color to blue with $ prefix',
    'use filled card style',
    'show trend indicator',
    'add sparkline below',
    'compact mode',
    'title uppercase above the value',
    'use Plus Jakarta Sans font size 42',
    'add fadeUp animation',
    'show icon 💰',
    'set bgOpacity to 0.3',
  ],
  bar: [
    'make bars gold with gradient',
    'show data labels on bars',
    'highlight the maximum bar',
    'add average reference line',
    'round bar corners to 8px',
    'sort ascending',
    'switch to vertical orientation',
    'dim bars below 10M red',
  ],
  line: [
    'smooth curves with thicker line',
    'add gradient area fill',
    'show Y axis',
    'show data labels',
    'add target line at 20M',
    'show second measure overlay',
  ],
  donut: [
    'thicker ring with center total',
    'move legend to bottom',
    'show percent labels on slices',
    'use custom brand colors',
  ],
  default: [
    'change color scheme to gold',
    'add data labels',
    'remove grid lines',
    'increase font size',
    'add fadeUp animation',
  ],
}

// Per-category colour editor — for categorical visuals (bar/column/pie/donut/treemap/
// lollipop/bar_race). Loads the distinct values of the visual's Group-By column and lets
// the user assign a colour per category name (config.categoryColors: { name: hex }). The
// renderer falls back to the palette for any category left unset.
const CATEGORY_COLOR_TYPES = new Set(['bar', 'column', 'pie', 'donut', 'treemap', 'lollipop', 'bar_race'])
function CategoryColorsEditor({ visual, cfg, updateConfig, isDark, mutedColor }) {
  const gb = visual.data?.groupBy
  const colRef = gb?.table && gb?.column ? `${gb.table}[${gb.column}]` : null
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!colRef || !window.semantica?.getDistinctValues) { setCats([]); return }
    let cancelled = false
    setLoading(true)
    window.semantica.getDistinctValues({ column: colRef, limit: 60 })
      .then(res => { if (!cancelled) setCats((res?.values || []).map(String)) })
      .catch(() => { if (!cancelled) setCats([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [colRef])

  const colors = cfg.categoryColors || {}
  const setColor = (name, val) => {
    const next = { ...colors }
    if (val) next[name] = val; else delete next[name]
    updateConfig('categoryColors', Object.keys(next).length ? next : null)
  }

  return (
    <ElementPanel label="Category colours" isDark={isDark}>
      {!colRef && <div style={{ fontSize: 10, color: mutedColor, lineHeight: 1.4 }}>Add a category (Group By, in the Data tab) to colour by category.</div>}
      {colRef && loading && <div style={{ fontSize: 10, color: mutedColor }}>Loading categories…</div>}
      {colRef && !loading && cats.length === 0 && <div style={{ fontSize: 10, color: mutedColor }}>No categories found.</div>}
      {colRef && cats.map(name => (
        <ColorField key={name} label={name.length > 16 ? name.slice(0, 15) + '…' : name}
          value={colors[name] || ''} placeholder="auto" onChange={v => setColor(name, v)} />
      ))}
      {Object.keys(colors).length > 0 && (
        <button onClick={() => updateConfig('categoryColors', null)}
          style={{ marginTop: 4, fontSize: 10, color: 'var(--v-accent)', background: 'transparent', border: '1px solid var(--v-accent-border)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
          Reset all to palette
        </button>
      )}
    </ElementPanel>
  )
}

// Rich-text formatting panel for a text-box object — applies to the current selection in
// the on-canvas editor via the textEditBus (no floating toolbar over the text). Marked
// data-text-toolbar so clicking it doesn't dismiss the on-canvas edit.
function TextFormatPanel({ isDark, mutedColor }) {
  const [st, setSt] = useState(getTextEditState())
  useEffect(() => subscribeTextEdit(setSt), [])
  const active = st.editing
  const keep = (e) => e.preventDefault()   // buttons: keep the canvas selection
  const btn = { minWidth: 26, height: 26, border: '1px solid var(--v-border)', background: 'var(--v-surface-2)', color: 'var(--v-text)', borderRadius: 5, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  const sel = { height: 26, border: '1px solid var(--v-border)', background: 'var(--v-surface-2)', color: 'var(--v-text)', borderRadius: 5, fontSize: 11, padding: '0 4px', cursor: 'pointer' }
  const gate = { opacity: active ? 1 : 0.45, pointerEvents: active ? 'auto' : 'none' }
  return (
    <ElementPanel label="Text formatting" isDark={isDark}>
      <div style={{ fontSize: 10, color: active ? 'var(--v-accent)' : mutedColor, marginBottom: 6, lineHeight: 1.4 }}>
        {active ? 'Editing — format the selected text.' : 'Double-click the text on the canvas, then format the selection here.'}
      </div>
      <div data-text-toolbar style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', ...gate }}>
        <button onMouseDown={keep} onClick={() => applyTextCmd('bold')} style={btn}><b>B</b></button>
        <button onMouseDown={keep} onClick={() => applyTextCmd('italic')} style={btn}><i>I</i></button>
        <button onMouseDown={keep} onClick={() => applyTextCmd('underline')} style={btn}><u>U</u></button>
        <button onMouseDown={keep} onClick={() => applyTextCmd('justifyLeft')} style={btn} title="Align left">⯇</button>
        <button onMouseDown={keep} onClick={() => applyTextCmd('justifyCenter')} style={btn} title="Align centre">≡</button>
        <button onMouseDown={keep} onClick={() => applyTextCmd('justifyRight')} style={btn} title="Align right">⯈</button>
        <label style={{ ...btn, position: 'relative', overflow: 'hidden' }} title="Text colour">A
          <input type="color" onChange={e => applyTextCmd('foreColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
      </div>
      <div data-text-toolbar style={{ display: 'flex', gap: 5, marginTop: 6, ...gate }}>
        <select defaultValue="" onChange={e => { if (e.target.value) { applyTextCmd('fontName', e.target.value); e.target.value = '' } }} style={{ ...sel, flex: 1 }}>
          <option value="">Font…</option>
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select defaultValue="" onChange={e => { if (e.target.value) { applyTextFontSize(Number(e.target.value)); e.target.value = '' } }} style={sel}>
          <option value="">Size…</option>
          {[12, 14, 16, 20, 24, 32, 40, 56, 72].map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
      </div>
      <div data-text-toolbar style={{ marginTop: 6, ...gate }}>
        <select defaultValue="" onChange={e => { insertTextToken(e.target.value); e.target.value = '' }} style={{ ...sel, width: '100%', color: 'var(--v-accent)', borderColor: 'var(--v-accent-border)' }}>
          <option value="">+ Insert value…</option>
          {(st.measures || []).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ fontSize: 9, color: mutedColor, marginTop: 3 }}>Tip: type <b>/</b> in the text for a quick value picker.</div>
      </div>
    </ElementPanel>
  )
}

// Web-style nav-button config — target (page / popup / URL), style, size, colour, icon.
function NavButtonPanel({ cfg, updateConfig, pages = [], columnOptions = [], isDark, baseColor, inputStyle }) {
  const target = cfg.navTarget || 'page'
  const filterMode = cfg.filterMode || 'toggle'
  const pageOpts = [['', 'Select a page…'], ...pages.map(p => [p.id, p.name || 'Page'])]
  return (
    <>
      <ElementPanel label="Button" isDark={isDark}>
        <TextField label="Label" value={cfg.label || ''} onChange={v => updateConfig('label', v)} inputStyle={inputStyle} />
        <SelectField label="On click" value={target}
          options={[['page', 'Go to page'], ['modal', 'Open popup'], ['url', 'Open URL'], ['filter', 'Filter / reset']]}
          onChange={v => updateConfig('navTarget', v)} inputStyle={inputStyle} />
        {target === 'page' && <SelectField label="Page" value={cfg.targetPageId || ''} options={pageOpts} onChange={v => updateConfig('targetPageId', v || null)} inputStyle={inputStyle} />}
        {target === 'modal' && <SelectField label="Popup page" value={cfg.modalPageId || ''} options={pageOpts} onChange={v => updateConfig('modalPageId', v || null)} inputStyle={inputStyle} />}
        {target === 'url' && <TextField label="URL" value={cfg.url || ''} onChange={v => updateConfig('url', v)} inputStyle={inputStyle} />}
        {target === 'filter' && <>
          <SelectField label="Action" value={filterMode}
            options={[['toggle', 'Toggle a filter'], ['set', 'Set a filter'], ['clear', 'Clear all filters']]}
            onChange={v => updateConfig('filterMode', v)} inputStyle={inputStyle} />
          {filterMode !== 'clear' && <>
            <SelectField label="Field" value={cfg.filterColumn || ''} options={columnOptions} onChange={v => updateConfig('filterColumn', v || null)} inputStyle={inputStyle} />
            <TextField label="Value" value={cfg.filterValue || ''} onChange={v => updateConfig('filterValue', v)} inputStyle={inputStyle} />
          </>}
        </>}
      </ElementPanel>
      <ElementPanel label="Style" isDark={isDark}>
        <SelectField label="Variant" value={cfg.variant || 'primary'}
          options={[['primary', 'Primary'], ['secondary', 'Secondary'], ['outline', 'Outline'], ['ghost', 'Ghost']]}
          onChange={v => updateConfig('variant', v)} inputStyle={inputStyle} />
        <SelectField label="Size" value={cfg.size || 'md'}
          options={[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]}
          onChange={v => updateConfig('size', v)} inputStyle={inputStyle} />
        <ColorField label="Colour" value={cfg.color} placeholder="#3B82F6" onChange={v => updateConfig('color', v)} inputStyle={inputStyle} />
        <TextField label="Icon (emoji)" value={cfg.icon || ''} onChange={v => updateConfig('icon', v)} inputStyle={inputStyle} />
        <SelectField label="Align" value={cfg.align || 'center'} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={v => updateConfig('align', v)} inputStyle={inputStyle} />
        <ToggleField label="Full width" value={!!cfg.fullWidth} onChange={v => updateConfig('fullWidth', v)} baseColor={baseColor} />
      </ElementPanel>
    </>
  )
}

export default function VisualInspector({ visual, isDark: _isDarkProp, canvasTheme, editSpec, selectedVisualId, onClose, onDelete, onDuplicate, onAiRefine, customTemplate, embedded = false, pages = [] }) {
  // The inspector is app chrome, so it follows the chrome theme (not the canvas
  // theme that was passed in). This flips the whole panel's isDark-keyed styling.
  const [_chromeTheme] = useTheme()
  const isDark = _chromeTheme === 'dark'
  const [tab, setTab] = useState('style')
  const [collapsed, setCollapsed] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  // Export this visual as a Power BI .pbiviz.  null | 'busy' | {ok,path,guide,title} | {error}
  const [exportState, setExportState] = useState(null)
  const [exportStepsOpen, setExportStepsOpen] = useState(false)
  async function handleExport() {
    if (!visual) return
    setExportState('busy')
    try {
      const r = await exportVisualPbiviz(visual, canvasTheme || 'light')
      if (r?.canceled) { setExportState(null); return }
      setExportState(r?.success
        ? { ok: true, path: r.path, guide: r.guide, title: r.title }
        : { error: r?.message || 'Export failed' })
    } catch (e) {
      setExportState({ error: e?.message || String(e) })
    }
  }
  // Model context (measures + dimension columns) for slash autocomplete and
  // the sparkline-axis dropdown. Fetched once per mount.
  const [modelCtx, setModelCtx] = useState(null)
  useEffect(() => {
    let cancelled = false
    const ctx = window._sparklineModelCtx || window._modelCtx
    if (ctx) { setModelCtx(ctx); return }
    if (!window.semantica?.getModelContext) return
    window.semantica.getModelContext().then((c) => {
      if (cancelled) return
      window._modelCtx = c
      setModelCtx(c)
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [])
  // Slash-menu state (for /m and /d autocomplete in the AI prompt textarea)
  const [slashMenu, setSlashMenu] = useState(null) // { type, query, items, selectedIdx, matchStart }
  const aiTextareaRef = useRef(null)

  const measureItems = useMemo(() =>
    (modelCtx?.measures || []).map(m => ({ label: m.name, insert: `"${m.name}"` })),
    [modelCtx])
  const dimensionItems = useMemo(() => {
    const items = []
    for (const t of (modelCtx?.tables || [])) {
      for (const col of (t.columns || [])) {
        items.push({ label: `${t.name}[${col.name}]`, insert: `${t.name}[${col.name}]` })
      }
    }
    return items
  }, [modelCtx])

  // Date columns for sparkline axis picker — scan tables classified as date/calendar
  const dateColumnOptions = useMemo(() => {
    const opts = [['', 'Auto-detect']]
    for (const t of (modelCtx?.tables || [])) {
      const isDateTable = t.type === 'date' || /calendar|date|time/i.test(t.name)
      if (!isDateTable) continue
      for (const col of (t.columns || [])) {
        opts.push([`${t.name}[${col.name}]`, `${t.name}[${col.name}]`])
      }
    }
    return opts
  }, [modelCtx])

  // Category columns for axis-switcher picker — all non-date columns grouped by table
  const categoryColumnOptions = useMemo(() => {
    const opts = [['', 'Pick a column…']]
    for (const t of (modelCtx?.tables || [])) {
      const isDateTable = t.type === 'date' || /calendar|date|time/i.test(t.name)
      if (isDateTable) continue
      for (const col of (t.columns || [])) {
        opts.push([`${t.name}|${col.name}`, `${t.name}[${col.name}]`])
      }
    }
    return opts
  }, [modelCtx])

  function detectSlash(text, cursorPos) {
    const before = text.slice(0, cursorPos)
    const match = before.match(/\/([md])(\w*)$/)
    if (!match) return null
    return { type: match[1], query: match[2].toLowerCase(), matchStart: cursorPos - match[0].length }
  }
  function openSlashMenu(text, cursorPos) {
    const detected = detectSlash(text, cursorPos)
    if (detected) {
      const all = detected.type === 'm' ? measureItems : dimensionItems
      const items = (detected.query
        ? all.filter(i => i.label.toLowerCase().includes(detected.query))
        : all
      ).slice(0, 8)
      if (items.length > 0) { setSlashMenu({ ...detected, items, selectedIdx: 0 }); return }
    }
    setSlashMenu(null)
  }
  function insertSlashItem(item) {
    if (!item || !slashMenu) return
    const text   = aiPrompt
    const cursor = aiTextareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const match  = before.match(/\/[md]\w*$/)
    if (!match) { setSlashMenu(null); return }
    const start   = cursor - match[0].length
    const newText = text.slice(0, start) + item.insert + text.slice(cursor)
    setAiPrompt(newText)
    setSlashMenu(null)
    setTimeout(() => {
      aiTextareaRef.current?.focus()
      const pos = start + item.insert.length
      aiTextareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const cfg = visual.config || {}
  // Effective config the renderer actually uses — so fields display what renders
  // (resolved colors/opacity), not misleading static placeholders.
  const resolved = resolveVisualConfig(visual, { theme: canvasTheme || 'dark' })
  const pos = visual.position || { x: 0, y: 0, w: 4, h: 2 }
  const isKpi = KPI_TYPES.has(visual.type)
  const isObject = isObjectType(visual.type)   // text/shape/image/divider — schema-only inspector
  const isNavButton = visual.type === 'nav_button'   // web-style button — dedicated panel
  const suggestions = AI_SUGGESTIONS[visual.type] || AI_SUGGESTIONS.default

  const updateConfig = (key, value) => {
    editSpec(s => {
      const v = s.visuals.find(vi => vi.id === selectedVisualId)
      if (!v) return
      v.config = { ...(v.config || {}), [key]: value }
    })
  }
  const updateData = (key, value) => {
    editSpec(s => {
      const v = s.visuals.find(vi => vi.id === selectedVisualId)
      if (!v) return
      v.data = { ...(v.data || {}), [key]: value }
    })
  }
  // Playground Spike — set several data keys at once (custom-visual slot binding).
  const setDataPatch = (patch) => {
    editSpec(s => {
      const v = s.visuals.find(vi => vi.id === selectedVisualId)
      if (v) v.data = { ...(v.data || {}), ...patch }
    })
  }
  const updatePos = (key, value) => {
    editSpec(s => {
      const v = s.visuals.find(vi => vi.id === selectedVisualId)
      if (v?.position) v.position[key] = value
    })
  }

  // Slate tokens (dark-only). --v-* live on :root so they resolve here even when
  // the inspector is portaled to document.body (injector).
  const baseColor = 'var(--v-text)'
  const mutedColor = 'var(--v-text-muted)'
  const labelColor = 'var(--v-text-faint)'
  const inputStyle = {
    flex: 1, padding: '5px 7px',
    border: '1px solid var(--v-border)',
    borderRadius: 'var(--v-r)',
    background: 'var(--v-bg-1)',
    color: baseColor, fontSize: 11, fontFamily: 'inherit', outline: 'none',
    colorScheme: 'dark',
  }
  const tabStyle = (active) => ({
    flex: 1, padding: '8px 6px', fontSize: 10, fontWeight: 600,
    background: active ? 'var(--v-accent-quiet)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--v-accent)' : '2px solid transparent',
    color: active ? 'var(--v-accent)' : mutedColor,
    cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.04em',
  })
  const sectionLabel = { fontSize: 9, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }
  const fieldRow = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }
  const fieldLabel = { fontSize: 10, color: mutedColor, width: 72, flexShrink: 0 }

  const handleAi = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    let ok = false
    try {
      const res = await onAiRefine(aiPrompt)
      ok = res !== false
    } catch {
      ok = false
    }
    // Keep the prompt visible on failure so the user can tweak and retry;
    // clear only on success. Errors are shown in the main chat message trail.
    if (ok) setAiPrompt('')
    setAiLoading(false)
  }

  // Outer shell: floating panel (canvas overlay) vs embedded (3rd tab of the right
  // pane, filling below the pane's 37px tab bar). Same inner markup either way.
  const shell = embedded
    ? { position: 'absolute', top: 37, left: 0, right: 0, bottom: 0, background: 'var(--v-surface)', display: 'flex', flexDirection: 'column', zIndex: 6 }
    : { position: 'fixed', right: 16, top: 72, bottom: 16, width: 300, border: '1px solid var(--v-border)', background: 'var(--v-surface)', borderRadius: 'var(--v-r)', boxShadow: 'var(--v-shadow)', display: 'flex', flexDirection: 'column', zIndex: 9010 }

  // ── Slicer inspector (early return when selected item is a slicer) ───────────
  const SLICER_TYPES = new Set(['dropdown', 'buttons', 'date_range', 'multi_select'])
  if (SLICER_TYPES.has(visual.type) || visual.dimension) {
    const slcCfg = visual.config || {}
    const dim = visual.dimension || {}
    const updateSlicerConfig = (key, value) => editSpec(s => {
      const slc = (s.slicers || []).find(sl => sl.id === selectedVisualId)
      if (slc) slc.config = { ...(slc.config || {}), [key]: value }
    })
    const updateSlicerType = (type) => editSpec(s => {
      const slc = (s.slicers || []).find(sl => sl.id === selectedVisualId)
      if (slc) slc.type = type
    })
    const SLICER_TYPE_OPTIONS = [
      { value: 'dropdown',    label: 'Dropdown',    desc: 'Single select with search' },
      { value: 'multi_select',label: 'Multi-select', desc: 'Checkbox list with search' },
      { value: 'buttons',     label: 'Buttons',      desc: 'Pill toggle chips' },
      { value: 'date_range',  label: 'Date Range',   desc: 'From / To date pickers' },
    ]
    return (
      <div style={shell}>
        {/* Header */}
        <div style={{ padding: '10px 12px', borderBottom: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--v-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Slicer</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: baseColor, marginTop: 2 }}>{slcCfg.title || dim.column || 'Slicer'}</div>
            <div style={{ fontSize: 10, color: mutedColor, marginTop: 1 }}>{dim.table} › {dim.column}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: 14, padding: 4 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <div style={sectionLabel}>Label</div>
            <input
              value={slcCfg.title || ''}
              onChange={e => updateSlicerConfig('title', e.target.value || '')}
              placeholder={dim.column || 'Slicer label'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: isDark ? '#1E293B' : '#F8FAFC', border: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0', color: baseColor }}
            />
          </div>

          {/* Slicer type */}
          <div style={{ marginBottom: 12 }}>
            <div style={sectionLabel}>Type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {SLICER_TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => updateSlicerType(opt.value)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  border: visual.type === opt.value
                    ? '1.5px solid var(--v-accent)'
                    : isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0',
                  background: visual.type === opt.value
                    ? (isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)')
                    : (isDark ? 'var(--v-bg-1)' : 'transparent'),
                  textAlign: 'left',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: visual.type === opt.value ? 'var(--v-accent)' : (isDark ? '#475569' : '#CBD5E1') }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: visual.type === opt.value ? 600 : 400, color: visual.type === opt.value ? 'var(--v-accent)' : baseColor }}>{opt.label}</div>
                    <div style={{ fontSize: 9, color: mutedColor }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dimension (read-only) */}
          <div style={{ marginBottom: 12 }}>
            <div style={sectionLabel}>Dimension</div>
            <div style={{ padding: '5px 8px', borderRadius: 5, fontSize: 11, background: isDark ? 'var(--v-bg-1)' : '#F1F5F9', border: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0', color: mutedColor }}>
              {dim.table} › {dim.column}
            </div>
          </div>
        </div>

        {/* Footer — delete */}
        <div style={{ padding: '8px 12px', borderTop: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0' }}>
          <button onClick={onDelete} style={{
            width: '100%', padding: '6px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 11, background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444',
          }}>Remove Slicer</button>
        </div>
      </div>
    )
  }

  // Collapsed rail — keeps the visual selected but frees canvas space. Click ‹ to reopen.
  // Only in floating mode; when embedded the pane's own collapse chevron handles this.
  if (collapsed && !embedded) {
    return (
      <div style={{
        position: 'fixed', right: 16, top: 72, width: 40,
        border: '1px solid var(--v-border)', background: 'var(--v-surface)',
        borderRadius: 'var(--v-r)', boxShadow: 'var(--v-shadow)', zIndex: 9010,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 10,
      }}>
        <button onClick={() => setCollapsed(false)} title="Expand inspector"
          style={{ background: 'transparent', border: 'none', color: 'var(--v-accent)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>‹</button>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Inspector</div>
        <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: 13, padding: 4 }}>✕</button>
      </div>
    )
  }

  return (
    <div style={shell}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--v-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspector</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: baseColor, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cfg.title || 'Untitled'}
          </div>
          <div style={{ fontSize: 10, color: mutedColor, marginTop: 2, textTransform: 'uppercase' }}>{visual.type}</div>
        </div>
        {!embedded && <button onClick={() => setCollapsed(true)} title="Collapse inspector" style={{ background: 'transparent', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>›</button>}
        <button onClick={onClose} title={embedded ? 'Deselect' : 'Close'} style={{ background: 'transparent', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: 14, padding: 4 }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0' }}>
        <button style={tabStyle(tab === 'data')} onClick={() => setTab('data')}>Data</button>
        <button style={tabStyle(tab === 'style')} onClick={() => setTab('style')}>Style</button>
        <button style={tabStyle(tab === 'text')} onClick={() => setTab('text')}>Text</button>
        <button style={tabStyle(tab === 'layout')} onClick={() => setTab('layout')}>Layout</button>
        <button style={tabStyle(tab === 'ai')} onClick={() => setTab('ai')}>✨ AI</button>
      </div>

      {/* Tab content (scrollable) */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>

        {/* DATA TAB — measures, groupBy, query controls */}
        {tab === 'data' && (isObject || isNavButton) && (
          <div style={{ padding: '14px 4px', fontSize: 11, color: mutedColor, lineHeight: 1.5 }}>
            {isNavButton
              ? <>This is a navigation button — it has no data. Set where it goes in the <strong style={{ color: baseColor }}>Style</strong> tab.</>
              : <>This is a canvas object ({visual.type.replace('_', ' ')}) — it has no data. Edit its appearance in the <strong style={{ color: baseColor }}>Style</strong> tab.</>}
          </div>
        )}
        {tab === 'data' && !isObject && !isNavButton && (() => {
          const data = visual.data || {}
          const measures = data.measures || []
          const availMeasures = (modelCtx?.measures || []).filter(m => !m.isHidden).map(m => m.name)
          const gbKey = data.groupBy?.table && data.groupBy?.column
            ? `${data.groupBy.table}|${data.groupBy.column}` : ''

          // All non-hidden columns across all tables
          const allColOpts = [['', 'None (KPI / single value)']]
          for (const t of (modelCtx?.tables || [])) {
            for (const col of (t.columns || [])) {
              if (!col.isHidden) allColOpts.push([`${t.name}|${col.name}`, `${t.name} › ${col.name}`])
            }
          }

          const addMeasure = (name) => {
            if (!name || measures.includes(name)) return
            updateData('measures', [...measures, name])
          }
          const removeMeasure = (idx) => updateData('measures', measures.filter((_, i) => i !== idx))
          const setGroupBy = (val) => {
            if (!val) { updateData('groupBy', null); return }
            const sep = val.indexOf('|')
            const table = val.slice(0, sep)
            const column = val.slice(sep + 1)
            updateData('groupBy', table && column ? { table, column } : null)
          }

          // Table: multi-dimension helpers
          const isTable = visual.type === 'table'
          const dimensions = data.dimensions || []
          const addDimension = (val) => {
            if (!val) return
            const sep = val.indexOf('|')
            const table = val.slice(0, sep)
            const column = val.slice(sep + 1)
            if (!table || !column) return
            if (dimensions.some(d => d.table === table && d.column === column)) return
            updateData('dimensions', [...dimensions, { table, column }])
          }
          const removeDimension = (idx) => updateData('dimensions', dimensions.filter((_, i) => i !== idx))

          // Playground Spike — custom visuals bind by named slot, not the generic
          // measures + single Group By (which can't express 2 dims or slot order).
          if (visual.type === 'custom' && customTemplate) {
            return (
              <>
                <CustomSlotBinder template={customTemplate} data={data} modelCtx={modelCtx}
                  inputStyle={inputStyle} mutedColor={mutedColor} isDark={isDark} onApply={setDataPatch} />
                <ElementPanel label="Query" isDark={isDark}>
                  <SelectField label="Order" value={data.orderBy || 'desc'}
                    options={[['desc', 'Descending'], ['asc', 'Ascending (time)']]}
                    onChange={v => updateData('orderBy', v)} inputStyle={inputStyle} />
                  <NumberField label="Row limit" value={data.limit ?? 50} min={1} max={2000}
                    onChange={v => updateData('limit', Number(v))} inputStyle={inputStyle} />
                </ElementPanel>
              </>
            )
          }

          return (
            <>
              {/* Measures */}
              <ElementPanel label="Measures" isDark={isDark}>
                {measures.length === 0 && (
                  <div style={{ fontSize: 10, color: mutedColor, marginBottom: 6 }}>No measures assigned yet.</div>
                )}
                {measures.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <div style={{ flex: 1, fontSize: 10, color: baseColor, padding: '4px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderRadius: 4, border: isDark ? '1px solid var(--v-accent-border)' : '1px solid var(--v-accent-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m}
                    </div>
                    <button onClick={() => removeMeasure(i)} title="Remove"
                      style={{ background: 'transparent', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                ))}
                {availMeasures.length > 0 ? (
                  <SearchableSelect placeholder="＋ Add measure…" inputStyle={inputStyle} emptyText="No measures"
                    options={availMeasures.filter(m => !measures.includes(m)).map(m => [m, m])}
                    onChange={addMeasure} />
                ) : (
                  <div style={{ fontSize: 9, color: mutedColor }}>Connect a model to see measures.</div>
                )}
              </ElementPanel>

              {/* Table: multi-dimension Columns field well */}
              {isTable ? (
                <ElementPanel label="Columns (Dimensions)" isDark={isDark}>
                  {dimensions.length === 0 && (
                    <div style={{ fontSize: 10, color: mutedColor, marginBottom: 6 }}>No dimension columns added yet.</div>
                  )}
                  {dimensions.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <div style={{ flex: 1, fontSize: 10, color: baseColor, padding: '4px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderRadius: 4, border: isDark ? '1px solid var(--v-accent-border)' : '1px solid var(--v-accent-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.table} › {d.column}
                      </div>
                      <button onClick={() => removeDimension(i)} title="Remove"
                        style={{ background: 'transparent', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <SearchableSelect placeholder="＋ Add column…" inputStyle={inputStyle} emptyText="No columns"
                    options={allColOpts.slice(1).filter(([v]) => {
                      const sep = v.indexOf('|')
                      const tbl = v.slice(0, sep), col = v.slice(sep + 1)
                      return !dimensions.some(d => d.table === tbl && d.column === col)
                    })}
                    onChange={addDimension} />
                  {dimensions.length === 0 && (
                    <div style={{ fontSize: 9, color: '#F59E0B', marginTop: 4 }}>Table needs at least one dimension column.</div>
                  )}
                </ElementPanel>
              ) : !isKpi ? (
                /* Group By (non-table, non-KPI) — a KPI is a single scalar, no axis */
                <ElementPanel label="Group By (Axis)" isDark={isDark}>
                  <SearchableSelect inputStyle={inputStyle} emptyText="No columns"
                    label={gbKey ? (allColOpts.find(([v]) => v === gbKey)?.[1] || gbKey) : 'None (KPI / single value)'}
                    placeholder="Select axis…"
                    options={allColOpts}
                    onChange={setGroupBy} />
                  {!gbKey && !isKpi && (
                    <div style={{ fontSize: 9, color: '#F59E0B', marginTop: 4 }}>Charts need a Group By dimension to render data.</div>
                  )}
                  {visual.type === 'bar_race' && (
                    <div style={{ fontSize: 9, color: mutedColor, marginTop: 4 }}>For a bar race, this is the racing category (e.g. Product › Category), not the time axis.</div>
                  )}
                </ElementPanel>
              ) : null}

              {/* Bar race: the TIME axis the playback scrubs through. It's a second
                  dimension (frames), distinct from the racing category (Group By). */}
              {visual.type === 'bar_race' && (() => {
                const paStr = cfg.playAxis || ''                                   // stored as "Table[Column]"
                const paKey = paStr ? paStr.replace('[', '|').replace(/\]$/, '') : '' // match allColOpts "table|column"
                const setPlayAxis = (val) => {
                  if (!val) { updateConfig('playAxis', null); return }
                  const sep = val.indexOf('|'); const t = val.slice(0, sep); const c = val.slice(sep + 1)
                  updateConfig('playAxis', t && c ? `${t}[${c}]` : null)
                }
                return (
                  <ElementPanel label="Bar race" isDark={isDark}>
                    <div style={{ fontSize: 9, color: mutedColor, marginBottom: 4 }}>Play axis (time)</div>
                    <SearchableSelect inputStyle={inputStyle} emptyText="No columns"
                      label={paKey ? (allColOpts.find(([v]) => v === paKey)?.[1] || paStr) : 'Select time column…'}
                      placeholder="Select time column…"
                      options={allColOpts.slice(1)}
                      onChange={setPlayAxis} />
                    <div style={{ fontSize: 9, color: mutedColor, marginTop: 4 }}>The timeline the race steps through (e.g. Calendar › Month or › Year).</div>
                    {!paStr && (
                      <div style={{ fontSize: 9, color: '#F59E0B', marginTop: 4 }}>A bar race needs a play axis to animate.</div>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <RangeField label="Bars shown" value={cfg.limit ?? 8} min={2} max={20} step={1}
                        onChange={v => updateConfig('limit', v)} />
                    </div>
                    <div style={{ fontSize: 9, color: mutedColor, marginTop: 2 }}>Top N bars per frame (2–20). Fewer reads clearer while playing.</div>
                  </ElementPanel>
                )
              })()}

              {/* Drill-down hierarchy (charts only) — click a bar to drill a level deeper.
                  Stored as data.drill = [base, ...levels]; the engine groups by the
                  current depth and filters ancestors. Works in view/present, web export
                  and PBI (interaction-plays). */}
              {!isTable && !isKpi && visual.type !== 'bar_race' && data.groupBy?.table && data.groupBy?.column && (() => {
                const base = data.groupBy
                const full = Array.isArray(data.drill) ? data.drill.filter(d => d?.table && d?.column) : []
                const extras = full.length >= 1 ? full.slice(1) : []
                const writeDrill = (nextExtras) => {
                  if (!nextExtras.length) { updateData('drill', null); return }
                  setDataPatch({ drill: [base, ...nextExtras], groupBy: base })
                }
                const addLevel = (val) => {
                  if (!val) return
                  const sep = val.indexOf('|'); const table = val.slice(0, sep); const column = val.slice(sep + 1)
                  if (!table || !column) return
                  if (table === base.table && column === base.column) return
                  if (extras.some(d => d.table === table && d.column === column)) return
                  writeDrill([...extras, { table, column }])
                }
                const removeLevel = (idx) => writeDrill(extras.filter((_, i) => i !== idx))
                const rowBox = { flex: 1, padding: '4px 8px', background: 'var(--v-accent-quiet)', borderRadius: 4, border: '1px solid var(--v-accent-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                return (
                  <ElementPanel label="Drill-down (click to drill)" isDark={isDark}>
                    <div style={{ fontSize: 9, color: mutedColor, marginBottom: 6 }}>
                      Click a bar in view/present to drill. Ships to web export &amp; PBI.
                    </div>
                    <SelectField label="Drill style" value={cfg.drillStyle || 'expand'}
                      options={[
                        ['expand', 'Expand in place (split into children)'],
                        ['panel', 'Detail panel (drawer beside chart)'],
                        ['replace', 'Replace (drill to child level)'],
                        ['off', 'Off (click cross-filters instead)'],
                      ]}
                      onChange={v => updateConfig('drillStyle', v)} inputStyle={inputStyle} />
                    <div style={{ height: 6 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 10, color: baseColor }}>
                      <span style={{ opacity: 0.6, minWidth: 14 }}>1.</span>
                      <div style={rowBox}>{base.table} › {base.column} <span style={{ opacity: 0.5 }}>· base</span></div>
                    </div>
                    {extras.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 10, color: baseColor }}>
                        <span style={{ opacity: 0.6, minWidth: 14 }}>{i + 2}.</span>
                        <div style={rowBox}>{d.table} › {d.column}</div>
                        <button onClick={() => removeLevel(i)} title="Remove"
                          style={{ background: 'transparent', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                    <SearchableSelect placeholder="＋ Add drill level…" inputStyle={inputStyle} emptyText="No columns"
                      options={allColOpts.slice(1).filter(([v]) => {
                        const sep = v.indexOf('|'); const tbl = v.slice(0, sep), col = v.slice(sep + 1)
                        if (tbl === base.table && col === base.column) return false
                        return !extras.some(d => d.table === tbl && d.column === col)
                      })}
                      onChange={addLevel} />
                    {extras.length === 0 && (
                      <div style={{ fontSize: 9, color: mutedColor, marginTop: 4 }}>Add a level to enable click-to-drill.</div>
                    )}
                  </ElementPanel>
                )
              })()}

              {/* Query — charts only; a KPI is a single scalar value (no order/limit). */}
              {!isKpi && (
              <ElementPanel label="Query" isDark={isDark}>
                <SelectField label="Order" value={data.orderBy || 'desc'}
                  options={[['desc', 'Descending'], ['asc', 'Ascending (time)']]}
                  onChange={v => updateData('orderBy', v)} inputStyle={inputStyle} />
                <NumberField label="Row limit" value={data.limit ?? (isTable ? 100 : 10)} min={1} max={1000}
                  onChange={v => updateData('limit', Number(v))} inputStyle={inputStyle} />
              </ElementPanel>
              )}
            </>
          )
        })()}

        {/* STYLE TAB — grouped logically, inline config per feature */}
        {/* Nav button — web-style button config (no chart/card panels) */}
        {tab === 'style' && isNavButton && (
          <NavButtonPanel cfg={cfg} updateConfig={updateConfig} pages={pages}
            columnOptions={[['', 'Select a field…'], ...(modelCtx?.tables || []).flatMap(t => (t.columns || []).filter(c => !c.isHidden).map(c => [`${t.name}[${c.name}]`, `${t.name} › ${c.name}`]))]}
            isDark={isDark} baseColor={baseColor} inputStyle={inputStyle} />
        )}

        {/* Canvas objects — schema-only Style tab (no chart/card panels) */}
        {tab === 'style' && isObject && (
          <>
            {visual.type === 'text_box' && <TextFormatPanel isDark={isDark} mutedColor={mutedColor} />}
            <SchemaFields
              schema={VISUAL_MAP[visual.type]?.schema}
              type={visual.type}
              cfg={cfg}
              updateConfig={updateConfig}
              baseColor={baseColor}
              mutedColor={mutedColor}
              inputStyle={inputStyle}
              isDark={isDark}
              dateColumnOptions={dateColumnOptions}
            />
          </>
        )}

        {tab === 'style' && !isObject && !isNavButton && (
          <>
            {/* Playground Spike — per-section colours (custom visuals) */}
            {visual.type === 'custom' && (
              <SectionColorsEditor colors={cfg.sectionColors} onChange={cols => updateConfig('sectionColors', cols)} isDark={isDark} mutedColor={mutedColor} />
            )}

            {/* Per-category colours — categorical visuals (loads categories from the model) */}
            {CATEGORY_COLOR_TYPES.has(visual.type) && (
              <CategoryColorsEditor visual={visual} cfg={cfg} updateConfig={updateConfig} isDark={isDark} mutedColor={mutedColor} />
            )}
            {/* Playground Spike — generic chart toggles the template doesn't own.
                Legend lives here; grid lines / data labels / animations flow
                through the shared Chart Features panel (applyChrome honours them). */}
            {visual.type === 'custom' && (
              <ElementPanel label="Chart options" isDark={isDark}>
                <ToggleField label="Legend" value={cfg.showLegend !== false} onChange={v => updateConfig('showLegend', v)} baseColor={baseColor} />
                <div style={{ fontSize: 10, color: mutedColor, marginTop: 2 }}>
                  Grid lines, data labels &amp; animations are under Chart&nbsp;Features below.
                </div>
              </ElementPanel>
            )}
            {/* Appearance */}
            <ElementPanel label="Appearance" isDark={isDark}>
              <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4 }}>Color scheme</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                {COLOR_SCHEMES.map(c => (
                  <button key={c} onClick={() => updateConfig('colorScheme', c)}
                    style={{ width: 22, height: 22, borderRadius: 6, background: COLOR_HEX[c],
                      border: cfg.colorScheme === c ? '2px solid white' : '1px solid var(--v-border)',
                      cursor: 'pointer', boxShadow: cfg.colorScheme === c ? `0 0 0 2px ${COLOR_HEX[c]}80` : 'none' }} />
                ))}
                {/* Custom hex — sets colorScheme to a literal "#RRGGBB" string.
                    `pal()` in palettes.js detects hex literals and synthesizes a palette. */}
                <input type="color"
                  value={(typeof cfg.colorScheme === 'string' && cfg.colorScheme.startsWith('#')) ? cfg.colorScheme : '#000000'}
                  onChange={e => updateConfig('colorScheme', e.target.value)}
                  title="Custom color"
                  style={{
                    width: 22, height: 22, padding: 0, border: (typeof cfg.colorScheme === 'string' && cfg.colorScheme.startsWith('#')) ? '2px solid white' : '1px solid var(--v-border)',
                    borderRadius: 6, background: 'transparent', cursor: 'pointer',
                  }} />
              </div>
              <div style={{ ...fieldRowStyle(), marginBottom: 10 }}>
                <span style={fieldLabelStyle()}>Hex</span>
                <input type="text"
                  value={(typeof cfg.colorScheme === 'string' && cfg.colorScheme.startsWith('#')) ? cfg.colorScheme : ''}
                  placeholder="#RRGGBB"
                  onChange={e => {
                    const v = (e.target.value || '').trim()
                    if (!v) return                                          // empty → keep current scheme
                    if (/^#([0-9a-fA-F]{3}){1,2}$/.test(v)) updateConfig('colorScheme', v)
                  }}
                  style={inputStyle} />
              </div>

              {isKpi && <>
                <SelectField label="Card style" value={cfg.cardStyle || 'minimal'} options={[
                  ['minimal', 'Minimal (clean)'],
                  ['filled', 'Filled (solid color)'],
                  ['glass', 'Glass (frosted)'],
                  ['glossy', 'Glossy (shine)'],
                  ['accent', 'Accent (side bar)'],
                  ['bordered', 'Bordered only'],
                ]} onChange={v => updateConfig('cardStyle', v)} inputStyle={inputStyle} />
                <div style={{ ...fieldRowStyle(), marginBottom: 6 }}>
                  <span style={fieldLabelStyle()}>Bg opacity</span>
                  <input type="range" min="0" max="1" step="0.05" value={cfg.bgOpacity ?? 1}
                    onChange={e => updateConfig('bgOpacity', Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--v-accent)' }} />
                  <span style={{ fontSize: 10, color: mutedColor, width: 34, textAlign: 'right' }}>{cfg.bgOpacity == null ? 'Auto' : `${(cfg.bgOpacity * 100).toFixed(0)}%`}</span>
                  {cfg.bgOpacity != null && (
                    <button onClick={() => updateConfig('bgOpacity', null)} title="Reset to auto (theme fill)"
                      style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>↺</button>
                  )}
                </div>
              </>}

              <div style={{ ...fieldRowStyle(), marginBottom: 0, opacity: cfg.flat ? 0.4 : 1 }}>
                <span style={fieldLabelStyle()}>Radius</span>
                <input type="range" min="0" max="32" step="1" value={cfg.flat ? 0 : (cfg.borderRadius ?? 14)} disabled={cfg.flat}
                  onChange={e => updateConfig('borderRadius', Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--v-accent)' }} />
                <span style={{ fontSize: 10, color: mutedColor, width: 30, textAlign: 'right' }}>{cfg.flat ? 0 : (cfg.borderRadius ?? 14)}px</span>
              </div>
              <ToggleField label="Flat (no shadow / square)" value={!!cfg.flat} onChange={v => updateConfig('flat', v)} baseColor={baseColor} />
              <ToggleField label="Accent strip" value={cfg.showAccentStrip !== false} onChange={v => updateConfig('showAccentStrip', v)} baseColor={baseColor} />
            </ElementPanel>

            {/* KPI Features */}
            {isKpi && (
              <ElementPanel label="Features" isDark={isDark}>
                <ToggleField label="Trend indicator" value={!!cfg.showTrend} onChange={v => updateConfig('showTrend', v)} baseColor={baseColor} />
                <ToggleField label="Sparkline" value={!!cfg.showSparkline} onChange={v => updateConfig('showSparkline', v)} baseColor={baseColor} />
                {cfg.showSparkline && (
                  <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                    <SelectField label="Axis" value={cfg.sparklineAxis || ''} options={dateColumnOptions} onChange={v => updateConfig('sparklineAxis', v || null)} inputStyle={inputStyle} />
                    <SelectField label="Position" value={cfg.sparklinePosition || 'inline'} options={[['inline', 'Inline'], ['below', 'Below']]} onChange={v => updateConfig('sparklinePosition', v)} inputStyle={inputStyle} />
                    <ColorField label="Color" value={cfg.sparklineColor} placeholder="auto" onChange={v => updateConfig('sparklineColor', v)} inputStyle={inputStyle} />
                    <RangeField label="Line weight" value={cfg.sparklineWeight ?? 1.5} min={0.5} max={4} step={0.25} onChange={v => updateConfig('sparklineWeight', v)} mutedColor={mutedColor} />
                    <ToggleField label="Area fill" value={cfg.sparklineShowArea !== false} onChange={v => updateConfig('sparklineShowArea', v)} baseColor={baseColor} />
                  </div>
                )}
                <ToggleField label="Progress bar" value={!!cfg.showProgress} onChange={v => updateConfig('showProgress', v)} baseColor={baseColor} />
                {cfg.showProgress && (
                  <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B', marginBottom: 4, lineHeight: 1.35 }}>Target the bar fills toward. Leave empty for auto (80% fill).</div>
                    <NumberField label="Target value" value={cfg.progressMax ?? ''} min={0} step={1000} onChange={v => updateConfig('progressMax', v === '' || v == null ? null : Number(v))} inputStyle={inputStyle} placeholder="auto" />
                    <ColorField label="Fill" value={cfg.progressColor} placeholder="auto" onChange={v => updateConfig('progressColor', v)} inputStyle={inputStyle} />
                    <ColorField label="Track" value={cfg.progressTrackColor} placeholder="auto" onChange={v => updateConfig('progressTrackColor', v)} inputStyle={inputStyle} />
                    <NumberField label="Height" value={cfg.progressHeight ?? 4} min={2} max={20} onChange={v => updateConfig('progressHeight', v)} inputStyle={inputStyle} />
                  </div>
                )}
                <ToggleField label="Icon" value={!!cfg.showIcon} onChange={v => updateConfig('showIcon', v)} baseColor={baseColor} />
                {cfg.showIcon && (
                  <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                    <TextField label="Emoji" value={cfg.icon || '✦'} onChange={v => updateConfig('icon', v)} inputStyle={inputStyle} />
                    <NumberField label="Size" value={cfg.iconSize ?? 18} min={10} max={48} onChange={v => updateConfig('iconSize', v)} inputStyle={inputStyle} />
                    <ColorField label="Color" value={cfg.iconColor} placeholder="auto" onChange={v => updateConfig('iconColor', v)} inputStyle={inputStyle} />
                  </div>
                )}
                {cfg.showTrend && (
                  <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                    <ColorField label="Up color" value={cfg.trendUpColor} placeholder="#22C55E" onChange={v => updateConfig('trendUpColor', v)} inputStyle={inputStyle} />
                    <ColorField label="Down color" value={cfg.trendDownColor} placeholder="#F43F5E" onChange={v => updateConfig('trendDownColor', v)} inputStyle={inputStyle} />
                  </div>
                )}
                <ToggleField label="Glow effect" value={cfg.showGlow !== false} onChange={v => updateConfig('showGlow', v)} baseColor={baseColor} />
                <ToggleField label="Animations" value={cfg.animations !== false} onChange={v => updateConfig('animations', v)} baseColor={baseColor} />
                <ToggleField label="Compact mode" value={!!cfg.compact} onChange={v => updateConfig('compact', v)} baseColor={baseColor} />
                <ToggleField label="Title uppercase" value={!!cfg.titleUppercase} onChange={v => updateConfig('titleUppercase', v)} baseColor={baseColor} />
              </ElementPanel>
            )}

            {/* Table Options */}
            {visual.type === 'table' && (
              <ElementPanel label="Table Options" isDark={isDark}>
                <ToggleField label="Rank badges" value={cfg.rankColumn !== false} onChange={v => updateConfig('rankColumn', v)} baseColor={baseColor} />
                <ToggleField label="Mini-bars" value={cfg.miniBars !== false} onChange={v => updateConfig('miniBars', v)} baseColor={baseColor} />
                <ToggleField label="Heatmap cells" value={!!cfg.heatmap} onChange={v => updateConfig('heatmap', v)} baseColor={baseColor} />
              </ElementPanel>
            )}

            {/* Chart Features — bar/line-centric; bar_race drives everything from its own
                schema (Race/Appearance/Labels) so it opts out of this generic panel. */}
            {!isKpi && visual.type !== 'bar_race' && (
              <ElementPanel label="Chart Features" isDark={isDark}>
                <ToggleField label="Grid lines" value={cfg.gridLines !== undefined ? cfg.gridLines : fieldDefault(visual.type, 'gridLines', false)} onChange={v => updateConfig('gridLines', v)} baseColor={baseColor} />
                {cfg.gridLines && (
                  <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                    <ColorField label="Grid color" value={cfg.gridLinesColor} placeholder="auto" onChange={v => updateConfig('gridLinesColor', v)} inputStyle={inputStyle} />
                    <div style={{ ...fieldRowStyle(), marginBottom: 0 }}>
                      <span style={fieldLabelStyle()}>Opacity</span>
                      <input type="range" min="0" max="1" step="0.05" value={cfg.gridLinesOpacity ?? 0.15}
                        onChange={e => updateConfig('gridLinesOpacity', Number(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--v-accent)' }} />
                      <span style={{ fontSize: 10, color: mutedColor, width: 30, textAlign: 'right' }}>{Math.round((cfg.gridLinesOpacity ?? 0.15) * 100)}%</span>
                    </div>
                  </div>
                )}
                <ToggleField label="Animations" value={cfg.animations !== false} onChange={v => updateConfig('animations', v)} baseColor={baseColor} />
                <ToggleField label="Data labels" value={cfg.dataLabels !== undefined ? cfg.dataLabels : fieldDefault(visual.type, 'dataLabels', false)} onChange={v => updateConfig('dataLabels', v)} baseColor={baseColor} />
                {cfg.dataLabels && (
                  <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                    <SelectField label="Label position"
                      value={cfg.labelPosition || fieldDefault(visual.type, 'labelPosition', 'right')}
                      options={[
                        ['auto', 'Auto (smart placement)'],
                        ['right', 'Next to bar (right)'],
                        ['inside', 'Inside bar'],
                        ['top', 'Above bar'],
                      ]}
                      onChange={v => updateConfig('labelPosition', v)}
                      inputStyle={inputStyle} />
                    <ColorField label="Label color"
                      value={cfg.dataLabelColor === 'auto' ? '' : cfg.dataLabelColor}
                      placeholder="auto (white inside / text outside)"
                      onChange={v => updateConfig('dataLabelColor', v || 'auto')}
                      inputStyle={inputStyle} />
                  </div>
                )}
                <ToggleField label="Gradient fill" value={!!cfg.gradient} onChange={v => updateConfig('gradient', v)} baseColor={baseColor} />
                {(visual.type === 'bar' || visual.type === 'stacked_bar' || visual.type === 'grouped_bar' || visual.type === 'column') && <>
                  <ToggleField label="Rank fading" value={cfg.rankOpacity !== undefined ? cfg.rankOpacity : fieldDefault(visual.type, 'rankOpacity', true)} onChange={v => updateConfig('rankOpacity', v)} baseColor={baseColor} />
                  <ToggleField label="Highlight max bar" value={!!cfg.highlightMax} onChange={v => updateConfig('highlightMax', v)} baseColor={baseColor} />
                </>}
                {(visual.type === 'line' || visual.type === 'area') && <>
                  <ToggleField label="Smooth curves" value={cfg.smooth !== undefined ? cfg.smooth : fieldDefault(visual.type, 'smooth', false)} onChange={v => updateConfig('smooth', v)} baseColor={baseColor} />
                  <ToggleField label="Data dots" value={cfg.showDots !== false} onChange={v => updateConfig('showDots', v)} baseColor={baseColor} />
                </>}
                <AxisSwitcherEditor
                  axisOptions={cfg.axisOptions || []}
                  onChange={next => updateConfig('axisOptions', next.length ? next : null)}
                  columnOptions={categoryColumnOptions}
                  primaryAxis={visual.data?.groupBy?.table && visual.data?.groupBy?.column
                    ? { label: visual.data.groupBy.column, groupBy: visual.data.groupBy }
                    : null}
                  baseColor={baseColor}
                  mutedColor={mutedColor}
                  isDark={isDark}
                  inputStyle={inputStyle}
                />
              </ElementPanel>
            )}

            {/* Tooltip — per-visual hover control (applies on canvas, web export & PBI).
                Content controls (title/name/value/dot) apply to bar-family charts, which
                share the styled tooltip bubble; other charts honour show/hide + trigger. */}
            {!isKpi && (
              <ElementPanel label="Tooltip" isDark={isDark}>
                <ToggleField label="Show tooltip" value={cfg.tooltipEnabled !== false} onChange={v => updateConfig('tooltipEnabled', v)} baseColor={baseColor} />
                {cfg.tooltipEnabled !== false && (<>
                  <SelectField label="Trigger"
                    value={cfg.tooltipTrigger || 'auto'}
                    options={[
                      ['auto', 'Auto (recommended)'],
                      ['item', 'Hovered point only'],
                      ['axis', 'All series at position'],
                    ]}
                    onChange={v => updateConfig('tooltipTrigger', v)}
                    inputStyle={inputStyle} />
                  {['bar', 'column', 'stacked_bar', 'grouped_bar'].includes(visual.type) && (
                    <div style={{ marginLeft: 18, marginBottom: 6, padding: '6px 8px', background: 'var(--v-accent-quiet)', borderLeft: '2px solid var(--v-accent)', borderRadius: 4 }}>
                      <div style={{ fontSize: 9, color: mutedColor, marginBottom: 4, lineHeight: 1.35 }}>What appears in the tooltip</div>
                      <ToggleField label="Category title" value={cfg.tooltipShowTitle !== false} onChange={v => updateConfig('tooltipShowTitle', v)} baseColor={baseColor} />
                      <TextField label="Custom title" value={cfg.tooltipTitle || ''} onChange={v => updateConfig('tooltipTitle', v || '')} inputStyle={inputStyle} />
                      <ToggleField label="Series name" value={cfg.tooltipShowName !== false} onChange={v => updateConfig('tooltipShowName', v)} baseColor={baseColor} />
                      <ToggleField label="Value" value={cfg.tooltipShowValue !== false} onChange={v => updateConfig('tooltipShowValue', v)} baseColor={baseColor} />
                      <ToggleField label="Colour dot" value={cfg.tooltipShowSwatch !== false} onChange={v => updateConfig('tooltipShowSwatch', v)} baseColor={baseColor} />
                    </div>
                  )}
                </>)}
              </ElementPanel>
            )}

            {/* Schema-driven fields (Phase 4.4) — reads VISUAL_MAP[type].schema
                and renders one control per field, writing straight to visual.config.
                Hardcoded fields above take precedence; see HARDCODED_KEYS.  */}
            {!isKpi && (
              <SchemaFields
                schema={visual.type === 'custom' ? paramsToSchema(customTemplate) : VISUAL_MAP[visual.type]?.schema}
                type={visual.type}
                cfg={cfg}
                updateConfig={updateConfig}
                baseColor={baseColor}
                mutedColor={mutedColor}
                inputStyle={inputStyle}
                isDark={isDark}
                dateColumnOptions={dateColumnOptions}
              />
            )}
          </>
        )}

        {/* TEXT TAB — every element's color, font, size */}
        {tab === 'text' && (
          <>
            {/* ─── TITLE ─── */}
            <ElementPanel label="Title" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
              <ToggleField label="Show title" value={cfg.showTitle !== false} onChange={v => updateConfig('showTitle', v)} baseColor={baseColor} />
              <TextField label="Text" value={cfg.title || ''} onChange={v => updateConfig('title', v)} inputStyle={inputStyle} />
              <FontField label="Font" value={cfg.titleFontFamily} onChange={v => updateConfig('titleFontFamily', v)} fonts={FONTS} inputStyle={inputStyle} />
              <NumberField label="Size" value={cfg.titleFontSize ?? 11} min={8} max={32} onChange={v => updateConfig('titleFontSize', v)} inputStyle={inputStyle} />
              <NumberField label="Weight" value={cfg.titleFontWeight ?? 500} min={100} max={900} step={100} onChange={v => updateConfig('titleFontWeight', v)} inputStyle={inputStyle} />
              <ColorField label="Color" value={cfg.titleColor} placeholder={resolved.titleColor} onChange={v => updateConfig('titleColor', v)} inputStyle={inputStyle} />
              <SelectField label="Position" value={cfg.titlePosition || 'below'} options={[['above','Above'],['below','Below']]} onChange={v => updateConfig('titlePosition', v)} inputStyle={inputStyle} />
              <SelectField label="Align" value={cfg.align || 'center'} options={[['left','Left'],['center','Center'],['right','Right']]} onChange={v => updateConfig('align', v)} inputStyle={inputStyle} />
              <ToggleField label="Uppercase" value={!!cfg.titleUppercase} onChange={v => updateConfig('titleUppercase', v)} baseColor={baseColor} />
            </ElementPanel>

            {/* ─── VALUE (KPI) ─── */}
            {isKpi && (
              <ElementPanel label="Value" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <FontField label="Font" value={cfg.valueFontFamily} onChange={v => updateConfig('valueFontFamily', v)} fonts={FONTS} inputStyle={inputStyle} />
                <NumberField label="Size" value={typeof cfg.valueFontSize === 'number' ? cfg.valueFontSize : 32} min={14} max={96} onChange={v => updateConfig('valueFontSize', v)} inputStyle={inputStyle} />
                <NumberField label="Weight" value={cfg.valueFontWeight ?? 800} min={100} max={900} step={100} onChange={v => updateConfig('valueFontWeight', v)} inputStyle={inputStyle} />
                <ColorField label="Color" value={cfg.valueColor} placeholder={resolved.valueColor} onChange={v => updateConfig('valueColor', v)} inputStyle={inputStyle} />
                <TextField label="Prefix" value={cfg.prefix || ''} onChange={v => updateConfig('prefix', v || null)} placeholder="$" inputStyle={inputStyle} />
                <TextField label="Suffix" value={cfg.suffix || ''} onChange={v => updateConfig('suffix', v || null)} placeholder="%" inputStyle={inputStyle} />
                <TextField label="Subtitle" value={cfg.subtitle || ''} onChange={v => updateConfig('subtitle', v || null)} inputStyle={inputStyle} />
              </ElementPanel>
            )}

            {/* ─── CARD HEADER (charts only) ─── */}
            {!isKpi && (
              <ElementPanel label="Card Header" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <ColorField label="Accent" value={cfg.accentColor} placeholder="auto" onChange={v => updateConfig('accentColor', v)} inputStyle={inputStyle} />
                <ColorField label="Bg" value={cfg.headerBg} placeholder="auto" onChange={v => updateConfig('headerBg', v)} inputStyle={inputStyle} />
              </ElementPanel>
            )}

            {/* ─── TREND INDICATOR ─── */}
            {cfg.showTrend && (
              <ElementPanel label="Trend Indicator" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <ColorField label="Positive" value={cfg.trendUpColor} placeholder="#22C55E" onChange={v => updateConfig('trendUpColor', v)} inputStyle={inputStyle} />
                <ColorField label="Negative" value={cfg.trendDownColor} placeholder="#F43F5E" onChange={v => updateConfig('trendDownColor', v)} inputStyle={inputStyle} />
                <NumberField label="Size" value={cfg.trendFontSize ?? 11} min={8} max={20} onChange={v => updateConfig('trendFontSize', v)} inputStyle={inputStyle} />
              </ElementPanel>
            )}

            {/* ─── SPARKLINE ─── */}
            {cfg.showSparkline && (
              <ElementPanel label="Sparkline" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <SelectField label="Position" value={cfg.sparklinePosition || 'inline'} options={[['inline','Inline (next to value)'],['below','Below value']]} onChange={v => updateConfig('sparklinePosition', v)} inputStyle={inputStyle} />
                <SelectField label="Axis" value={cfg.sparklineAxis || ''} options={dateColumnOptions} onChange={v => updateConfig('sparklineAxis', v || null)} inputStyle={inputStyle} />
                <ColorField label="Color" value={cfg.sparklineColor} placeholder="auto" onChange={v => updateConfig('sparklineColor', v)} inputStyle={inputStyle} />
                <NumberField label="Width" value={cfg.sparklineWidth ?? 60} min={30} max={300} onChange={v => updateConfig('sparklineWidth', v)} inputStyle={inputStyle} />
                <NumberField label="Height" value={cfg.sparklineHeight ?? 20} min={10} max={60} onChange={v => updateConfig('sparklineHeight', v)} inputStyle={inputStyle} />
                <ToggleField label="Area fill" value={cfg.sparklineShowArea !== false} onChange={v => updateConfig('sparklineShowArea', v)} baseColor={baseColor} />
              </ElementPanel>
            )}

            {/* ─── PROGRESS BAR ─── */}
            {cfg.showProgress && (
              <ElementPanel label="Progress Bar" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <NumberField label="Max" value={cfg.progressMax ?? 100} min={0} step={1} onChange={v => updateConfig('progressMax', v)} inputStyle={inputStyle} />
                <ColorField label="Fill" value={cfg.progressColor} placeholder="auto" onChange={v => updateConfig('progressColor', v)} inputStyle={inputStyle} />
                <ColorField label="Track" value={cfg.progressTrackColor} placeholder="auto" onChange={v => updateConfig('progressTrackColor', v)} inputStyle={inputStyle} />
                <NumberField label="Height" value={cfg.progressHeight ?? 4} min={2} max={20} onChange={v => updateConfig('progressHeight', v)} inputStyle={inputStyle} />
              </ElementPanel>
            )}

            {/* ─── ICON ─── */}
            {cfg.showIcon && (
              <ElementPanel label="Icon" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <TextField label="Emoji" value={cfg.icon || '✦'} onChange={v => updateConfig('icon', v)} inputStyle={inputStyle} />
                <NumberField label="Size" value={cfg.iconSize ?? 18} min={10} max={48} onChange={v => updateConfig('iconSize', v)} inputStyle={inputStyle} />
                <ColorField label="Color" value={cfg.iconColor} placeholder="auto" onChange={v => updateConfig('iconColor', v)} inputStyle={inputStyle} />
              </ElementPanel>
            )}

            {/* ─── AXIS (charts) ─── */}
            {!isKpi && (
              <ElementPanel label="Axis & Labels" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <ColorField label="Axis Color" value={cfg.axisTickColor} placeholder="auto" onChange={v => updateConfig('axisTickColor', v)} inputStyle={inputStyle} />
                <NumberField label="Axis Size" value={cfg.axisFontSize ?? 10} min={6} max={20} onChange={v => updateConfig('axisFontSize', v)} inputStyle={inputStyle} />
                <FontField label="Axis Font" value={cfg.axisFontFamily} onChange={v => updateConfig('axisFontFamily', v)} fonts={FONTS} inputStyle={inputStyle} />
                <ColorField label="Label Color" value={cfg.labelColor} placeholder="auto" onChange={v => updateConfig('labelColor', v)} inputStyle={inputStyle} />
                {/* Grid color + opacity moved to the Grid lines toggle in Chart Features (STYLE tab). */}
              </ElementPanel>
            )}

            {/* ─── LEGEND — only visuals that actually render one (pie/donut show
                categories; grouped/stacked show the two measures). Single-series bars,
                lines, etc. have no legend, so the panel is hidden for them. ─── */}
            {['pie', 'donut', 'grouped_bar', 'stacked_bar'].includes(visual.type) && (
              <ElementPanel label="Legend" baseColor={baseColor} mutedColor={mutedColor} labelColor={labelColor} isDark={isDark}>
                <ToggleField label="Show legend" value={cfg.showLegend !== false} onChange={v => updateConfig('showLegend', v)} baseColor={baseColor} />
                <SelectField label="Position" value={cfg.legendPosition || (visual.type === 'pie' || visual.type === 'donut' ? 'right' : 'top')} options={[['top','Top'],['right','Right'],['bottom','Bottom']]} onChange={v => updateConfig('legendPosition', v)} inputStyle={inputStyle} />
                <ColorField label="Text Color" value={cfg.legendColor} placeholder="auto" onChange={v => updateConfig('legendColor', v)} inputStyle={inputStyle} />
                <NumberField label="Text Size" value={cfg.legendFontSize ?? 11} min={8} max={20} onChange={v => updateConfig('legendFontSize', v)} inputStyle={inputStyle} />
              </ElementPanel>
            )}
          </>
        )}

        {/* LAYOUT TAB */}
        {tab === 'layout' && (
          <>
            <div style={sectionLabel}>Position & Size</div>
            {[
              { label: 'X', key: 'x', min: 0, max: 12, step: 0.1 },
              { label: 'Y', key: 'y', min: 0, max: 50, step: 0.1 },
              { label: 'W', key: 'w', min: 1, max: 12, step: 0.1 },
              { label: 'H', key: 'h', min: 1, max: 20, step: 0.1 },
            ].map(({ label, key, min, max, step }) => {
              const val = pos[key] ?? 0
              return (
                <div key={key} style={fieldRow}>
                  <span style={{ ...fieldLabel, width: 20 }}>{label}</span>
                  <input type="range" min={min} max={max} step={step} value={val}
                    onChange={e => updatePos(key, Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--v-accent)' }} />
                  <input type="number" min={min} max={max} step={step} value={val}
                    onChange={e => updatePos(key, Number(e.target.value) || 0)}
                    style={{ ...inputStyle, width: 50, flex: '0 0 50px' }} />
                </div>
              )
            })}

            <div style={{ ...sectionLabel, marginTop: 12 }}>Animation</div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Entrance</span>
              <select value={cfg.animationPreset || 'none'} onChange={e => updateConfig('animationPreset', e.target.value === 'none' ? null : e.target.value)} style={inputStyle}>
                <option value="none">None</option>
                <option value="fadeUp">Fade up</option>
                <option value="fadeIn">Fade in</option>
                <option value="scaleIn">Scale in</option>
              </select>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Speed</span>
              <select value={cfg.animationDuration || 'medium'} onChange={e => updateConfig('animationDuration', e.target.value)} style={inputStyle}>
                <option value="fast">Fast</option>
                <option value="medium">Medium</option>
                <option value="slow">Slow</option>
              </select>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>Hover</span>
              <select value={cfg.hoverEffect || 'none'} onChange={e => updateConfig('hoverEffect', e.target.value === 'none' ? null : e.target.value)} style={inputStyle}>
                <option value="none">None</option>
                <option value="lift">Lift (scale + shadow)</option>
              </select>
            </div>
          </>
        )}

        {/* AI TAB */}
        {tab === 'ai' && (
          <>
            <div style={{ fontSize: 11, color: mutedColor, marginBottom: 10, lineHeight: 1.5 }}>
              Describe what you want to change. Use <code style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: isDark ? 'var(--v-border)' : 'rgba(0,0,0,0.05)' }}>/m</code> for measures, <code style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: isDark ? 'var(--v-border)' : 'rgba(0,0,0,0.05)' }}>/d</code> for dimensions.
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={aiTextareaRef}
                value={aiPrompt}
                onChange={e => { setAiPrompt(e.target.value); openSlashMenu(e.target.value, e.target.selectionStart) }}
                onKeyUp={e => openSlashMenu(e.currentTarget.value, e.currentTarget.selectionStart)}
                onBlur={() => setTimeout(() => setSlashMenu(null), 150)}
                placeholder="e.g. set sparkline axis to /d, change /m color to blue, show trend"
                rows={3}
                style={{ ...inputStyle, width: '100%', resize: 'vertical', padding: 8, fontFamily: 'inherit' }}
                onKeyDown={e => {
                  if (slashMenu) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSlashMenu(p => ({ ...p, selectedIdx: Math.min(p.selectedIdx + 1, p.items.length - 1) })); return }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashMenu(p => ({ ...p, selectedIdx: Math.max(p.selectedIdx - 1, 0) })); return }
                    if (e.key === 'Escape')    { e.preventDefault(); setSlashMenu(null); return }
                    if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertSlashItem(slashMenu.items[slashMenu.selectedIdx]); return }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAi() }
                }}
              />
              {slashMenu && slashMenu.items.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
                  background: isDark ? '#1E293B' : '#FFFFFF',
                  border: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0',
                  borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  overflow: 'hidden', zIndex: 100,
                }}>
                  <div style={{ padding: '4px 8px', fontSize: 9, color: mutedColor, borderBottom: isDark ? '1px solid var(--v-border)' : '1px solid #F1F5F9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {slashMenu.type === 'm' ? 'Measures' : 'Dimensions'} · Tab to insert
                  </div>
                  {slashMenu.items.map((item, idx) => (
                    <div key={item.label}
                      onMouseDown={(e) => { e.preventDefault(); insertSlashItem(item) }}
                      style={{
                        padding: '5px 10px', fontSize: 10, cursor: 'pointer',
                        background: idx === slashMenu.selectedIdx ? (isDark ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)') : 'transparent',
                        color: baseColor, fontFamily: 'inherit',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleAi} disabled={aiLoading || !aiPrompt.trim()}
              style={{
                width: '100%', marginTop: 6,
                background: aiLoading || !aiPrompt.trim() ? 'var(--v-accent-quiet)' : 'var(--v-accent-quiet)',
                border: '1px solid var(--v-accent-border)', color: 'var(--v-accent)',
                borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600,
                cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              {aiLoading ? 'Applying…' : '✨ Apply Changes'}
            </button>

            <div style={{ ...sectionLabel, marginTop: 14 }}>Suggestions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setAiPrompt(s)}
                  style={{
                    textAlign: 'left', padding: '6px 10px', fontSize: 10, cursor: 'pointer',
                    background: isDark ? 'var(--v-bg-1)' : 'rgba(0,0,0,0.02)',
                    border: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0',
                    borderRadius: 5, color: baseColor, fontFamily: 'inherit',
                    lineHeight: 1.4,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions footer */}
      <div style={{ padding: '10px 12px', borderTop: isDark ? '1px solid var(--v-border)' : '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={handleExport} disabled={exportState === 'busy'} title="Export this visual as a Power BI custom visual (.pbiviz)"
          style={{ width: '100%', background: 'var(--v-accent)', border: 'none', color: '#04121a', borderRadius: 6, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: exportState === 'busy' ? 'default' : 'pointer', fontFamily: 'inherit', opacity: exportState === 'busy' ? 0.6 : 1 }}>
          {exportState === 'busy' ? 'Exporting…' : '⬇ Export to Power BI'}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onDuplicate}
            style={{ flex: 1, background: 'var(--v-accent-quiet)', border: '1px solid var(--v-accent-border)', color: 'var(--v-accent)', borderRadius: 6, padding: '6px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Duplicate
          </button>
          <button onClick={onDelete}
            style={{ flex: 1, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#FCA5A5', borderRadius: 6, padding: '6px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Delete
          </button>
        </div>
      </div>

      {exportState && typeof exportState === 'object' && createPortal(
        <div onClick={() => setExportState(null)} style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', background: isDark ? 'var(--v-surface)' : '#ffffff', color: isDark ? 'var(--v-text)' : '#111827', border: '1px solid var(--v-border)', borderRadius: 10, padding: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.45)', fontFamily: 'inherit' }}>
            {exportState.error ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Export failed</div>
                <div style={{ fontSize: 12, color: 'var(--v-amber)' }}>⚠ {exportState.error}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Exported for Power BI ✓</div>
                <div style={{ fontSize: 11, color: 'var(--v-text-muted)', marginBottom: 12, wordBreak: 'break-all' }}>Saved: {exportState.path}</div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--v-text-2)', marginBottom: 6 }}>Bind these fields in Power BI</div>
                <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 6 }}>
                  {(exportState.guide?.wells || []).map((w, i) => (<div key={'w' + i}><b>{w.well}</b> → <code style={{ color: 'var(--v-accent)' }}>{w.field}</code></div>))}
                  {!(exportState.guide?.wells?.length) && (<div style={{ color: 'var(--v-text-muted)' }}>Bind a measure to Content + a column to Category.</div>)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--v-text-muted)', marginBottom: 14 }}>Leave the other wells empty. No HTML measure needed — the visual queries the model from these fields.</div>
                <button onClick={() => setExportStepsOpen((o) => !o)} style={{ background: 'transparent', border: 'none', color: 'var(--v-accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
                  {exportStepsOpen ? '▾ Hide steps' : '▸ How to add it in Power BI'}
                </button>
                {exportStepsOpen && (
                  <div style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--v-text-2)', marginTop: 8 }}>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>Into one report</div>
                    <div>1. Visualizations pane → ⋯ (Get more visuals) → “Import a visual from a file”.</div>
                    <div>2. Pick the saved .pbiviz, then click its icon to add it to the page.</div>
                    <div>3. Drag the fields listed above into its wells.</div>
                    <div style={{ fontWeight: 700, marginTop: 10 }}>Org-wide (admin)</div>
                    <div>1. Power BI Admin portal → Organizational visuals → Add.</div>
                    <div>2. Upload the .pbiviz — everyone can then add it from the visual pane + bind fields.</div>
                  </div>
                )}
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setExportState(null)} style={{ background: 'var(--v-accent-quiet)', border: '1px solid var(--v-accent-border)', color: 'var(--v-accent)', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
