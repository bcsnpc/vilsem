import React, { useState, useEffect, useRef } from 'react'

const TYPE_COLORS = {
  String:   { bg: '#EFF6FF', text: '#1D4ED8' },
  Int64:    { bg: '#F0FDF4', text: '#166534' },
  Double:   { bg: '#FFF7ED', text: '#9A3412' },
  Decimal:  { bg: '#FFF7ED', text: '#9A3412' },
  DateTime: { bg: '#F5F3FF', text: '#5B21B6' },
  Boolean:  { bg: '#FDF4FF', text: '#86198F' },
}

function TypeBadge({ type }) {
  const label   = type?.replace('System.', '') || 'unknown'
  const display = label.length > 12 ? label.slice(0, 10) + '..' : label
  const c = TYPE_COLORS[label] || { bg: '#F3F4F6', text: '#374151' }
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>
      {display}
    </span>
  )
}

function ManualRegistry() {
  const [registry, setRegistry]     = useState([])
  const [input, setInput]           = useState('')
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState(null)

  async function loadRegistry() {
    if (!window.semantica?.getMeasureRegistry) return
    try {
      const res = await window.semantica.getMeasureRegistry()
      setRegistry(res?.measures || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { loadRegistry() }, [])

  async function testAndAdd() {
    const name = input.trim()
    if (!name) return
    if (registry.find(m => m === name || m.name === name)) {
      setTestResult({ ok: false, message: 'Already in registry' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await window.semantica.query({ measures: [name], filters: {} })
      if (res.error) {
        setTestResult({ ok: false, message: res.message || res.error })
      } else {
        await loadRegistry()
        setInput('')
        setTestResult({ ok: true, message: `✓ "${name}" works — added to registry` })
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message || 'Query failed' })
    } finally {
      setTesting(false)
    }
  }

  async function remove(name) {
    if (window.semantica?.removeMeasureRegistry) {
      await window.semantica.removeMeasureRegistry({ name }).catch(() => {})
    }
    setRegistry(prev => prev.filter(m => m !== name && m.name !== name))
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 32 }}>
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '18px 20px', marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#9A3412', marginBottom: 6 }}>
          No metadata loaded yet
        </div>
        <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.7 }}>
          The Scanner API will run on the next workspace load. If it's still not showing,
          check that <strong>Service principals can access read-only admin APIs</strong> is
          enabled in the Power BI Admin Portal.<br /><br />
          Alternatively, run:<br />
          <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 }}>
            node scripts/export-model-metadata.js
          </code><br />
          (Power BI Desktop must be open), then click <strong>Import model-export.json</strong> above.<br /><br />
          Or type measure names directly in the Playground — they'll appear as you use them.
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>
          Add a measure manually
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="e.g. Total Revenue"
            value={input}
            onChange={e => { setInput(e.target.value); setTestResult(null) }}
            onKeyDown={e => e.key === 'Enter' && testAndAdd()}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          <button
            onClick={testAndAdd}
            disabled={testing || !input.trim()}
            style={{
              padding: '8px 16px', background: testing ? '#9CA3AF' : 'var(--blue)',
              color: 'white', border: 'none', borderRadius: 6, fontSize: 13,
              fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {testing ? 'Testing...' : 'Test & Add'}
          </button>
        </div>
        {testResult && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 12,
            background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
            color: testResult.ok ? '#166534' : 'var(--red)',
            border: `1px solid ${testResult.ok ? '#BBF7D0' : '#FCA5A5'}`,
          }}>
            {testResult.message}
          </div>
        )}
      </div>

      {registry.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>
            Measure registry ({registry.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {registry.map(m => {
              const name = typeof m === 'string' ? m : m.name
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F9FAFB', borderRadius: 6, border: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 13, color: 'var(--gray-700)', fontFamily: 'monospace' }}>[{name}]</span>
                  <button onClick={() => remove(name)} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {registry.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, paddingTop: 12 }}>
          No measures yet — run queries in the Playground or add them above.
        </div>
      )}
    </div>
  )
}

export default function Explorer() {
  const [measures, setMeasures]       = useState([])   // [{name, table}]
  const [dimTables, setDimTables]     = useState([])   // [{name, columns}]
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [expandedMeasureGroups, setExpandedMeasureGroups] = useState({})  // table → bool
  const [expandedDimTables, setExpandedDimTables]         = useState({})  // table → bool
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    if (!window.semantica) { setLoading(false); setUnavailable(true); return }
    setLoading(true)

    Promise.all([
      window.semantica.getMeasures().catch(() => ({ measures: [] })),
      window.semantica.getDimensions().catch(() => ({ tables: [] })),
    ]).then(([measRes, dimRes]) => {
      const ms = measRes.measures || []
      const ts = dimRes.tables   || []
      setMeasures(ms)
      setDimTables(ts)
      setUnavailable(ms.length === 0 && ts.length === 0)
      setLoading(false)

      // Default: expand everything
      const mGroups = {}
      for (const m of ms) { mGroups[m.table || 'Measures'] = true }
      setExpandedMeasureGroups(mGroups)
      const dGroups = {}
      for (const t of ts) { dGroups[t.name] = true }
      setExpandedDimTables(dGroups)
    })

    if (window.semantica?.onMetadataUpdated) {
      window.semantica.onMetadataUpdated((_event, data) => {
        if (data?.measures?.length) {
          setMeasures(data.measures)
          const mGroups = {}
          for (const m of data.measures) { mGroups[m.table || 'Measures'] = true }
          setExpandedMeasureGroups(mGroups)
          setUnavailable(false)
        }
        if (data?.dimensions?.length) {
          setDimTables(data.dimensions)
          const dGroups = {}
          for (const t of data.dimensions) { dGroups[t.name] = true }
          setExpandedDimTables(dGroups)
          setUnavailable(false)
        }
      })
    }
  }, [])

  async function handleImport() {
    if (!window.semantica?.importFromFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await window.semantica.importFromFile()
      if (res.canceled) { setImporting(false); return }
      if (!res.success) {
        setImportResult({ ok: false, message: res.error || 'Import failed' })
        setImporting(false)
        return
      }
      const ms = res.measures || []
      const ts = res.tables   || []
      setMeasures(ms)
      setDimTables(ts)
      setUnavailable(ms.length === 0 && ts.length === 0)
      const mGroups = {}
      for (const m of ms) { mGroups[m.table || 'Measures'] = true }
      setExpandedMeasureGroups(mGroups)
      const dGroups = {}
      for (const t of ts) { dGroups[t.name] = true }
      setExpandedDimTables(dGroups)
      setImportResult({ ok: true, message: `Imported ${res.measureCount} measures and ${res.tableCount} tables` })
    } catch (e) {
      setImportResult({ ok: false, message: e.message || 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  function toggleMeasureGroup(table) {
    setExpandedMeasureGroups(prev => ({ ...prev, [table]: !prev[table] }))
  }

  function toggleDimTable(name) {
    setExpandedDimTables(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Group measures by table
  const measuresByTable = {}
  for (const m of measures) {
    const t = m.table || 'Measures'
    if (!measuresByTable[t]) measuresByTable[t] = []
    measuresByTable[t].push(m.name)
  }

  // Filter by search
  const q = search.toLowerCase()
  const filteredMeasureGroups = Object.entries(measuresByTable)
    .map(([table, names]) => ({
      table,
      names: names.filter(n => !q || n.toLowerCase().includes(q) || table.toLowerCase().includes(q)),
    }))
    .filter(g => g.names.length > 0)

  const filteredDimTables = dimTables.filter(t =>
    !q ||
    t.name.toLowerCase().includes(q) ||
    t.columns.some(c => c.name.toLowerCase().includes(q))
  ).map(t => ({
    ...t,
    columns: !q ? t.columns : t.columns.filter(c =>
      c.name.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    ),
  }))

  const totalMeasures = measures.length
  const totalTables   = dimTables.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>Model Explorer</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
              Browse tables, columns, and measures from the connected dataset
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              title="Import from model-export.json (run scripts/export-model-metadata.js first)"
              style={{
                padding: '7px 14px', background: importing ? '#9CA3AF' : 'var(--blue)',
                color: 'white', border: 'none', borderRadius: 6, fontSize: 12,
                fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {importing ? 'Importing...' : 'Import model-export.json'}
            </button>
            {importResult && (
              <div style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 5,
                background: importResult.ok ? '#F0FDF4' : '#FEF2F2',
                color: importResult.ok ? '#166534' : 'var(--red)',
                border: `1px solid ${importResult.ok ? '#BBF7D0' : '#FCA5A5'}`,
              }}>
                {importResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Loading model metadata...</div>
          </div>
        </div>
      ) : unavailable ? (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gray-50)' }}>
          <ManualRegistry />
        </div>
      ) : (
        <>
          {/* Search */}
          <div style={{ padding: '10px 24px', borderBottom: '1px solid #F3F4F6', background: 'white' }}>
            <input
              placeholder="Search measures and columns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Two-section content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--gray-50)' }}>

            {/* ── MEASURES section ── */}
            {filteredMeasureGroups.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Measures ({totalMeasures})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredMeasureGroups.map(({ table, names }) => (
                    <div key={table} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                      {/* Group header */}
                      <button
                        onClick={() => toggleMeasureGroup(table)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: expandedMeasureGroups[table] ? '1px solid #F3F4F6' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{table}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', background: '#F3F4F6', padding: '1px 7px', borderRadius: 999 }}>
                            {names.length}
                          </span>
                        </div>
                        <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                          {expandedMeasureGroups[table] ? '▲' : '▼'}
                        </span>
                      </button>
                      {/* Measure list */}
                      {expandedMeasureGroups[table] && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px' }}>
                          {names.map(name => (
                            <div key={name} style={{ background: '#EFF6FF', borderRadius: 5, padding: '4px 10px', fontSize: 12, color: 'var(--blue)', fontWeight: 500, fontFamily: 'monospace' }}>
                              [{name}]
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TABLES & COLUMNS section ── */}
            {filteredDimTables.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Tables & Columns ({totalTables})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredDimTables.map(table => (
                    <div key={table.name} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                      {/* Table header */}
                      <button
                        onClick={() => toggleDimTable(table.name)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: expandedDimTables[table.name] ? '1px solid #F3F4F6' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{table.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', background: '#F3F4F6', padding: '1px 7px', borderRadius: 999 }}>
                            {table.columns.length} col{table.columns.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                          {expandedDimTables[table.name] ? '▲' : '▼'}
                        </span>
                      </button>
                      {/* Column list */}
                      {expandedDimTables[table.name] && (
                        <div>
                          {table.columns.map((col, i) => (
                            <div key={col.name} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '7px 14px',
                              background: i % 2 === 0 ? 'white' : '#FAFAFA',
                              borderTop: '1px solid #F3F4F6',
                            }}>
                              <span style={{ fontSize: 13, color: 'var(--gray-700)' }}>{col.name}</span>
                              <TypeBadge type={col.dataType} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty search result */}
            {filteredMeasureGroups.length === 0 && filteredDimTables.length === 0 && search && (
              <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--gray-400)', fontSize: 13 }}>
                No results for "{search}"
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 24px', borderTop: '1px solid #E5E7EB', background: 'white', fontSize: 12, color: 'var(--gray-400)', display: 'flex', gap: 20 }}>
            <span><strong>{totalMeasures}</strong> measures</span>
            <span><strong>{totalTables}</strong> tables</span>
          </div>
        </>
      )}
    </div>
  )
}
