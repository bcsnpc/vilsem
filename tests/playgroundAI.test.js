/**
 * Playground Spike — Phase 7 AI layer tests.
 * Run: npm test -- playgroundAI
 *
 * Covers the pure/testable parts of the generate-refine driver: fence stripping,
 * JSON parsing, prompt composition, and the validate→retry-once loop (mocking the
 * BYO-key provider IPC). No live LLM calls — the ten-prompt trial is manual (§8.3).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  stripFences, parseTemplateResponse, composeSystemPrompt, composeUserMessage, generateTemplate,
} from '../ui/src/playground/playgroundAI.js'
import { lollipop } from '@vilsem/core/templates/examples'

describe('stripFences', () => {
  it('strips ```json fences', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('strips bare ``` fences', () => {
    expect(stripFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('extracts the JSON body when prose leaks around it', () => {
    expect(stripFences('Sure! Here it is:\n{"a":1}\nHope that helps!')).toBe('{"a":1}')
  })
  it('leaves clean JSON untouched', () => {
    expect(stripFences('{"a":1}')).toBe('{"a":1}')
  })
})

describe('parseTemplateResponse', () => {
  it('parses valid JSON after stripping fences', () => {
    const r = parseTemplateResponse('```json\n{"meta":{"id":"x"}}\n```')
    expect(r.template).toEqual({ meta: { id: 'x' } })
    expect(r.jsonError).toBeNull()
  })
  it('returns the cleaned text + a jsonError on invalid JSON', () => {
    const r = parseTemplateResponse('{ not json')
    expect(r.template).toBeNull()
    expect(r.jsonError).toBeTruthy()
    expect(r.text).toBe('{ not json')
  })
})

describe('composeSystemPrompt / composeUserMessage', () => {
  it('create prompt states the hard constraints, no REFINE section', () => {
    const s = composeSystemPrompt('create')
    expect(s).not.toMatch(/REFINE MODE/)
    expect(s).toMatch(/AT MOST TWO slots of kind "dimension" or "time"/)
    expect(s).toMatch(/at least one "measure" slot/)
    expect(s).toMatch(/DECLARATIVE ONLY/)
    expect(s).toMatch(/lastLabel/) // the static-text accessor is taught
  })
  it('refine prompt appends the REFINE MODE section with meta.id preservation', () => {
    const s = composeSystemPrompt('refine')
    expect(s).toMatch(/REFINE MODE/)
    expect(s).toMatch(/meta\.id/)
  })
  it('create user message carries the description only', () => {
    const m = composeUserMessage({ mode: 'create', instruction: 'a bar chart of sales' })
    expect(m).toMatch(/a bar chart of sales/)
    expect(m).not.toMatch(/current template/)
  })
  it('refine user message embeds the current template + instruction', () => {
    const m = composeUserMessage({ mode: 'refine', instruction: 'make it horizontal', currentTemplate: lollipop })
    expect(m).toMatch(/current template/)
    expect(m).toMatch(/"id": "lollipop"/)
    expect(m).toMatch(/make it horizontal/)
  })
})

describe('generateTemplate — validate + retry-once loop (mocked provider)', () => {
  const good = { meta: { id: 'g', name: 'G' }, slots: { v: { kind: 'measure', count: 1 } }, template: { series: [{ type: 'bar', data: '$slot.v.values' }] } }
  const bad = { meta: { id: 'b' }, slots: { d: { kind: 'nope' } }, template: {} } // bad kind + no measure slot

  beforeEach(() => { global.window = { semantica: {} } })

  it('passes on the first try for a valid template — no retry', async () => {
    window.semantica.generateCustomTemplate = vi.fn(async () => ({ template: good, provider: 'anthropic', model: 'm' }))
    const r = await generateTemplate({ mode: 'create', instruction: 'x' })
    expect(window.semantica.generateCustomTemplate).toHaveBeenCalledTimes(1)
    expect(r.ok).toBe(true)
    expect(r.retried).toBe(false)
    expect(r.template.meta.id).toBe('g')
  })

  it('retries ONCE with the validator complaint, then succeeds', async () => {
    let n = 0
    const userMsgs = []
    window.semantica.generateCustomTemplate = vi.fn(async (p) => { userMsgs.push(p.user); n++; return { template: n === 1 ? bad : good } })
    const r = await generateTemplate({ mode: 'create', instruction: 'x' })
    expect(window.semantica.generateCustomTemplate).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(true)
    expect(r.retried).toBe(true)
    expect(userMsgs[1]).toMatch(/failed validation/) // the complaint was fed back
  })

  it('never loops more than once — a second failure surfaces honestly with JSON in the editor', async () => {
    window.semantica.generateCustomTemplate = vi.fn(async () => ({ template: bad }))
    const r = await generateTemplate({ mode: 'create', instruction: 'x' })
    expect(window.semantica.generateCustomTemplate).toHaveBeenCalledTimes(2) // 1 + 1 retry, no more
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/"id": "b"/) // the invalid template still lands in the editor for manual fixes
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('refine round-trips: current template in → modified template (meta.id preserved) out', async () => {
    const modified = { meta: { id: 'g', name: 'G' }, slots: { v: { kind: 'measure', count: 1 } }, template: { series: [{ type: 'line', data: '$slot.v.values' }] } }
    let captured
    window.semantica.generateCustomTemplate = vi.fn(async (p) => { captured = p; return { template: modified } })
    const r = await generateTemplate({ mode: 'refine', instruction: 'make it a line', currentTemplate: good })
    expect(r.ok).toBe(true)
    expect(captured.system).toMatch(/REFINE MODE/)
    expect(captured.user).toMatch(/"id": "g"/)       // current template embedded in the turn
    expect(r.template.meta.id).toBe('g')             // id preserved
    expect(r.template.template.series[0].type).toBe('line') // instruction applied
  })

  it('handles a raw-text (fenced) response with no pre-parsed template', async () => {
    window.semantica.generateCustomTemplate = vi.fn(async () => ({ text: '```json\n' + JSON.stringify(good) + '\n```' }))
    const r = await generateTemplate({ mode: 'create', instruction: 'x' })
    expect(r.ok).toBe(true)
    expect(r.template.meta.id).toBe('g')
  })

  it('surfaces a provider error (e.g. no key) without crashing', async () => {
    window.semantica.generateCustomTemplate = vi.fn(async () => { throw new Error('No AI provider configured') })
    const r = await generateTemplate({ mode: 'create', instruction: 'x' })
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/No AI provider configured/)
  })
})
