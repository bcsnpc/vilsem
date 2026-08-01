import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

// Idempotent — EChartsCanvas.jsx also registers these; echarts/core dedupes.
echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

// Bar-chart race (interaction · playback). A Play/Pause + scrub timeline steps
// through a TIME dimension (config.playAxis) while the bars re-rank each frame —
// object constancy via a MERGE setOption (bars slide to new positions rather than
// being replaced). Data arrives 2-dimensional (frame × category) from AppSpecRenderer's
// bar_race branch (normaliseTableRows → rows with _cats:[frame, category], _val); this
// component owns its ECharts instance so it can animate frame-to-frame imperatively.
// NOTE: the play axis (time dimension) and "Bars shown" (limit) are DATA inputs,
// set in the DATA tab next to Group By (see VisualInspector), not here in STYLE.
export const schema = [
  { key: 'playSpeed',   label: 'Frame (ms)',   type: 'range',   default: 620, min: 200, max: 1500, step: 20, group: 'Race' },
  { key: 'autoPlay',    label: 'Auto-play',    type: 'boolean', default: false, group: 'Race' },
  { key: 'loopPlayback',label: 'Loop',         type: 'boolean', default: false, group: 'Race' },
  { key: 'barColorMode',label: 'Bar colours',  type: 'select',  default: 'category',
    options: [{ label: 'Per category', value: 'category' }, { label: 'Single accent', value: 'accent' }], group: 'Appearance' },
  { key: 'dataLabels',  label: 'Show values',  type: 'boolean', default: true, group: 'Labels' },
  { key: 'valuePrefix', label: 'Value prefix', type: 'text',    default: '',   group: 'Labels' },
  { key: 'valueSuffix', label: 'Value suffix', type: 'text',    default: '',   group: 'Labels' },
]

const RACE_PALETTE = ['#58AECB', '#5FBF9B', '#E0A458', '#9B8AC4', '#C97B84', '#7FA8D9', '#8BCF7F', '#D98CC0', '#6FD3C7', '#E8B15E']

// rows (normaliseTableRows: _cats=[frame, category], _val) → chronologically-ordered frames.
function buildFrames(rows) {
  const byFrame = new Map()
  for (const r of (rows || [])) {
    const frame = r?._cats?.[0]
    const cat = r?._cats?.[1]
    if (frame == null || cat == null) continue
    if (!byFrame.has(frame)) byFrame.set(frame, [])
    byFrame.get(frame).push({ name: String(cat), value: Number(r._val) || 0 })
  }
  const keys = [...byFrame.keys()].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }))
  return keys.map(k => ({ label: String(k), items: byFrame.get(k) }))
}

export default function CompactBarRaceEcharts({ rows, config = {}, loading, error }) {
  const t = config._T || getThemeTokens('dark')
  const p = pal(config.colorScheme)
  const rootRef = useRef(null)
  const chartRef = useRef(null)
  const timerRef = useRef(null)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frames = useMemo(() => buildFrames(rows), [rows])
  const topN = config.limit || 8
  const speed = config.playSpeed || 620
  const showLabels = config.dataLabels ?? true
  const prefix = config.valuePrefix || ''
  const suffix = config.valueSuffix || ''
  const perCat = (config.barColorMode || 'category') === 'category'

  // Stable colour per category name (so a bar keeps its hue as it changes rank).
  const colorFor = useMemo(() => {
    const names = []
    const seen = new Set()
    for (const f of frames) for (const it of f.items) if (!seen.has(it.name)) { seen.add(it.name); names.push(it.name) }
    const map = {}
    names.forEach((n, i) => { map[n] = RACE_PALETTE[i % RACE_PALETTE.length] })
    return (name) => (perCat ? (map[name] || p.start) : p.start)
  }, [frames, perCat, p.start])

  // Init the ECharts instance once. The container div is ALWAYS mounted (loading/
  // empty states are overlays) so this runs even before data arrives.
  useEffect(() => {
    if (!rootRef.current) return
    const chart = echarts.init(rootRef.current)
    chartRef.current = chart
    let raf = 0
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => chartRef.current?.resize())
    })
    ro.observe(rootRef.current)
    return () => { if (raf) cancelAnimationFrame(raf); ro.disconnect(); chart.dispose(); chartRef.current = null }
  }, [])

  // New data → back to the first frame; honour auto-play.
  useEffect(() => { setIdx(0); setPlaying(!!config.autoPlay) }, [frames.length, config.autoPlay])

  // Draw the current frame (MERGE update → bars animate to their new ranks).
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !frames.length) return
    const fr = frames[Math.min(idx, frames.length - 1)]
    const items = [...fr.items].sort((a, b) => a.value - b.value).slice(-topN)
    const anim = Math.max(200, Math.min(560, speed - 60))
    chart.setOption({
      grid: { left: 8, right: 74, top: 8, bottom: 16, containLabel: true },
      tooltip: { trigger: 'item', confine: true, valueFormatter: (v) => prefix + fmtVal(v) + suffix },
      xAxis: { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, animationDurationUpdate: anim },
      yAxis: {
        type: 'category', data: items.map(d => d.name),
        axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { color: t.textMuted, fontSize: 12 }, animationDurationUpdate: anim,
      },
      series: [{
        type: 'bar', barMaxWidth: 26,
        data: items.map(d => ({ value: d.value, itemStyle: { color: colorFor(d.name), borderRadius: [0, 4, 4, 0] } })),
        label: showLabels
          ? { show: true, position: 'right', color: t.textMuted, fontSize: 11, formatter: (x) => prefix + fmtVal(x.value) + suffix }
          : { show: false },
        animationDurationUpdate: anim, animationEasingUpdate: 'linear',
      }],
      animationDurationUpdate: anim, animationEasingUpdate: 'linear',
    })
  }, [idx, frames, topN, showLabels, prefix, suffix, colorFor, t.textMuted, speed])

  // Play timer.
  useEffect(() => {
    if (!playing || frames.length < 2) return undefined
    timerRef.current = setInterval(() => {
      setIdx(prev => {
        const next = prev + 1
        if (next >= frames.length) {
          if (config.loopPlayback) return 0
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
          setPlaying(false)
          return prev
        }
        return next
      })
    }, speed)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [playing, frames.length, speed, config.loopPlayback])

  const hasFrames = frames.length > 0
  const maxIdx = Math.max(0, frames.length - 1)
  const curLabel = hasFrames ? frames[Math.min(idx, maxIdx)].label : ''
  const accent = p.start

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Play bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 2px 8px' }}>
        <button
          onClick={() => { if (idx >= maxIdx) setIdx(0); setPlaying(v => !v) }}
          disabled={frames.length < 2}
          style={{
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: frames.length < 2 ? 'default' : 'pointer',
            padding: '4px 12px', borderRadius: 6, whiteSpace: 'nowrap',
            border: `1px solid ${playing ? accent : t.gridStroke}`,
            background: playing ? accent : 'transparent',
            color: playing ? '#0b0b12' : t.textMuted, opacity: frames.length < 2 ? 0.4 : 1,
          }}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <input
          type="range" min={0} max={maxIdx} step={1}
          value={Math.min(idx, maxIdx)}
          onChange={e => { setPlaying(false); setIdx(Number(e.target.value)) }}
          disabled={frames.length < 2}
          style={{ flex: 1, accentColor: accent, cursor: frames.length < 2 ? 'default' : 'pointer' }}
        />
        <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, color: t.textMuted, minWidth: 64, textAlign: 'right' }}>
          {curLabel}
        </div>
      </div>

      {/* Chart area — div stays mounted; loading/empty render as overlays. */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
        <div ref={rootRef} style={{ position: 'absolute', inset: 0 }} />
        {loading && <div style={{ position: 'absolute', inset: 0 }}><LoadingShimmer /></div>}
        {!loading && (error || !hasFrames) && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <EmptyState error={error} label={error ? undefined : 'Set a category, a measure and a play axis (time).'} />
          </div>
        )}
      </div>
    </div>
  )
}
