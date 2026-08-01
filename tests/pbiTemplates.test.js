/**
 * Unit tests for the Power BI HTML templates.
 *
 * Each template takes (visual, queryResult, theme) and returns a self-contained
 * HTML string that gets embedded in a Power BI HTML Content visual. These tests
 * don't hit Fabric or render in a browser — they verify the HTML string shape.
 *
 * Run: npm test -- pbiTemplates
 */

import { describe, it, expect } from 'vitest'
import { renderVisualToHtml } from '../ui/src/pages/powerbi/htmlTemplates/index.js'

const baseVisual = (overrides = {}) => ({
  id:        'v1',
  type:      'kpi',
  measures:  ['Total Revenue'],
  dimension: null,
  config:    { title: 'Test', colorScheme: 'teal' },
  ...overrides,
})

const scalarResult = (measureName, value) => ({
  data: { [measureName]: value },
})

const groupedResult = (catKey, measureKey, rows) => ({
  rows: rows.map((r) => ({ [catKey]: r.cat, [measureKey]: r.val, ...r.extras })),
})

describe('renderVisualToHtml — common shell', () => {
  it('wraps every output in position:absolute inset:0 card', () => {
    const html = renderVisualToHtml(baseVisual(), scalarResult('Total Revenue', 123), 'dark')
    expect(html).toContain('position: absolute')
    expect(html).toContain('inset: 0')
  })

  it('includes the accent left-edge strip', () => {
    const html = renderVisualToHtml(baseVisual(), scalarResult('Total Revenue', 1), 'dark')
    // wrapCard renders the 3px left accent
    expect(html).toMatch(/width:\s*3px/)
  })

  it('falls back for unknown visual types', () => {
    const html = renderVisualToHtml(
      baseVisual({ type: 'nonexistent_type' }),
      scalarResult('Total Revenue', 1),
      'dark',
    )
    expect(html).toContain('📊')          // fallback card icon
    expect(html).toContain('nonexistent_type')
  })

  it('never throws on null queryResult', () => {
    expect(() => renderVisualToHtml(baseVisual(), null, 'dark')).not.toThrow()
  })
})

describe('renderVisualToHtml — kpi', () => {
  it('renders the formatted value', () => {
    const html = renderVisualToHtml(baseVisual(), scalarResult('Total Revenue', 24_910_000), 'dark')
    expect(html).toContain('24.91M')
  })
  it('renders the title', () => {
    const html = renderVisualToHtml(
      baseVisual({ config: { title: 'Quarterly Sales', colorScheme: 'teal' } }),
      scalarResult('Total Revenue', 1), 'dark',
    )
    expect(html).toContain('Quarterly Sales')
  })
  it('uses the teal color by default', () => {
    const html = renderVisualToHtml(baseVisual(), scalarResult('Total Revenue', 1), 'dark')
    expect(html).toMatch(/#14B8A6/i)
  })
})

describe('renderVisualToHtml — bar', () => {
  it('renders rows with category labels', () => {
    const result = groupedResult('Region', 'Total Revenue', [
      { cat: 'East',  val: 100 },
      { cat: 'West',  val: 80 },
      { cat: 'North', val: 60 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'bar', dimension: 'Region[Name]' }),
      result, 'dark',
    )
    expect(html).toContain('East')
    expect(html).toContain('West')
    expect(html).toContain('North')
  })
})

describe('renderVisualToHtml — stacked_bar', () => {
  it('renders with 2 measures and a legend', () => {
    const result = {
      rows: [
        { Region: 'East', 'Total Revenue': 100, 'Total Profit': 20 },
        { Region: 'West', 'Total Revenue': 80,  'Total Profit': 15 },
      ],
    }
    const html = renderVisualToHtml(
      baseVisual({
        type: 'stacked_bar',
        measures: ['Total Revenue', 'Total Profit'],
        dimension: 'Region[Name]',
        config:   { measureName: 'Revenue', secondaryMeasureName: 'Profit', colorScheme: 'teal' },
      }),
      result, 'dark',
    )
    expect(html).toContain('Revenue')
    expect(html).toContain('Profit')
  })
})

describe('renderVisualToHtml — gauge', () => {
  it('emits an SVG arc path and the formatted value', () => {
    const html = renderVisualToHtml(
      baseVisual({ type: 'gauge', config: { title: 'Gauge', minValue: 0, maxValue: 100, colorScheme: 'teal' } }),
      scalarResult('Total Revenue', 50),
      'dark',
    )
    expect(html).toContain('<svg')
    expect(html).toMatch(/<path d="M\s+/)   // starts an SVG arc
  })
})

describe('renderVisualToHtml — radar', () => {
  it('renders a polygon with grid levels', () => {
    const result = groupedResult('Category', 'Score', [
      { cat: 'A', val: 30 }, { cat: 'B', val: 50 }, { cat: 'C', val: 80 }, { cat: 'D', val: 60 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'radar', measures: ['Score'], dimension: 'Category[Name]' }),
      result, 'dark',
    )
    expect(html).toContain('<svg')
    expect(html).toMatch(/<path d=".*Z"/)    // closed data polygon path
  })
})

describe('renderVisualToHtml — scatter', () => {
  it('renders circles for each row', () => {
    const result = {
      rows: [
        { Cat: 'A', 'Measure1': 10, 'Measure2': 20 },
        { Cat: 'B', 'Measure1': 15, 'Measure2': 25 },
      ],
    }
    const html = renderVisualToHtml(
      baseVisual({
        type: 'scatter',
        measures: ['Measure1', 'Measure2'],
        dimension: 'Cat[Name]',
      }),
      result, 'dark',
    )
    const circleCount = (html.match(/<circle/g) || []).length
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })
})

describe('renderVisualToHtml — treemap', () => {
  it('renders rects proportional to values', () => {
    const result = groupedResult('Product', 'Sales', [
      { cat: 'A', val: 100 }, { cat: 'B', val: 60 }, { cat: 'C', val: 40 }, { cat: 'D', val: 20 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'treemap', measures: ['Sales'], dimension: 'Product[Name]' }),
      result, 'dark',
    )
    expect(html).toContain('<rect')
    const rectCount = (html.match(/<rect/g) || []).length
    expect(rectCount).toBeGreaterThanOrEqual(4)
  })

  it('handles empty data gracefully', () => {
    const html = renderVisualToHtml(
      baseVisual({ type: 'treemap', measures: ['x'], dimension: 'y[z]' }),
      { rows: [] }, 'dark',
    )
    expect(html).toContain('No data')
  })
})

describe('renderVisualToHtml — funnel', () => {
  it('renders stage rows with percentage bars', () => {
    const result = groupedResult('Stage', 'Count', [
      { cat: 'Visit',    val: 1000 },
      { cat: 'Signup',   val: 400 },
      { cat: 'Purchase', val: 100 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'funnel', measures: ['Count'], dimension: 'Stage[Name]' }),
      result, 'dark',
    )
    expect(html).toContain('Visit')
    expect(html).toContain('Signup')
    expect(html).toContain('Purchase')
  })
})

describe('renderVisualToHtml — table', () => {
  it('renders a header and row per entry', () => {
    const result = groupedResult('Product', 'Sales', [
      { cat: 'A', val: 100 }, { cat: 'B', val: 80 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'table', measures: ['Sales'], dimension: 'Product[Name]' }),
      result, 'dark',
    )
    expect(html).toContain('A')
    expect(html).toContain('B')
  })
})

describe('renderVisualToHtml — line / area', () => {
  it('line renders an SVG path', () => {
    const result = groupedResult('Date', 'Rev', [
      { cat: '2024-01', val: 10 }, { cat: '2024-02', val: 15 }, { cat: '2024-03', val: 20 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'line', measures: ['Rev'], dimension: 'Date[Month]' }),
      result, 'dark',
    )
    expect(html).toContain('<svg')
    expect(html).toContain('<path')
  })

  it('area renders the gradient fill', () => {
    const result = groupedResult('Date', 'Rev', [
      { cat: '2024-01', val: 10 }, { cat: '2024-02', val: 20 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'area', measures: ['Rev'], dimension: 'Date[Month]' }),
      result, 'dark',
    )
    expect(html).toMatch(/<linearGradient/)
    expect(html).toMatch(/fill="url\(#lineGrad\)"/)
  })
})

describe('renderVisualToHtml — donut', () => {
  it('renders donut for multi-category data', () => {
    const result = groupedResult('Cat', 'Val', [
      { cat: 'A', val: 30 }, { cat: 'B', val: 40 }, { cat: 'C', val: 30 },
    ])
    const html = renderVisualToHtml(
      baseVisual({ type: 'donut', measures: ['Val'], dimension: 'Cat[Name]' }),
      result, 'dark',
    )
    expect(html).toContain('<svg')
  })
})

describe('color scheme propagation', () => {
  it('gold scheme changes accent color', () => {
    const html = renderVisualToHtml(
      baseVisual({ config: { colorScheme: 'gold', title: 'Gold KPI' } }),
      scalarResult('Total Revenue', 1), 'dark',
    )
    // teal should NOT be the dominant accent
    // (exact gold palette hex varies; we just assert it's not the default teal left-strip)
    expect(html).not.toMatch(/linear-gradient\(180deg, #14B8A6, #14B8A655\)/)
  })
})
