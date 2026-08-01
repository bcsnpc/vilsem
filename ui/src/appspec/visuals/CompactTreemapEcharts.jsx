import React, { useCallback } from 'react'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import getThemeTokens from '../getThemeTokens'
import { mergeFragments, TreemapMarks } from '../../primitives/index'

export default function CompactTreemapEcharts({ rows, config, loading, error }) {
  const t = config._T || getThemeTokens('dark')
  // Tile click → category (node name), for click-to-drill / cross-filter.
  const handleClick = useCallback((params) => {
    const cat = params?.name
    if (config._onBarClick && cat != null) config._onBarClick(String(cat))
  }, [config._onBarClick])

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const ctx = {
    data: { fields: [], rows },
    encoding: {},
    theme: t,
    selection: { selectedCat: null },
    dimensions: { width: 0, height: 0 },
  }

  const option = mergeFragments([
    TreemapMarks({
      colorScheme:   config.colorScheme,
      showLabels:    config.showLabels    ?? true,
      showValues:    config.showValues    ?? false,
      colorMode:     config.colorMode     ?? 'single',
      // Default tile gap color = canvas background. In dark theme this is near-black
      // (visible darker line between tiles); in light theme this is light gray
      // (visible lighter line). Either way the gap reads as "page peeks through" —
      // never a hardcoded dark stroke that breaks light-theme rendering.
      borderColor:   config.borderColor   ?? t.canvasBg,
      borderWidth:   config.borderWidth   ?? 1,
      borderRadius:  config.borderRadius  ?? 0,
      customColors:  config.customColors,
      animEnabled:   config.animationEnabled !== false,
      prefix:        config.prefix,
      suffix:        config.suffix,
      labelColor:    config.labelColor    ?? '#FFFFFF',
      valueColor:    config.valueColor    ?? '#94A3B8',
      labelFontSize: config.labelFontSize ?? 10,
      valueFontSize: config.valueFontSize ?? 9,
      padding:       config.padding       ?? 0,
    }, ctx),
  ])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas option={option} onClick={config._onBarClick ? handleClick : undefined} />
    </div>
  )
}
