/**
 * Playground Spike — brutal test, headless portion.
 *
 * Proves the export round-trip WITHOUT the live Electron/Fabric app: a spec that
 * contains `customVisuals` + a `custom` visual is JSON round-tripped (exactly
 * what exportPackage.js writes to app-spec.json and the standalone bundle fetches
 * back), then resolved the SAME way AppSpecRenderer/CompactCustom resolve it —
 * spec.customVisuals[customTemplateId] → instantiateVisual(template, rows, params, theme).
 *
 * This mirrors ui/src/appspec/AppSpecRenderer.jsx (the _customTemplate lookup)
 * and ui/src/appspec/visuals/CompactCustom.jsx (the instantiate call).
 */

import { describe, it, expect } from 'vitest'
import { instantiateVisual, buildThemeContext } from '../ui/src/playground/instantiate.js'
import { EXAMPLE_TEMPLATES, lollipop } from '../ui/src/playground/examples/index.js'

// Replicates CompactCustom's resolution given a spec + a visual + rows + theme.
function resolveCustomVisual(spec, visual, rows) {
  const template = spec.customVisuals?.[visual.customTemplateId]
  const tokens = { textPrimary: '#fff', textMuted: '#888', gridStroke: '#222' }
  const theme = buildThemeContext(tokens, visual.config?.colorScheme)
  return instantiateVisual({ template, rows, params: visual.config || {}, theme })
}

describe('export round-trip — spec.customVisuals travels inside app-spec.json', () => {
  // A dashboard authored with a saved custom template, dropped on the canvas.
  const spec = {
    version: '1.0',
    title: 'Custom Visual Export',
    theme: { mode: 'dark' },
    layout: { freeform: true },
    customVisuals: { lollipop },
    pages: [{
      id: 'page_1', name: 'Page 1', slicers: [],
      visuals: [{
        id: 'v_1', type: 'custom', customTemplateId: 'lollipop',
        position: { x: 0, y: 0, w: 6, h: 4 },
        data: { measures: ['Revenue'], groupBy: { table: 'Product', column: 'Category' } },
        config: { title: 'Revenue by Category', colorScheme: 'blue', dotSize: 16 },
      }],
    }],
  }

  it('the template survives the JSON write/fetch the export performs', () => {
    // exportPackage.js: fs.writeFileSync(..., JSON.stringify(spec)) ; standalone: fetch().json()
    const roundTripped = JSON.parse(JSON.stringify(spec))
    expect(roundTripped.customVisuals.lollipop.meta.id).toBe('lollipop')
    // no functions were serialized (templates are pure JSON)
    expect(roundTripped).toEqual(spec)
  })

  it('the standalone renderer resolves + instantiates it to a valid ECharts option', () => {
    const roundTripped = JSON.parse(JSON.stringify(spec))
    const visual = roundTripped.pages[0].visuals[0]
    const rows = [
      { _cat: 'Bikes', _val: 4200 },
      { _cat: 'Helmets', _val: 1800 },
      { _cat: 'Tires', _val: 950 },
    ]
    const { option, warnings } = resolveCustomVisual(roundTripped, visual, rows)
    expect(warnings.filter(w => /unknown|undeclared|more measures/.test(w))).toEqual([])
    expect(option.series[0].data).toEqual([4200, 1800, 950])           // stems
    expect(option.series[1].data).toEqual([['Bikes', 4200], ['Helmets', 1800], ['Tires', 950]]) // dots
    expect(option.series[1].symbolSize).toBe(16)                       // param from config
    expect(option.xAxis.data).toEqual(['Bikes', 'Helmets', 'Tires'])  // category axis
  })

  it('theme tokens reach the option (palette applied from the visual colorScheme)', () => {
    const visual = spec.pages[0].visuals[0]
    const { option } = resolveCustomVisual(spec, visual, [{ _cat: 'A', _val: 10 }])
    const blueTheme = buildThemeContext({}, 'blue')
    expect(option.series[0].itemStyle.color).toBe(blueTheme.palette[0]) // #3B82F6-family
    expect(option.series[0].itemStyle.color).not.toBe('#14B8A6')        // not the teal default
  })
})

describe('slot contract, not instance — one template, two different field bindings', () => {
  const spec = {
    customVisuals: { lollipop },
    pages: [{
      visuals: [
        { id: 'a', type: 'custom', customTemplateId: 'lollipop', config: { colorScheme: 'blue' },
          data: { measures: ['Revenue'], groupBy: { table: 'Product', column: 'Category' } } },
        { id: 'b', type: 'custom', customTemplateId: 'lollipop', config: { colorScheme: 'blue' },
          data: { measures: ['Units'], groupBy: { table: 'Geo', column: 'Region' } } },
      ],
    }],
  }
  it('renders each instance against its own data through the shared template', () => {
    const a = resolveCustomVisual(spec, spec.pages[0].visuals[0], [{ _cat: 'Bikes', _val: 100 }, { _cat: 'Tires', _val: 40 }])
    const b = resolveCustomVisual(spec, spec.pages[0].visuals[1], [{ _cat: 'West', _val: 7 }, { _cat: 'East', _val: 9 }, { _cat: 'North', _val: 3 }])
    expect(a.option.xAxis.data).toEqual(['Bikes', 'Tires'])
    expect(b.option.xAxis.data).toEqual(['West', 'East', 'North'])
    expect(a.option.series[0].data).toEqual([100, 40])
    expect(b.option.series[0].data).toEqual([7, 9, 3])
  })
})

describe('every starter export-resolves cleanly', () => {
  for (const tpl of EXAMPLE_TEMPLATES) {
    it(`${tpl.meta.name} resolves via the export path`, () => {
      const spec = { customVisuals: { [tpl.meta.id]: tpl } }
      const visual = { type: 'custom', customTemplateId: tpl.meta.id, config: {} }
      const rows = [{ _cat: 'X', _val: 5, _val2: 3 }, { _cat: 'Y', _val: 8, _val2: 6 }]
      const { option } = resolveCustomVisual(JSON.parse(JSON.stringify(spec)), visual, rows)
      // series-bearing OR graphic-only (KPI cards)
      expect((Array.isArray(option.series) && option.series.length > 0) || !!option.graphic).toBe(true)
      expect(JSON.stringify(option).includes('"$')).toBe(false) // no unresolved tokens
    })
  }
})
