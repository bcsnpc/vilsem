/**
 * Unit tests for the AppSpec → Power BI pages mapper.
 * Run: npm test -- appSpecToPowerBI
 */

import { describe, it, expect } from 'vitest'
import { mapAppSpecToPages, filterRenderablePages } from '../ui/src/pages/AppSpecToPowerBI.js'
import { buildHtmlContentReportParts } from '../ui/src/pages/powerbi/reportBuilder_htmlcontent.js'

const sampleSpec = {
  version: '1.0',
  title:   'Sales Overview',
  layout:  { columns: 12, rowHeight: 80, gap: 8 },
  visuals: [
    {
      id: 'kpi_1', type: 'kpi',
      position: { x: 0, y: 0, w: 3, h: 2 },
      data: { measures: ['Total Revenue'] },
      config: { title: 'Revenue', colorScheme: 'teal' },
    },
    {
      id: 'bar_1', type: 'bar',
      position: { x: 0, y: 2, w: 12, h: 5 },
      data: {
        measures: ['Total Orders'],
        groupBy:  { table: 'Calendar Lookup', column: 'Month' },
        orderBy:  'desc',
        limit:    12,
      },
      config: { title: 'Orders by month' },
    },
    {
      id: 'placeholder', type: 'kpi',
      position: { x: 9, y: 0, w: 3, h: 2 },
      data: { measures: [] },           // no measures — should be filtered
      config: {},
    },
  ],
}

describe('mapAppSpecToPages', () => {
  it('returns a single page with the spec title', () => {
    const pages = mapAppSpecToPages(sampleSpec)
    expect(pages).toHaveLength(1)
    expect(pages[0].name).toBe('Sales Overview')
    expect(pages[0].id).toBe('page_1')
  })

  it('section-based layout: KPIs fill width equally, charts fill full width', () => {
    const pages = mapAppSpecToPages(sampleSpec)
    const kpi = pages[0].visuals.find((v) => v.id === 'kpi_1')
    const bar = pages[0].visuals.find((v) => v.id === 'bar_1')
    // KPI: distributed equally across 1240px content width (1 KPI → full width)
    expect(kpi).toBeTruthy()
    expect(kpi.width).toBeGreaterThan(400)
    // Bar: full width (proportional to its share of the row)
    expect(bar).toBeTruthy()
    expect(bar.width).toBeGreaterThan(1000)
    // Bar is below KPIs
    expect(bar.y).toBeGreaterThan(kpi.y)
    // h=5 → 5*80 + 4*8 = 432
    expect(bar.height).toBe(432)
  })

  it('flattens groupBy.table + column into "Table[Column]" dimension string', () => {
    const pages = mapAppSpecToPages(sampleSpec)
    const bar = pages[0].visuals.find((v) => v.id === 'bar_1')
    expect(bar.dimension).toBe('Calendar Lookup[Month]')
  })

  it('preserves measures, limit, orderBy, config', () => {
    const pages = mapAppSpecToPages(sampleSpec)
    const bar = pages[0].visuals.find((v) => v.id === 'bar_1')
    expect(bar.measures).toEqual(['Total Orders'])
    expect(bar.limit).toBe(12)
    expect(bar.orderBy).toBe('desc')
    expect(bar.config.title).toBe('Orders by month')
  })

  it('handles missing layout with defaults', () => {
    const pages = mapAppSpecToPages({
      title: 'X', visuals: [{
        id: 'v1', type: 'kpi',
        position: { x: 0, y: 1, w: 2, h: 2 },
        data: { measures: ['M'] },
      }],
    })
    // KPI placed at top (section layout puts KPIs first)
    expect(pages[0].visuals[0].y).toBe(20) // chromePad / 2
  })

  it('exposes page width/height on the returned page', () => {
    const pages = mapAppSpecToPages(sampleSpec)
    expect(pages[0].width).toBe(1280)
    expect(pages[0].height).toBe(720)
  })

  it('honors pagePreset=tall', () => {
    const pages = mapAppSpecToPages({
      ...sampleSpec,
      layout: { ...sampleSpec.layout, pagePreset: 'tall' },
    })
    expect(pages[0].width).toBe(1280)
    expect(pages[0].height).toBe(1920)
  })

  it('pagePreset=auto computes page height from content', () => {
    const pages = mapAppSpecToPages({
      ...sampleSpec,
      layout: { ...sampleSpec.layout, pagePreset: 'auto' },
    })
    // Auto-fit: lowest visual bottom + 40 chrome pad
    // bar_1 at y=2 (196px), h=5 (432px) → bottom 628 + 40 = 668
    // but must be >= 480
    expect(pages[0].height).toBeGreaterThanOrEqual(480)
    expect(pages[0].height).toBeGreaterThanOrEqual(668)
  })

  it('honors pagePreset=custom with explicit pageWidth/pageHeight', () => {
    const pages = mapAppSpecToPages({
      ...sampleSpec,
      layout: { ...sampleSpec.layout, pagePreset: 'custom', pageWidth: 1440, pageHeight: 1080 },
    })
    expect(pages[0].width).toBe(1440)
    expect(pages[0].height).toBe(1080)
  })

  it('clamps custom page size to safe min/max', () => {
    const narrow = mapAppSpecToPages({
      ...sampleSpec,
      layout: { ...sampleSpec.layout, pagePreset: 'custom', pageWidth: 100, pageHeight: 100 },
    })
    expect(narrow[0].width).toBeGreaterThanOrEqual(640)
    expect(narrow[0].height).toBeGreaterThanOrEqual(480)
    const huge = mapAppSpecToPages({
      ...sampleSpec,
      layout: { ...sampleSpec.layout, pagePreset: 'custom', pageWidth: 99999, pageHeight: 99999 },
    })
    expect(huge[0].width).toBeLessThanOrEqual(4096)
    expect(huge[0].height).toBeLessThanOrEqual(8192)
  })

  it('returns empty visuals[] when appSpec.visuals is null/undefined', () => {
    const result = mapAppSpecToPages({ title: 'X' })
    expect(result[0].visuals).toEqual([])
  })

  it('throws if appSpec is missing', () => {
    expect(() => mapAppSpecToPages(null)).toThrow()
  })
})

describe('filterRenderablePages', () => {
  it('drops visuals without measures', () => {
    const pages = mapAppSpecToPages(sampleSpec)
    const filtered = filterRenderablePages(pages)
    const ids = filtered[0].visuals.map((v) => v.id)
    expect(ids).toContain('kpi_1')
    expect(ids).toContain('bar_1')
    expect(ids).not.toContain('placeholder')
  })

  it('preserves pages even when all visuals get filtered', () => {
    const pages = [{ id: 'p', name: 'P', visuals: [{ id: 'x', measures: [] }] }]
    const filtered = filterRenderablePages(pages)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].visuals).toHaveLength(0)
  })
})

// Phase 7a — PBI displayOption should switch to FitToWidth for tall pages
// so the Service renders a vertical scrollbar instead of clipping content.
describe('buildHtmlContentReportParts displayOption', () => {
  const minimalVisuals = [{ id: 'v1', type: 'kpi', measures: ['M'], dimension: null, config: {} }]

  it('all pages → FitToWidth (always allows vertical scroll)', () => {
    const parts = buildHtmlContentReportParts({
      originalParts: null,
      pages: [{ id: 'p1', name: 'P', width: 1280, height: 720, visuals: minimalVisuals }],
      datasetId: 'ds', reportName: 'R', workspaceName: 'WS', datasetName: 'DN',
      measuresByVisualId: { v1: '_SemanticaHtml_v1' },
    })
    const pagePart = parts.find((p) => /\/page\.json$/.test(p.path))
    expect(pagePart).toBeTruthy()
    const pageJson = JSON.parse(pagePart.content)
    expect(pageJson.displayOption).toBe('FitToWidth')
    expect(pageJson.width).toBe(1280)
  })

  it('tall page preserves height', () => {
    const parts = buildHtmlContentReportParts({
      originalParts: null,
      pages: [{ id: 'p1', name: 'P', width: 1280, height: 1920, visuals: minimalVisuals }],
      datasetId: 'ds', reportName: 'R', workspaceName: 'WS', datasetName: 'DN',
      measuresByVisualId: { v1: '_SemanticaHtml_v1' },
    })
    const pagePart = parts.find((p) => /\/page\.json$/.test(p.path))
    const pageJson = JSON.parse(pagePart.content)
    expect(pageJson.displayOption).toBe('FitToWidth')
    expect(pageJson.height).toBe(1920)
  })

  // Phase 9a — Report Page Tooltips removed: HTML Content (lite) visual
  // does NOT support the PBI tooltip API. Tests removed to match.
})
