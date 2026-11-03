import React, { useCallback } from 'react'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'
import { mergeFragments, PieMarks } from '@vilsem/core/primitives'

export default function CompactDonutEcharts({ rows, config, loading, error }) {
  const t = config._T || getThemeTokens('dark')
  // Slice click → category, for click-to-drill / cross-filter (params.name = slice name)
  const handleClick = useCallback((params) => {
    const cat = params?.name
    if (config._onBarClick && cat != null) config._onBarClick(String(cat), { ctrlKey: !!params?.event?.event?.ctrlKey, metaKey: !!params?.event?.event?.metaKey })
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
    PieMarks({
      colorScheme:    config.colorScheme,
      // Shape
      innerRadius:    config.innerRadius    ?? 52,
      outerRadius:    config.outerRadius    ?? 85,
      paddingAngle:   config.paddingAngle   ?? 2,
      cornerRadius:   config.cornerRadius   ?? 0,
      // Colors
      customColors:   config.customColors,
      strokeColor:    config.strokeColor    ?? 'transparent',
      strokeWidth:    config.strokeWidth    ?? 0,
      // Legend
      showLegend:     config.showLegend     ?? true,
      legendPosition: config.legendPosition ?? 'right',
      legendColor:    config.legendColor,
      legendFontSize: config.legendFontSize,
      maxLegendItems: config.maxLegendItems ?? 6,
      // Labels
      showLabels:     config.showLabels     ?? false,
      labelStyle:     config.labelStyle     ?? 'percent',
      showCenterText: config.showCenterText ?? true,
      centerColor:    config.centerColor || undefined,    // empty string in schema = use scheme color
      centerFontSize: config.centerFontSize ?? (rows.length === 1 && rows[0]._cat === undefined ? (config.valueFontSize || 32) : 22),
      // Single-measure radial progress
      maxValue:       config.maxValue       ?? 100,
      // Animation
      animEnabled:    config.animationEnabled !== false,
      // Format
      prefix:         config.prefix,
      suffix:         config.suffix,
      categoryColors: config.categoryColors,
    }, ctx),
  ])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas config={config} option={applyTooltipConfig(option, config)} onClick={config._onBarClick ? handleClick : undefined} />
    </div>
  )
}
