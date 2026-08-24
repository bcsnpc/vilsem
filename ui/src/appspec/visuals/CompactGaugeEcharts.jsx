import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'
import { mergeFragments, GaugeMarks } from '../../primitives/index'

export default function CompactGaugeEcharts({ rows, config, loading, error }) {
  const t = config._T || getThemeTokens('dark')
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  // Read dims synchronously before paint — fires on every mount including StrictMode remounts.
  // clientWidth/clientHeight force a synchronous layout so they're always valid here.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    if (w > 0 && h > 0) setDims({ width: w, height: h })
  }, [])

  // ResizeObserver keeps dims current as the card is resized
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const w = Math.round(width)
      const h = Math.round(height)
      if (w > 0 && h > 0) setDims({ width: w, height: h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeDims = dims

  const option = useMemo(() => {
    const ctx = {
      data: { fields: [], rows: rows || [] },
      encoding: {},
      theme: t,
      selection: { selectedCat: null },
      dimensions: activeDims,
    }

    return mergeFragments([
      GaugeMarks({
        colorScheme:   config.colorScheme,
        min:           config.minValue      ?? 0,
        max:           config.maxValue      ?? 100,
        arcWidth:      config.arcWidth      ?? 10,
        gaugeSize:     config.gaugeSize     ?? 80,
        showMinMax:    config.showMinMax    ?? false,
        colorZones:    config.colorZones    ?? null,
        valueFontSize: config.valueFontSize ?? 15,
        prefix:        config.prefix,
        suffix:        config.suffix,
        animEnabled:   config.animationEnabled !== false,
      }, ctx),
    ])
  }, [
    dims, rows, t,
    config.colorScheme,
    config.minValue, config.maxValue,
    config.arcWidth, config.gaugeSize, config.showMinMax,
    config.valueFontSize,
    config.prefix, config.suffix,
    config.animationEnabled,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(config.colorZones),
  ])

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas option={applyTooltipConfig(option, config)} />
    </div>
  )
}
