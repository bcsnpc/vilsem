import {describe,it,expect} from 'vitest'
import {buildVisualDax,prepareVisualRows} from '@vilsem/core/dax'

describe('structured visual DAX bindings',()=>{
  it('escapes identifiers and aliases without changing semantic measure evaluation',()=>{
    const query=buildVisualDax({dimensions:[{table:"O'Brien",column:'Item]Name'}],measures:[{table:'Measures',name:'Sales "ratio]'}]})
    expect(query).toContain("'O''Brien'[Item]]Name]")
    expect(query).toContain('"Sales ""ratio]", \'Measures\'[Sales "ratio]]]')
    expect(query).not.toContain('SUM(')
  })
  it('evaluates scalar ratios and distinct counts directly at scalar grain',()=>{
    const query=buildVisualDax({measures:[{table:'M',name:'Margin Ratio'},{table:'M',name:'Distinct Customers'}]})
    expect(query).toBe('EVALUATE SUMMARIZECOLUMNS("Margin Ratio", \'M\'[Margin Ratio], "Distinct Customers", \'M\'[Distinct Customers])')
  })
  it('rejects incomplete bindings and invalid row limits',()=>{
    expect(()=>buildVisualDax({measures:[{name:'Sales'}]})).toThrow(/qualified/)
    expect(()=>buildVisualDax({measures:[{table:'M',name:'Sales'}],maxRows:0})).toThrow(/maxRows/)
  })
  it('matches report ranking without mutating query rows',()=>{
    const rows=[{_cat:'A',_val:1},{_cat:'B',_val:10}]
    expect(prepareVisualRows(rows,'bar').map(row=>row._cat)).toEqual(['B','A'])
    expect(rows[0]._cat).toBe('A')
  })
  it('preserves chronological template order independently of measure values',()=>{
    const rows=[{_cat:'2025-01-02',_val:100},{_cat:'2025-01-01',_val:1}]
    expect(prepareVisualRows(rows,'custom',{}, {slots:{date:{kind:'time'}}}).map(row=>row._cat)).toEqual(['2025-01-01','2025-01-02'])
  })
})
