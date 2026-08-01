import React from 'react'
import CompactScatter from './CompactScatter.jsx'

export default function CompactBubble({ rows, config, loading, error }) {
  // Bubble chart = scatter with variable dot size from 3rd value
  return CompactScatter({ rows, config: { ...config, dotSize: 8, dotSizeMax: 200 }, loading, error })
}
