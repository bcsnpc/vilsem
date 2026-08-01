import React from 'react'
import CompactBar from './CompactBarRecharts.jsx'

export default function CompactColumn({ rows, config, loading, error }) {
  // Vertical column chart — reuses bar with orientation override
  return CompactBar({ rows, config: { ...config, orientation: 'vertical' }, loading, error })
}
