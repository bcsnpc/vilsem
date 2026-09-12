/**
 * Unit tests for the TMDL measure injector.
 * Run: npm test -- tmdlInjector
 */

import { describe, it, expect } from 'vitest'
import {
  measureNameForVisual,
  buildSemanticaGeneratedTable,
  rewriteTmdlPartsWithSemanticaTable,
  mergeTmdlPartsWithLiveDax,
} from '../ui/src/pages/powerbi/tmdlMeasureInjector.js'

describe('mergeTmdlPartsWithLiveDax — retains other reports\' measures', () => {
  // Report A already published a measure into _SemanticaGenerated on this dataset.
  const reportAName = measureNameForVisual('reportA_visualX_02m3sg9')
  const originalParts = [
    {
      path: 'definition/tables/_SemanticaGenerated.tmdl',
      content: [
        'table _SemanticaGenerated',
        '\tlineageTag: aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        '',
        `\tmeasure ${reportAName} = \`\`\``,
        '\t\t\t',
        '\t\t\tCALCULATE([Sales])',
        '\t\t\t',
        '\t\t\t\`\`\`',
        '\t\tlineageTag: bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        '',
        '\tpartition _SemanticaGenerated-cccccccc = m',
        '\t\tmode: import',
        '',
      ].join('\n'),
    },
    { path: 'definition/model.tmdl', content: 'model' },
  ]

  it('keeps report A\'s measure when publishing report B', () => {
    const { parts, measuresByVisualId } = mergeTmdlPartsWithLiveDax(originalParts, { reportB_visualY_9zzz: 'CALCULATE([Profit])' })
    const gen = parts.find(p => p.path === 'definition/tables/_SemanticaGenerated.tmdl')
    // Report A's measure survives (the bug was that it got wiped).
    expect(gen.content).toContain(reportAName)
    // Report B's new measure is added.
    expect(gen.content).toContain(measuresByVisualId.reportB_visualY_9zzz)
    // Partition preserved.
    expect(gen.content).toContain('partition _SemanticaGenerated-')
  })

  it('re-publishing the SAME report overwrites its own measure, not duplicates it', () => {
    const first = mergeTmdlPartsWithLiveDax(originalParts, { reportA_visualX_02m3sg9: 'CALCULATE([SalesV2])' })
    const gen = first.parts.find(p => p.path === 'definition/tables/_SemanticaGenerated.tmdl')
    const occurrences = gen.content.split(`measure ${reportAName} =`).length - 1
    expect(occurrences).toBe(1)
  })
})

describe('measureNameForVisual', () => {
  it('uses a sanitized prefix and stable collision-resistant suffix', () => {
    const name = measureNameForVisual('abcd1234-e567-890f-ghij-klmnopqrstuv')
    expect(name.startsWith('_SemanticaHtml_')).toBe(true)
    expect(name).toMatch(/^_SemanticaHtml_[A-Za-z0-9]{1,16}_[a-z0-9]{7,8}$/)
    expect(name).toBe(measureNameForVisual('abcd1234-e567-890f-ghij-klmnopqrstuv'))
    // Same truncated clean prefix must not collapse distinct authored IDs.
    expect(measureNameForVisual('abcdefghijklmnop-copy-one')).not.toBe(measureNameForVisual('abcdefghijklmnop-copy-two'))
    expect(measureNameForVisual('a-b')).not.toBe(measureNameForVisual('ab'))
  })
  it('handles empty/null ids without throwing', () => {
    expect(() => measureNameForVisual(null)).not.toThrow()
    expect(() => measureNameForVisual('')).not.toThrow()
    const name = measureNameForVisual('')
    expect(name.startsWith('_SemanticaHtml_')).toBe(true)
  })
})

describe('buildSemanticaGeneratedTable', () => {
  it('produces a TMDL file with one measure per visual', () => {
    const result = buildSemanticaGeneratedTable({
      'v-1': '<div>a</div>',
      'v-2': '<div>b</div>',
    })
    expect(result.path).toBe('definition/tables/_SemanticaGenerated.tmdl')
    expect(result.tableName).toBe('_SemanticaGenerated')
    expect(Object.keys(result.measuresByVisualId).length).toBe(2)
    // Each measure appears once in the content
    for (const name of Object.values(result.measuresByVisualId)) {
      expect(result.content).toContain(`measure ${name}`)
    }
  })

  it('escapes double-quotes inside HTML for DAX string literals', () => {
    const result = buildSemanticaGeneratedTable({
      'v-1': '<div style="color:red">x</div>',
    })
    // DAX escape: " → ""
    expect(result.content).toContain('""color:red""')
  })

  it('wraps measure bodies in triple-backticks (TMDL multi-line block)', () => {
    const result = buildSemanticaGeneratedTable({ 'v-1': '<p>hi</p>' })
    expect(result.content).toContain('```')
  })

  it('strips control characters from HTML', () => {
    const dirty = '<p>\x00\x01\x02hello</p>'
    const result = buildSemanticaGeneratedTable({ 'v-1': dirty })
    // Sanity: no raw control chars leaked
    expect(result.content).not.toMatch(/[\x00-\x08]/)
  })

  it('is idempotent — repeat call with same input yields identical measure names (modulo uuids)', () => {
    const r1 = buildSemanticaGeneratedTable({ 'abc': '<p>x</p>' })
    const r2 = buildSemanticaGeneratedTable({ 'abc': '<p>x</p>' })
    // Measure names are derived from visual id deterministically
    expect(r2.measuresByVisualId['abc']).toBe(r1.measuresByVisualId['abc'])
  })
})

describe('rewriteTmdlPartsWithSemanticaTable', () => {
  it('replaces any existing _SemanticaGenerated.tmdl in the parts array', () => {
    const originalParts = [
      { path: 'definition/tables/Measure Table.tmdl', content: 'table Measure Table' },
      { path: 'definition/tables/_SemanticaGenerated.tmdl', content: 'OLD CONTENT' },
      { path: 'definition/model.tmdl', content: 'model' },
    ]
    const { parts } = rewriteTmdlPartsWithSemanticaTable(originalParts, { 'v-1': '<p>new</p>' })

    // Old stub must not appear
    const semPart = parts.find((p) => p.path === 'definition/tables/_SemanticaGenerated.tmdl')
    expect(semPart.content).not.toContain('OLD CONTENT')
    // Other files preserved
    expect(parts.find((p) => p.path === 'definition/model.tmdl').content).toBe('model')
  })

  it('returns measuresByVisualId map matching input visual ids', () => {
    const { measuresByVisualId } = rewriteTmdlPartsWithSemanticaTable([], { a: '<p>1</p>', b: '<p>2</p>' })
    expect(Object.keys(measuresByVisualId).sort()).toEqual(['a', 'b'])
  })
})
