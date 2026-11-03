import React from '../ui/node_modules/react/index.js'
import { renderToStaticMarkup } from '../ui/node_modules/react-dom/server.node.js'
import { describe, it, expect } from 'vitest'
import Stat from '../ui/src/appspec/visuals/CompactStatCard.jsx'
import Metric from '../ui/src/appspec/visuals/CompactMetricTile.jsx'

describe('Scalar card data-state integrity', () => {
  it.each([null, undefined])('Stat Card does not fabricate a comparison for missing current value %s', value => {
    const html = renderToStaticMarkup(React.createElement(Stat, { rows: [{ _val: value, _val2: 100 }], config: {} }))
    expect(html).not.toContain('data-format-target="comparison"')
    expect(html).not.toContain('NaN')
  })
  it('Stat Card retains a valid zero-to-positive comparison', () => {
    const html = renderToStaticMarkup(React.createElement(Stat, { rows: [{ _val: 0, _val2: 100 }], config: {} }))
    expect(html).toContain('data-format-target="comparison"')
    expect(html).toContain('100.0%')
  })
  for (const [name, Component] of [['stat_card', Stat], ['metric_tile', Metric]]) {
    it(`${name} reports a query failure even with stale rows`, () => {
      const html = renderToStaticMarkup(React.createElement(Component, { rows: [{ _val: 98765 }], config: {}, error: 'QA connection unavailable' }))
      expect(html).toContain('QA connection unavailable')
      expect(html).not.toContain('98.8')
      expect(html).not.toContain('metric-ring')
    })
    it(`${name} reports an empty result instead of a zero ring or value`, () => {
      const html = renderToStaticMarkup(React.createElement(Component, { rows: [], config: {} }))
      expect(html).toContain('No data')
      expect(html).not.toContain('metric-ring')
    })
    it(`${name} preserves a legitimate zero result`, () => {
      const html = renderToStaticMarkup(React.createElement(Component, { rows: [{ _val: 0 }], config: {} }))
      expect(html).not.toContain('No data')
      expect(html).toContain('>0<')
    })
  }
})
