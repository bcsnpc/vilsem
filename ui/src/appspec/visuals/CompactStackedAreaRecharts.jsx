import React from 'react'
import getThemeTokens from '../getThemeTokens'
import CompactLine from './CompactLineRecharts.jsx'

export default function CompactStackedArea({ rows, config, loading, error, groupBy }) {
  // Stacked area = line/area with two measures stacked
  const t = config._T || getThemeTokens('dark')
  return CompactLine({ rows, config: { ...config, chartType: 'area', showSecondary: true }, loading, error, groupBy })
}
