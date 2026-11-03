import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import CompactWaffle from '../appspec/visuals/CompactWaffle.jsx'
import CompactBullet from '../appspec/visuals/CompactBullet.jsx'
import CompactProgressBar from '../appspec/visuals/CompactProgressBar.jsx'

import CompactStatCard from '../appspec/visuals/CompactStatCard.jsx'
import CompactMetricTile from '../appspec/visuals/CompactMetricTile.jsx'

import CompactFunnel from '../appspec/visuals/CompactFunnel.jsx'
import CompactWaterfall from '../appspec/visuals/CompactWaterfall.jsx'
import CompactHeatmap from '../appspec/visuals/CompactHeatmap.jsx'
import CompactRankedList from '../appspec/visuals/CompactRankedList.jsx'
import CompactChord from '../appspec/visuals/CompactChord.jsx'
import CompactSunburst from '../appspec/visuals/CompactSunburst.jsx'
import CompactNarrative from '../appspec/visuals/CompactNarrative.jsx'

import CompactShape from '../appspec/visuals/CompactShape.jsx'
import CompactDivider from '../appspec/visuals/CompactDivider.jsx'

const components = { waffle: CompactWaffle, bullet: CompactBullet, progress: CompactProgressBar, stat_card: CompactStatCard, metric_tile: CompactMetricTile, funnel: CompactFunnel, waterfall: CompactWaterfall, heatmap: CompactHeatmap, ranked_list: CompactRankedList, chord: CompactChord, sunburst: CompactSunburst, narrative: CompactNarrative, sankey: CompactChord, insight: CompactNarrative, shape: CompactShape, divider: CompactDivider }

// An explicit component allowlist keeps saved specs from selecting arbitrary code.
export function mountPowerBIDomVisual(element, type, rows, config) {
  const Component = Object.hasOwn(components, type) ? components[type] : null
  if (!Component) throw new Error(`Unsupported DOM visual: ${type}`)
  element.dataset.powerbiDomVisual = type
  const root = createRoot(element)
  let disposed = false
  const update = (nextRows, nextConfig) => {
    if (disposed) throw new Error('Cannot update a disposed visual')
    flushSync(() => root.render(<Component rows={nextRows} config={nextConfig} />))
  }
  try { update(rows, config) } catch (error) { root.unmount(); throw error }
  return {
    update,
    dispose() {
      if (disposed) return
      disposed = true
      root.unmount()
      delete element.dataset.powerbiDomVisual
    },
  }
}
