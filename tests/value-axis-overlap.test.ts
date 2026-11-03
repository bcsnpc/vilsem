import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { LinearAxis } from '@vilsem/core/primitives/linear-axis'
const require = createRequire(import.meta.url)
const echarts = require('../vilsem-renderer/node_modules/echarts')

it('keeps adjacent value tick labels readable at a non-rounded maximum', () => {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 240, height: 200 })
  try {
    const fragment = LinearAxis({ axis: 'x', dataMax: 57809 }, { theme: { textMuted: '#888' } } as any)
    chart.setOption({ animation: false, grid: { left: 30, right: 20, top: 10, bottom: 30 }, ...fragment.option, yAxis: { type: 'category', data: ['A'] }, series: [{ type: 'bar', data: [57809] }] })
    const labels = chart.getZr().storage.getDisplayList(true).filter(t => t.type === 'tspan' && /k$/.test(String(t.style.text)) && !t.ignore && !t.invisible)
    const boxes = labels.map(t => { const b = t.getBoundingRect().clone(); b.applyTransform(t.getComputedTransform()); return b })
    expect(boxes.length).toBeGreaterThan(1)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxes[i].intersect(boxes[j])).toBe(false)
    expect(chart.getModel().getComponent('xAxis').axis.scale.getExtent()[1]).toBe(57809)
  } finally { chart.dispose() }
})
