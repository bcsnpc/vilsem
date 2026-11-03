/**
 * Render-path parity test for cross-cutting visual features.
 *
 * This test enforces the rule from
 * memory/feedback_systematic_updates.md (2026-04-20): every config-driven
 * feature must be respected in EVERY render path, not patched one-by-one.
 *
 * Current coverage — Axis Switcher. Add new feature checks below as we DRY
 * them into shared helpers.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const REPO = path.resolve(__dirname, '..')
const APP_SPEC_RENDERER = fs.readFileSync(path.join(REPO, 'ui/src/appspec/AppSpecRenderer.jsx'), 'utf-8')
const CANVAS_EDITOR     = fs.readFileSync(path.join(REPO, 'ui/src/appspec/CanvasEditor.jsx'),     'utf-8')
const AXIS_PILLS        = fs.readFileSync(path.join(REPO, 'ui/src/appspec/AxisSwitchPills.jsx'),  'utf-8')
const PBIVIZ_BAR_DAX    = fs.readFileSync(path.join(REPO, 'ui/src/pages/powerbi/daxTemplateBuilder.js'), 'utf-8')
const INSPECTOR         = fs.readFileSync(path.join(REPO, 'ui/src/appspec/VisualInspector.jsx'),  'utf-8')
const GEN_PROMPT_FILE   = fs.readFileSync(path.join(REPO, 'electron/ipc/llm.js'),                 'utf-8')

describe('Axis Switcher — render-path parity', () => {

  it('AxisSwitchPills component exists as the single source of truth', () => {
    expect(AXIS_PILLS).toMatch(/export default function AxisSwitchPills/)
    expect(AXIS_PILLS).toMatch(/export function getEffectiveGroupBy/)
    expect(AXIS_PILLS).toMatch(/data-axis-switch-pills/)
  })

  it('AppSpecRenderer imports AxisSwitchPills and uses it in all 3 branches (edit + freeform-view + section-view)', () => {
    expect(APP_SPEC_RENDERER).toMatch(/import\s+AxisSwitchPills\s*,\s*\{\s*getEffectiveGroupBy\s*\}/)
    // Should appear exactly 3× as a JSX component — edit mode, freeform view, section view.
    const matches = APP_SPEC_RENDERER.match(/<AxisSwitchPills\b/g) || []
    expect(matches.length).toBe(3)
  })

  it('CanvasEditor imports and uses AxisSwitchPills', () => {
    expect(CANVAS_EDITOR).toMatch(/import\s+AxisSwitchPills\s*,\s*\{\s*getEffectiveGroupBy\s*\}/)
    const matches = CANVAS_EDITOR.match(/<AxisSwitchPills\b/g) || []
    expect(matches.length).toBe(1)
  })

  it('No render path inlines axisOptions.map pills (everything goes through AxisSwitchPills)', () => {
    // Earlier failure mode: each path had its own axisOptions.map(...)
    // rendering buttons inline. If any survives, this catches it.
    const inlineAppRenderer = (APP_SPEC_RENDERER.match(/\baxisOpts\.map\b/g) || []).length
    const inlineCanvas      = (CANVAS_EDITOR.match(/\baxisOpts\.map\b/g) || []).length
    expect(inlineAppRenderer).toBe(0)
    expect(inlineCanvas).toBe(0)
  })

  it('effectiveGroupBy is derived through the shared helper, not hand-written everywhere', () => {
    // Count usages of the helper. Should be ≥3 in AppSpecRenderer (edit/freeform/section)
    // and ≥1 in CanvasEditor. Hand-written `axisOverrides[…].table && axisOverrides[…].column`
    // checks are discouraged.
    const helperUsesRenderer = (APP_SPEC_RENDERER.match(/getEffectiveGroupBy\(/g) || []).length
    const helperUsesCanvas   = (CANVAS_EDITOR.match(/getEffectiveGroupBy\(/g) || []).length
    expect(helperUsesRenderer).toBeGreaterThanOrEqual(3)
    expect(helperUsesCanvas).toBeGreaterThanOrEqual(1)
  })

  it('PBI DAX emits axis-switch pills + per-axis sections when axisOptions has 2+ entries', () => {
    // Axis switcher works in PBI via pre-computed multi-axis DAX output:
    // one _barHtml<N> per axis, all wrapped in <div data-axis-section="N">,
    // toggled client-side by wireAxisPills() in visual.ts on pill click.
    expect(PBIVIZ_BAR_DAX).toMatch(/sbar-axis-pills/)
    expect(PBIVIZ_BAR_DAX).toMatch(/data-axis-section/)
    expect(PBIVIZ_BAR_DAX).toMatch(/data-axis-idx/)
    expect(PBIVIZ_BAR_DAX).toMatch(/_barHtml\$\{idx\}|_barHtml\$\{i\}|axisVarBlocks/)
  })

  it('visual.ts has wireAxisPills to toggle sections on pill click', () => {
    const visualTs = fs.readFileSync(path.join(REPO, 'vilsem-renderer/src/visual.ts'), 'utf-8')
    expect(visualTs).toMatch(/wireAxisPills/)
    expect(visualTs).toMatch(/data-axis-section/)
    expect(visualTs).toMatch(/data-axis-idx/)
  })

  it('bound alternate axes use field-specific selection identities without a JSON-filter side effect', () => {
    const visualTs = fs.readFileSync(path.join(REPO, 'vilsem-renderer/src/visual.ts'), 'utf-8')
    expect(visualTs).toMatch(/boundHtmlAxisSelection\(cat, sectionEl!, catName\)/)
    expect(visualTs).toMatch(/withCategory\(category, index\)/)
    expect(visualTs).not.toMatch(/this\.host\.applyJsonFilter\(/)
    // Runtime cases in power-bi-selection-runtime.test.ts verify matching field
    // identity, identical labels across dimensions, modifiers, and safe fallback.
    // This is not an assertion that the exporter binds alternate axes yet.
  })

  it('DAX emits axis table+column on each section for bound-field identity matching', () => {
    expect(PBIVIZ_BAR_DAX).toMatch(/data-axis-table/)
    expect(PBIVIZ_BAR_DAX).toMatch(/data-axis-column/)
  })

  it('VisualInspector has an axis-switcher editor (inspector parity)', () => {
    expect(INSPECTOR).toMatch(/AxisSwitcherEditor/)
    expect(INSPECTOR).toMatch(/categoryColumnOptions/)
  })

  it('Both LLM system prompts mention axisOptions (generation + refinement prompt parity)', () => {
    // Generation prompt should have axis_switch_rules
    expect(GEN_PROMPT_FILE).toMatch(/<axis_switch_rules>/)
    // Refinement prompt should have an "add axis toggle" pattern
    expect(GEN_PROMPT_FILE).toMatch(/add axis toggle|axis toggle|axisOptions/)
  })
})
