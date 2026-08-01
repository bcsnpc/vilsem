import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, ChevronRight, Table2, Sigma, Columns3, Layers as LayersIcon, Database, Calendar, Hash, Type, Copy, Check } from 'lucide-react'
import { useCanvasStore } from './canvasStore.js'
import { useDataPreview } from './dataPreviewStore.js'
import { getCurrentPage } from '../appspec/specEditing.js'

// Left-rail flyout panels — Fields (semantic model explorer), Layers (visuals on
// the active page), Data (dataset stats). Fields/Data read the live model
// context; Layers reads the canvas store the AppGenerator publishes to.
export default function PanelFlyout({ panel, connection, onClose }) {
  const title = { fields: 'Fields', layers: 'Layers', data: 'Data' }[panel] || ''
  return (
    <div style={{
      width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--v-bg-1)', borderRight: '1px solid var(--v-border)',
    }}>
      <div style={{ height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 14px', borderBottom: '1px solid var(--v-border)' }}>
        <span style={{ font: '600 11px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-2)', flex: 1 }}>{title}</span>
        <button onClick={onClose} title="Close" style={iconBtn}><X size={15} /></button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {panel === 'fields' && <FieldsPanel />}
        {panel === 'layers' && <LayersPanel />}
        {panel === 'data'   && <DataPanel connection={connection} />}
      </div>
    </div>
  )
}

// ── Fields: semantic model explorer ─────────────────────────────────────────
export function FieldsPanel() {
  const [ctx, setCtx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  useEffect(() => {
    let live = true
    window.semantica?.getModelContext?.().then((c) => { if (live) { setCtx(c); setLoading(false) } }).catch(() => setLoading(false))
    return () => { live = false }
  }, [])

  const tables = ctx?.tables || []
  const measures = ctx?.measures || []
  const query = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!query) return tables
    return tables
      .map(t => {
        const cols = (t.columns || []).filter(c => (c.name || '').toLowerCase().includes(query))
        const hit = (t.name || '').toLowerCase().includes(query)
        return (hit || cols.length) ? { ...t, columns: hit ? t.columns : cols } : null
      })
      .filter(Boolean)
  }, [tables, query])
  // Measures live at the top level of the model context, not inside a table —
  // surface them as their own draggable group so they actually show up.
  const filteredMeasures = query ? measures.filter(m => (m.name || '').toLowerCase().includes(query)) : measures
  const measuresOpen = query ? true : (open.__measures ?? true)

  if (loading) return <Hint>Loading model…</Hint>
  if (!tables.length && !measures.length) return <Hint>No model connected. Open a project or connect a dataset.</Hint>

  return (
    <div style={{ padding: 8 }}>
      <SearchBox value={q} onChange={setQ} placeholder="Search measures, tables & columns…" />

      {/* Measures */}
      {filteredMeasures.length > 0 && (
        <div style={{ marginBottom: 3 }}>
          <button onClick={() => setOpen(o => ({ ...o, __measures: !(o.__measures ?? true) }))} style={rowBtn}>
            <ChevronRight size={13} style={{ color: 'var(--v-text-faint)', transform: measuresOpen ? 'rotate(90deg)' : 'none', transition: 'transform .1s', flexShrink: 0 }} />
            <Sigma size={13} style={{ color: 'var(--v-accent)', flexShrink: 0 }} />
            <span style={{ font: '600 12px var(--v-font)', color: 'var(--v-text)' }}>Measures</span>
            <span style={{ marginLeft: 'auto', font: '400 10px var(--v-mono)', color: 'var(--v-text-faint)', flexShrink: 0 }}>{filteredMeasures.length}</span>
          </button>
          {measuresOpen && filteredMeasures.map((m) => {
            const s = JSON.stringify({ kind: 'measure', name: m.name })
            return (
              <div key={m.name} draggable
                onDragStart={(e) => { e.dataTransfer.setData('application/x-vilsem-field', s); e.dataTransfer.setData('text/plain', s); e.dataTransfer.effectAllowed = 'copy' }}
                style={{ ...fieldRow, cursor: 'grab' }} title={`Drag onto the canvas — measure [${m.name}]`}>
                <Sigma size={12} style={{ color: 'var(--v-accent)', flexShrink: 0 }} />
                <span style={{ font: '400 12px var(--v-font)', color: 'var(--v-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              </div>
            )
          })}
        </div>
      )}

      {filtered.map((t) => {
        const isOpen = query ? true : !!open[t.name]
        const cols = (t.columns || []).filter(c => !c.isHidden)
        const measureGroup = t.tableType === 'measure_group'
        return (
          <div key={t.name} style={{ marginBottom: 1 }}>
            <button onClick={() => setOpen(o => ({ ...o, [t.name]: !o[t.name] }))} style={rowBtn}>
              <ChevronRight size={13} style={{ color: 'var(--v-text-faint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .1s', flexShrink: 0 }} />
              {measureGroup ? <Sigma size={13} style={{ color: 'var(--v-accent)', flexShrink: 0 }} /> : <Table2 size={13} style={{ color: 'var(--v-text-muted)', flexShrink: 0 }} />}
              <span style={{ font: '500 12px var(--v-font)', color: 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              <span style={{ marginLeft: 'auto', font: '400 10px var(--v-mono)', color: 'var(--v-text-faint)', flexShrink: 0 }}>{cols.length}</span>
            </button>
            {isOpen && cols.map((c) => {
              const dt = (c.dataType || '').toLowerCase()
              const Icon = c.isDate || dt.includes('date') ? Calendar : (dt.includes('int') || dt.includes('num') || dt.includes('deci') || dt.includes('double')) ? Hash : Type
              const payload = measureGroup ? { kind: 'measure', name: c.name } : { kind: 'column', table: t.name, column: c.name }
              return (
                <div key={c.name} draggable
                  onDragStart={(e) => { const s = JSON.stringify(payload); e.dataTransfer.setData('application/x-vilsem-field', s); e.dataTransfer.setData('text/plain', s); e.dataTransfer.effectAllowed = 'copy' }}
                  style={{ ...fieldRow, cursor: 'grab' }}
                  title={`Drag onto a visual — ${measureGroup ? 'measure' : 'column'} · ${t.name}[${c.name}]`}>
                  <Icon size={12} style={{ color: measureGroup ? 'var(--v-accent)' : 'var(--v-text-faint)', flexShrink: 0 }} />
                  <span style={{ font: '400 12px var(--v-font)', color: 'var(--v-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Layers: visuals on the active page ──────────────────────────────────────
function LayersPanel() {
  const { spec, currentPageId, selectedId, onSelect } = useCanvasStore()
  const page = spec ? getCurrentPage(spec, currentPageId) : null
  const visuals = page?.visuals || []
  const slicers = page?.slicers || []
  if (!spec) return <Hint>Open a project to see its layers.</Hint>
  if (!visuals.length && !slicers.length) return <Hint>No visuals yet. Generate or add one on the canvas.</Hint>
  const Row = (v, isSlicer) => (
    <button key={v.id} onClick={() => onSelect?.(v.id)} style={{ ...rowBtn, background: selectedId === v.id ? 'var(--v-accent-quiet)' : 'transparent' }}>
      <LayersIcon size={13} style={{ color: selectedId === v.id ? 'var(--v-accent)' : 'var(--v-text-muted)', flexShrink: 0 }} />
      <span style={{ font: '500 12px var(--v-font)', color: selectedId === v.id ? 'var(--v-accent)' : 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {v.config?.title || v.dimension?.column || v.type || (isSlicer ? 'slicer' : 'visual')}
      </span>
      <span style={{ marginLeft: 'auto', font: '400 9px var(--v-mono)', color: 'var(--v-text-faint)', textTransform: 'uppercase', flexShrink: 0 }}>{isSlicer ? 'slicer' : v.type}</span>
    </button>
  )
  return (
    <div style={{ padding: 8 }}>
      {visuals.map(v => Row(v, false))}
      {slicers.map(s => Row(s, true))}
    </div>
  )
}

// ── Data: live preview of the selected visual (DAX + rows + timing), or dataset
//    stats when nothing is selected. Reads already-fetched data from the preview
//    store — never issues its own query. ─────────────────────────────────────
function DataPanel({ connection }) {
  const { spec, currentPageId, selectedId } = useCanvasStore()
  const preview = useDataPreview(selectedId)
  const page = spec ? getCurrentPage(spec, currentPageId) : null
  const selectedVisual = selectedId && page ? (page.visuals || []).find(v => v.id === selectedId) : null

  if (selectedVisual) return <VisualDataPreview visual={selectedVisual} preview={preview} />
  return <DatasetStats connection={connection} />
}

function DatasetStats({ connection }) {
  const [ctx, setCtx] = useState(null)
  useEffect(() => { window.semantica?.getModelContext?.().then(setCtx).catch(() => {}) }, [])
  const tables = ctx?.tables?.length || 0
  const measures = ctx?.measures?.length || 0
  const rels = ctx?.relationships?.length || 0
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 'var(--v-r)', background: 'var(--v-accent-quiet)', color: 'var(--v-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Database size={16} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '600 12px var(--v-font)', color: 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connection?.label || 'Dataset'}</div>
          <div style={{ font: '400 10px var(--v-mono)', color: 'var(--v-text-faint)' }}>semantic model</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
        <Stat n={tables} label="Tables" />
        <Stat n={measures} label="Measures" />
        <Stat n={rels} label="Relations" />
      </div>
      <div style={{ padding: 12, border: '1px dashed var(--v-border)', borderRadius: 'var(--v-r-2)', font: '400 11px var(--v-font)', color: 'var(--v-text-muted)', lineHeight: 1.5 }}>
        Select a visual on the canvas to see the <span style={{ color: 'var(--v-text-2)' }}>resolved query</span> and the data it returns.
      </div>
    </div>
  )
}

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') {
    const abs = Math.abs(v)
    if (abs >= 1000) return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
    return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(v)
  }
  return String(v)
}

function VisualDataPreview({ visual, preview }) {
  const type = String(visual.type || '').toUpperCase()
  const measures = visual.data?.measures || []
  const axis = (visual.data?.dimensions?.length)
    ? visual.data.dimensions.map(d => `${d.table}[${d.column}]`).join(', ')
    : (visual.data?.groupBy?.table ? `${visual.data.groupBy.table}[${visual.data.groupBy.column}]` : null)
  const title = visual.config?.title || visual.type
  const grouped = !!(preview?.groupBy || preview?.dimensions)

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Selected header */}
      <div>
        <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-accent)', marginBottom: 4 }}>Selected · {type}</div>
        <div style={{ font: '600 13px var(--v-font)', color: 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ font: '400 11px var(--v-mono)', color: 'var(--v-text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {measures.length ? <><span style={{ color: 'var(--v-accent)' }}>ƒx</span> {measures.join(' · ')}</> : 'No measure bound'}{axis ? ` · ${axis}` : ''}
        </div>
      </div>

      {!measures.length && <Hint>Bind a measure in the inspector’s <b>Data</b> tab to preview the query and data.</Hint>}
      {measures.length > 0 && !preview && <Hint>Running query…</Hint>}
      {preview?.error && (
        <div style={{ padding: '8px 10px', background: 'var(--v-amber-quiet, rgba(217,160,60,0.12))', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', font: '400 11px var(--v-font)', color: 'var(--v-amber)' }}>{preview.error}</div>
      )}

      {preview && !preview.error && (
        <>
          <PreviewTable snap={preview} />
          <div style={{ font: '400 10px var(--v-mono)', color: 'var(--v-text-faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {preview.rowCount} {grouped ? 'groups' : 'rows'} · {preview.elapsedMs} ms
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ font: '600 10px var(--v-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--v-text-2)', flex: 1 }}>Resolved query</span>
              <CopyButton text={preview.dax} />
            </div>
            <pre style={{ margin: 0, padding: 10, background: 'var(--v-bg-0)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', font: '400 10.5px/1.5 var(--v-mono)', color: 'var(--v-text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto' }}>{preview.dax}</pre>
          </div>
        </>
      )}
    </div>
  )
}

function PreviewTable({ snap }) {
  const rows = snap.rows || []
  if (!rows.length) return <Hint>Query returned no rows.</Hint>
  const measures = snap.measures || []
  const isScalar = !snap.groupBy && !(snap.dimensions?.length)

  if (isScalar) {
    const r = rows[0] || {}
    const pairs = measures.map((m, i) => [m, i === 0 ? r._val : r._val2])
    return (
      <table style={tableStyle}>
        <tbody>
          {pairs.map(([m, v], i) => (
            <tr key={i}>
              <td style={tdKey}>{m}</td>
              <td style={tdValNum}>{fmtVal(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const catLabels = snap.dimensions?.length ? snap.dimensions.map(d => d.column) : [snap.groupBy?.column || 'Category']
  const cols = [...catLabels, ...measures]
  const body = rows.slice(0, 8).map(r => {
    const cats = (r._cats && r._cats.length) ? r._cats : [r._cat]
    const vals = (r._vals && r._vals.length) ? r._vals : [r._val, r._val2, r._val3]
    return [...cats.slice(0, catLabels.length), ...vals.slice(0, measures.length)]
  })
  return (
    <table style={tableStyle}>
      <thead>
        <tr>{cols.map((c, i) => <th key={i} style={{ ...thStyle, textAlign: i >= catLabels.length ? 'right' : 'left' }}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((cells, ri) => (
          <tr key={ri}>{cells.map((c, ci) => <td key={ci} style={ci >= catLabels.length ? tdValNum : tdKey}>{fmtVal(c)}</td>)}</tr>
        ))}
        {rows.length > 8 && (
          <tr><td colSpan={cols.length} style={{ ...tdKey, color: 'var(--v-text-faint)', textAlign: 'center' }}>+{rows.length - 8} more</td></tr>
        )}
      </tbody>
    </table>
  )
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { try { navigator.clipboard?.writeText(text || '') ; setDone(true); setTimeout(() => setDone(false), 1200) } catch { /* noop */ } }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--v-border)', background: 'transparent', color: done ? 'var(--v-accent)' : 'var(--v-text-muted)', borderRadius: 'var(--v-r)', padding: '3px 7px', font: '500 10px var(--v-mono)', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
      {done ? <Check size={11} /> : <Copy size={11} />}{done ? 'Copied' : 'Copy'}
    </button>
  )
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }
const thStyle = { font: '600 9px var(--v-mono)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--v-text-faint)', padding: '4px 6px', borderBottom: '1px solid var(--v-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const tdKey = { font: '400 11px var(--v-font)', color: 'var(--v-text-2)', padding: '4px 6px', borderBottom: '1px solid var(--v-border-quiet, var(--v-border))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const tdValNum = { font: '500 11px var(--v-mono)', color: 'var(--v-text)', padding: '4px 6px', borderBottom: '1px solid var(--v-border-quiet, var(--v-border))', textAlign: 'right', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function Stat({ n, label }) {
  return (
    <div style={{ padding: '9px 8px', background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', textAlign: 'center' }}>
      <div style={{ font: '600 16px var(--v-font)', color: 'var(--v-text)', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ font: '400 9px var(--v-mono)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--v-text-faint)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--v-text-faint)', pointerEvents: 'none' }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px 6px 26px', background: 'var(--v-bg-0)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '400 12px var(--v-font)', outline: 'none' }} />
    </div>
  )
}

function Hint({ children }) {
  return <div style={{ padding: 16, font: '400 12px var(--v-font)', color: 'var(--v-text-muted)', lineHeight: 1.5 }}>{children}</div>
}

const iconBtn = { width: 24, height: 24, border: 'none', background: 'transparent', color: 'var(--v-text-muted)', cursor: 'pointer', borderRadius: 'var(--v-r)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const rowBtn = { display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '5px 7px', border: 'none', background: 'transparent', borderRadius: 'var(--v-r)', cursor: 'pointer' }
const fieldRow = { display: 'flex', alignItems: 'center', gap: 7, padding: '4px 7px 4px 26px' }
