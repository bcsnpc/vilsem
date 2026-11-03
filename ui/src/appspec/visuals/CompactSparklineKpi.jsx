import React from 'react'
import { pal } from '@vilsem/core/palettes'
import getThemeTokens from '../getThemeTokens'
import CompactKpi from './CompactKpi.jsx'

export default function CompactSparklineKpi({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  // Same as KPI but with sparkline always on
  return CompactKpi({ rows, config: { ...config, showSparkline: true, showTrend: true }, loading, error })
}
