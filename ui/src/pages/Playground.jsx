import React, { useState, useEffect, useCallback } from 'react'
import KpiCard from '../components/KpiCard.jsx'

function fmt(n) {
  if (n === null || n === undefined) return '—'
  if (typeof n === 'number') return n.toLocaleString()
  return String(n)
}

function timeUntil(iso) {
  if (!iso) return '—'
  const diff = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000))
  if (diff < 60) return `${diff}s`
  return `${Math.floor(diff / 60)}m ${diff % 60}s`
}

export default function Playground() {
  // Discovered metadata
  const [discoveredMeasures, setDiscoveredMeasures] = useState([])  // [{name, table}]
  const [dimensions, setDimensions]                 = useState([])  // [{name, columns}]

  // Selection state
  const [selectedMeasures, setSelectedMeasures]     = useState([])  // checked names
  const [measureSearch, setMeasureSearch]           = useState('')
  const [measureInput, setMeasureInput]             = useState('')  // text fallback
  const [usedMeasures, setUsedMeasures]             = useState([])  // from SQLite registry

  // Filter state
  const [filters, setFilters]   = useState([])
  const [ttl, setTtl]           = useState(300)

  // Results
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [activeTab, setActiveTab] = useState('result')
  const [dax, setDax]           = useState('')
  const [copied, setCopied]     = useState(false)

  const hasMeasures = discoveredMeasures.length > 0

  async function loadDiscoveredMeasures() {
    if (!window.semantica?.getMeasures) return
    try {
      const res = await window.semantica.getMeasures()
      if (res?.measures?.length) setDiscoveredMeasures(res.measures)
    } catch { /* ignore */ }
  }

  async function loadRegistry() {
    if (!window.semantica?.getMeasureRegistry) return
    try {
      const res = await window.semantica.getMeasureRegistry()
      setUsedMeasures(res?.measures || [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadDiscoveredMeasures()
    loadRegistry()

    // Load dimensions
    if (window.semantica?.getDimensions) {
      window.semantica.getDimensions().then(res => {
        if (res?.tables?.length) setDimensions(res.tables)
      }).catch(() => {})
    }

    // Listen for scanner discovery completing
    if (window.semantica?.onMetadataUpdated) {
      window.semantica.onMetadataUpdated((_event, data) => {
        if (data?.measures?.length)    setDiscoveredMeasures(data.measures)
        if (data?.dimensions?.length)  setDimensions(data.dimensions)
      })
    }
  }, [])

  // Get selected measure names regardless of input mode
  function getActiveMeasures() {
    if (hasMeasures) return selectedMeasures
    return measureInput.split(',').map(s => s.trim()).filter(Boolean)
  }

  function toggleMeasure(name) {
    setSelectedMeasures(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    )
  }

  function addTextChip(name) {
    setMeasureInput(prev => {
      const parts = prev.split(',').map(s => s.trim()).filter(Boolean)
      if (parts.includes(name)) return prev
      return [...parts, name].join(', ')
    })
  }

  async function removeUsedChip(name) {
    if (window.semantica?.removeMeasureRegistry) {
      await window.semantica.removeMeasureRegistry({ name }).catch(() => {})
    }
    setUsedMeasures(prev => prev.filter(m => m !== name))
    setMeasureInput(prev => {
      const parts = prev.split(',').map(s => s.trim()).filter(m => m !== name)
      return parts.join(', ')
    })
  }

  // Filter helpers
  function addFilter() {
    setFilters(prev => [...prev, { key: '', value: '' }])
  }

  function updateFilter(i, field, val) {
    setFilters(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f))
  }

  function removeFilter(i) {
    setFilters(prev => prev.filter((_, idx) => idx !== i))
  }

  // Build filter key options from dimensions
  function getFilterKeyOptions() {
    const opts = []
    for (const table of dimensions) {
      for (const col of table.columns) {
        opts.push(`${table.name}[${col.name}]`)
      }
    }
    return opts
  }

  const runQuery = useCallback(async () => {
    if (!window.semantica) return
    const ms = getActiveMeasures()
    if (!ms.length) { setError('Select or enter at least one measure.'); return }

    const filtersObj = {}
    for (const f of filters) {
      if (f.key && f.value !== '') filtersObj[f.key] = isNaN(f.value) ? f.value : Number(f.value)
    }

    setLoading(true); setError(null); setResult(null)
    try {
      const res = await window.semantica.query({ measures: ms, filters: filtersObj, ttl: Number(ttl) })
      if (res.error) { setError(res.message || res.error); return }
      setResult(res)

      // Reload registry — backend saves measures on successful Fabric calls
      await loadRegistry()

      // DAX preview
      const filterParts = Object.entries(filtersObj).map(([k, v]) => {
        const m = k.match(/^([^[]+)\[([^\]]+)\]$/)
        if (!m) return ''
        const val = typeof v === 'string' ? `"${v}"` : v
        return `  FILTER('${m[1]}', '${m[1]}'[${m[2]}] = ${val})`
      }).filter(Boolean)
      const mParts = ms.map(m => `  "${m}", [${m}]`)
      setDax(`EVALUATE SUMMARIZECOLUMNS(\n${[...filterParts, ...mParts].join(',\n')}\n)`)
    } catch (e) {
      setError(e.message || 'Query failed')
    } finally {
      setLoading(false)
    }
  }, [selectedMeasures, measureInput, filters, ttl, hasMeasures])

  function copyText(text) {
    navigator.clipboard?.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const filterKeyOptions = getFilterKeyOptions()
  const filteredMeasures = discoveredMeasures.filter(m =>
    m.name.toLowerCase().includes(measureSearch.toLowerCase())
  )

  // Group by table
  const measuresByTable = {}
  for (const m of filteredMeasures) {
    const t = m.table || 'Measures'
    if (!measuresByTable[t]) measuresByTable[t] = []
    measuresByTable[t].push(m.name)
  }

  return (
    <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Left panel: Query Builder ── */}
      <div style={{
        width: 300, minWidth: 280,
        borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column',
        background: 'white', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>Query Builder</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── Measures: Checkbox mode ── */}
          {hasMeasures ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Measures
                <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--blue)', fontSize: 10, textTransform: 'none', letterSpacing: 0 }}>
                  {selectedMeasures.length} selected
                </span>
              </div>

              {/* Search */}
              <input
                placeholder="Search measures..."
                value={measureSearch}
                onChange={e => setMeasureSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}
              />

              {/* Selected chips */}
              {selectedMeasures.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {selectedMeasures.map(m => (
                    <span key={m} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: '#EFF6FF', border: '1px solid #BFDBFE',
                      color: 'var(--blue)', borderRadius: 4,
                      padding: '2px 6px', fontSize: 11, fontWeight: 500,
                    }}>
                      {m}
                      <button
                        onClick={() => toggleMeasure(m)}
                        style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Checkbox list */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                {Object.entries(measuresByTable).map(([table, names]) => (
                  <div key={table}>
                    <div style={{ padding: '5px 10px', background: '#F9FAFB', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F3F4F6' }}>
                      {table}
                    </div>
                    {names.map(name => (
                      <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #F9FAFB', fontSize: 12, color: 'var(--gray-700)' }}>
                        <input
                          type="checkbox"
                          checked={selectedMeasures.includes(name)}
                          onChange={() => toggleMeasure(name)}
                          style={{ cursor: 'pointer', accentColor: 'var(--blue)' }}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                ))}
                {filteredMeasures.length === 0 && (
                  <div style={{ padding: '12px 10px', color: 'var(--gray-400)', fontSize: 12, textAlign: 'center' }}>
                    No measures match "{measureSearch}"
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Measures: Text fallback mode ── */
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Measures
              </div>
              <textarea
                placeholder={'Enter measure name, e.g. Total Revenue'}
                value={measureInput}
                onChange={e => setMeasureInput(e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'none', fontSize: 13, lineHeight: 1.5 }}
              />
              {usedMeasures.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 5 }}>Previously used:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {usedMeasures.map(m => (
                      <div key={m} style={{ display: 'flex', alignItems: 'center' }}>
                        <button onClick={() => addTextChip(m)} title="Add to query" style={chipBtnLeft}>{m}</button>
                        <button onClick={() => removeUsedChip(m)} title="Remove from history" style={chipBtnRight}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Filters ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Filters
              </div>
              <button onClick={addFilter} style={ghostBtnStyle}>+ Add</button>
            </div>
            {filters.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
                {filterKeyOptions.length > 0 ? (
                  <select
                    value={f.key}
                    onChange={e => updateFilter(i, 'key', e.target.value)}
                    style={{ ...inputStyle, flex: 3, fontSize: 11, padding: '5px 6px' }}
                  >
                    <option value="">— column —</option>
                    {filterKeyOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder="e.g. dim_team[team_name]"
                    value={f.key}
                    onChange={e => updateFilter(i, 'key', e.target.value)}
                    style={{ ...inputStyle, flex: 3, fontSize: 11, padding: '5px 8px' }}
                  />
                )}
                <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>=</span>
                <input
                  placeholder="value"
                  value={f.value}
                  onChange={e => updateFilter(i, 'value', e.target.value)}
                  style={{ ...inputStyle, flex: 2, fontSize: 11, padding: '5px 8px' }}
                />
                <button onClick={() => removeFilter(i)} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>×</button>
              </div>
            ))}
            {filters.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>No filters — querying all data</div>
            )}
          </div>

          {/* ── TTL ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Cache TTL (seconds)
            </div>
            <input
              type="number"
              value={ttl}
              onChange={e => setTtl(e.target.value)}
              style={{ ...inputStyle, width: 100 }}
            />
          </div>
        </div>

        {/* Run button */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
          <button
            onClick={runQuery}
            disabled={loading}
            style={{
              width: '100%', padding: '10px 0',
              background: loading ? 'var(--gray-400)' : 'var(--blue)',
              color: 'white', border: 'none', borderRadius: 7,
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 8, transition: 'background 0.15s',
            }}>
            {loading ? 'Running...' : '▶ Run Query'}
          </button>
          <button onClick={() => { setResult(null); setError(null) }} style={{ ...ghostBtnStyle, width: '100%', textAlign: 'center', padding: '6px 0' }}>
            Clear results
          </button>
        </div>
      </div>

      {/* ── Right panel: Results ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--gray-50)' }}>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid #E5E7EB', background: 'white', padding: '0 24px', display: 'flex', gap: 0 }}>
          {['result', 'dax', 'json'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--blue)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab ? 'var(--blue)' : 'var(--gray-400)',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
              marginBottom: -1,
            }}>
              {tab === 'result' ? 'Result' : tab === 'dax' ? 'DAX' : 'Raw JSON'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {!result && !error && !loading && (
            <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⬡</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--gray-700)' }}>Ready to query</div>
              <div style={{ fontSize: 13 }}>
                {hasMeasures ? 'Select measures and click Run Query' : 'Type a measure name and click Run Query'}
              </div>
              {!hasMeasures && (
                <div style={{ fontSize: 12, marginTop: 8, fontFamily: 'monospace', background: 'white', display: 'inline-block', padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                  e.g. Total Revenue
                </div>
              )}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Querying Fabric...</div>
            </div>
          )}

          {result && activeTab === 'result' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {Object.entries(result.data || {}).map(([k, v]) => (
                <KpiCard key={k} label={k} value={v} source={result.source} queryMs={result.queryMs} />
              ))}
            </div>
          )}

          {activeTab === 'dax' && dax && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => copyText(dax)} style={{ ...ghostBtnStyle, position: 'absolute', top: 8, right: 8, fontSize: 11 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <div className="code-block">{dax}</div>
            </div>
          )}

          {activeTab === 'json' && result && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => copyText(JSON.stringify(result, null, 2))} style={{ ...ghostBtnStyle, position: 'absolute', top: 8, right: 8, fontSize: 11 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <div className="code-block">{JSON.stringify(result, null, 2)}</div>
            </div>
          )}
        </div>

        {/* Status bar */}
        {result && (
          <div style={{
            borderTop: '1px solid #E5E7EB',
            background: 'white',
            padding: '8px 24px',
            display: 'flex', alignItems: 'center', gap: 20,
            fontSize: 12, color: 'var(--gray-400)',
          }}>
            <span>Source: <strong style={{ color: result.source === 'cache' ? 'var(--green)' : 'var(--blue)' }}>{result.source}</strong></span>
            <span>Time: <strong>{result.queryMs}ms</strong></span>
            {result.cacheExpiresAt && (
              <span>Expires: <strong>{timeUntil(result.cacheExpiresAt)}</strong></span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #E5E7EB',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--gray-700)',
  outline: 'none',
  fontFamily: 'inherit',
  background: 'white',
  boxSizing: 'border-box',
}

const ghostBtnStyle = {
  background: 'transparent',
  border: '1px solid #E5E7EB',
  borderRadius: 5,
  padding: '4px 10px',
  fontSize: 12,
  color: 'var(--gray-700)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const chipBtnLeft = {
  background: '#EFF6FF',
  color: 'var(--blue)',
  border: '1px solid #BFDBFE',
  borderRight: 'none',
  borderRadius: '4px 0 0 4px',
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  maxWidth: 130,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const chipBtnRight = {
  background: '#EFF6FF',
  color: 'var(--gray-400)',
  border: '1px solid #BFDBFE',
  borderRadius: '0 4px 4px 0',
  padding: '3px 5px',
  fontSize: 10,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
}
