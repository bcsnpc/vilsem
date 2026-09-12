import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function setup() {
  const calls = [], window = {}
  const source = fs.readFileSync('electron/fabric/templates/semantica-shim.ts.tmpl', 'utf8').replace(/^import [^\r\n]*getFabricClient[^\r\n]*\r?\n/m, '')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(js, { window, exports: {}, getFabricClient: () => ({ semanticModel: () => ({ query: async dax => {
    calls.push(dax)
    return { status: 'success', table: { columns: [{ name: 'Product[Category]' }], rows: [['Accessories']] } }
  } }) }) })
  return { calls, query: window.semantica.queryTable }
}

describe('Fabric dimension-only table query parity', () => {
  it('sorts by dimensions without inventing an undefined measure', async () => {
    const { calls, query } = setup()
    const result = await query({ groupBy: ['Product[Category]', 'Product[Code]'], measures: [], limit: 25, orderBy: 'asc', filters: { 'Product[Category]': 'Accessories' } })
    expect(result.rows[0]['Product[Category]']).toBe('Accessories')
    expect(calls[0]).not.toContain('[undefined]')
    expect(calls[0]).toContain("ORDER BY 'Product'[Category] ASC, 'Product'[Code] ASC")
    expect(calls[0]).toContain('TOPN(25,')
    expect(calls[0]).toContain('Accessories')
  })
  it('preserves measure-first sorting for ordinary charts', async () => {
    const { calls, query } = setup()
    await query({ groupBy: ['Product[Category]'], measures: ['Sales'], limit: 10, orderBy: 'desc' })
    expect(calls[0]).toContain("ORDER BY [Sales] DESC, 'Product'[Category] ASC")
  })
})
