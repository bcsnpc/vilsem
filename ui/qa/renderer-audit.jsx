// Audit-only Vite entry. Imports production renderers; never enters production bundles.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { VISUAL_MAP } from '../src/appspec/visuals/index.js'
import VisualBoundary from '../src/appspec/shared/VisualBoundary.jsx'
import getThemeTokens from '../src/appspec/getThemeTokens'
import { validateAppSpec } from '../src/appspec/schema.js'
import { normalizeLayout } from '../src/appspec/shared/layout.js'
import customDonut from '../src/playground/examples/donut.vilsem-visual.json'
import '../src/index.css'
import '../src/ui/tokens.css'
import '../src/ui/components.css'

const root = createRoot(document.getElementById('audit-root'))
const standard = ['North', 'South', 'East', 'West'].map((name, i) => ({ _cat: name, _val: (i + 1) * 25, _val2: (i + 1) * 15, _val3: (i + 1) * 5, _frame: '2026-01' }))
const fixtures = {
  standard,
  empty: [],
  zero: standard.map(r => ({ ...r, _val: 0, _val2: 0, _val3: 0 })),
  mixed: standard.map((r, i) => ({ ...r, _val: [-100, 0, 0.000001, 1e12][i] })),
  nulls: standard.map((r, i) => ({ ...r, _cat: i ? r._cat : null, _val: i % 2 ? null : r._val })),
  long: Array.from({ length: 120 }, (_, i) => ({ _cat: `Category ${i} — 日本語 Ω & <text> ${'Long label '.repeat(8)}`, _val: i + 1, _val2: 121 - i, _val3: i + 2 })),
}
const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))
window.qaInventory = Object.fromEntries(Object.entries(VISUAL_MAP).map(([type, Component]) => [type, { fields: Component.schema || [] }]))
window.qaRun = async (fixture, width, height) => {
  const rows = fixtures[fixture]
  flushSync(() => root.render(<div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${width + 16}px)`, gap: 12, padding: 12, background: '#f1f5f9' }}>
    {Object.entries(VISUAL_MAP).map(([type, Component]) => <section key={type}>
      <div style={{ height: 24, fontSize: 12 }}>{type} / {fixture} / {width}×{height}</div>
      <div data-visual={type} style={{ width, height, position: 'relative', background: '#fff', color: '#1e293b', border: '1px solid #94a3b8' }}>
        <VisualBoundary resetKey={`${fixture}:${width}:${height}`}>
          <Component rows={type === 'bar_race' ? rows.map((r, i) => ({ ...r, _cats: [`2026-0${i % 2 + 1}`, r._cat] })) : rows} loading={false} error={null} groupBy={{ table: 'QA', column: 'Category' }} config={{
            type, _customTemplate: type === 'custom' ? customDonut : undefined,
            _T: getThemeTokens('light'), _cardPixelHeight: height, measureName: 'Revenue', secondaryMeasureName: 'Cost',
            animations: false, animationEnabled: false, animationDuration: 0, title: 'Synthetic audit',
            _onBarClick: category => { window.qaLastSelection = { type, category } },
          }} />
        </VisualBoundary>
      </div>
    </section>)}
  </div>))
  await frames()
  return [...document.querySelectorAll('[data-visual]')].map(el => ({
    type: el.dataset.visual, fixture, width, height,
    text: el.innerText.slice(0, 350),
    errorBoundary: el.innerText.includes('Visual error'),
    canvases: el.querySelectorAll('canvas').length, svgs: el.querySelectorAll('svg').length,
    scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight,
    overflowCandidate: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
  }))
}
window.qaContracts = () => {
  const base = { version: '1.0', title: 'QA', visuals: [{ id: 'qa', type: 'custom', position: { x: 0, y: 0, w: 6, h: 4 }, data: { measures: ['Revenue'] }, config: {} }] }
  const table = { ...base, visuals: [{ ...base.visuals[0], type: 'table', data: { measures: [], dimensions: [{ table: 'QA', column: 'Category' }] } }] }
  return {
    customValidation: validateAppSpec(base),
    dimensionOnlyTableValidation: validateAppSpec(table),
    dimensionOnlyTableAfterNormalize: normalizeLayout(table).visuals,
  }
}
window.qaReady = true
