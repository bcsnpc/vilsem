import {describe,it,expect} from 'vitest'
import {compileScopedMeasures,lexDax,buildVisualDax,normaliseRows,rowsFromCategorical} from '@vilsem/core/dax'
import {resolveVisualSpec} from '@vilsem/core/spec/resolve'
import {makeVisualContainer,validateVisualContainer} from '@vilsem/core/pbir'

const schema={tables:[{name:'M',columns:[]},{name:'Date',columns:[{name:'Date'}]},{name:'Product',columns:[{name:'Category'}]}],measures:[{table:'M',name:'Profit'},{table:'M',name:'Revenue'}]}
const measures={'Margin':'DIVIDE([Profit],[Revenue])','Prior Year':"CALCULATE([Revenue], SAMEPERIODLASTYEAR('Date'[Date]))",'Rank':"RANKX(ALL('Product'[Category]), [Margin], , DESC, DENSE)"}
describe('visual-scoped DAX measures',()=>{
  it('carries declared display formats to NativeMeasure without persisting them to the model',async()=>{
    const scoped={Margin:{expression:measures.Margin,format:'0.00%'}}
    const compiled=compileScopedMeasures(scoped,{schema,homeTable:'M'})
    expect(compiled.format('margin')).toBe('0.00%')
    expect(compiled.define).toContain(measures.Margin)
    const visual=makeVisualContainer({visualName:'formatted-margin',spec:{type:'bar',measures:scoped},bindings:{dimensions:[],measures:[{table:'M',name:'Margin'}]}})
    expect(visual.visual.query.queryState.content.projections[0].field.NativeMeasure.Format).toBe('0.00%')
    await expect(validateVisualContainer(visual)).resolves.toBe(true)
  })
  it('compiles ratio, time intelligence and rank into query-only definitions',()=>{
    const result=compileScopedMeasures(measures,{schema,homeTable:'M'})
    expect(result.define).toContain("MEASURE 'M'[Margin] = DIVIDE([Profit],[Revenue])")
    expect(result.expression('Rank')).toContain('CALCULATE(\nDIVIDE([Profit],[Revenue])\n)')
    expect(result.expression('Prior Year')).toBe(measures['Prior Year'])
    expect(buildVisualDax({measures:[{table:'M',name:'Margin'}],scopedMeasures:measures,schema})).toMatch(/^DEFINE[\s\S]*EVALUATE SUMMARIZECOLUMNS/)
  })
  it('keeps escaped strings, comments and names intact during expansion',()=>{
    const compiled=compileScopedMeasures({A:'[Revenue]',B:'IF(TRUE(), [A], LEN("[A]")) // [A]\n'},{schema,homeTable:'M'})
    expect(compiled.expression('B')).toBe('IF(TRUE(), CALCULATE(\n[Revenue]\n), LEN("[A]")) // [A]\n')
    expect(()=>lexDax('SUM("unterminated)')).toThrow(/Unterminated/)
    expect(()=>lexDax('DIVIDE([Profit], [Revenue]')).toThrow(/Unbalanced/)
    expect(()=>lexDax('1 EVALUATE ROW("x",2)')).toThrow(/scalar/)
  })
  it('rejects unknown fields, unknown measures, shadowing and case-insensitive cycles',()=>{
    for(const expression of ['[Missing]',"SUM('Date'[Missing])","SUM('Missing'[Date])","COUNTROWS('Missing')"])
      expect(()=>compileScopedMeasures({A:expression},{schema,homeTable:'M'})).toThrow(/Unknown/)
    expect(()=>compileScopedMeasures({A:'[b]',B:'[A]'})).toThrow(/cycle/)
    expect(()=>compileScopedMeasures({Revenue:'1'},{schema,homeTable:'M'})).toThrow(/shadow/)
    expect(()=>compileScopedMeasures({Category:'1'},{schema,homeTable:'M'})).toThrow(/collides/)
    expect(()=>compileScopedMeasures({A:'1',a:'2'})).toThrow(/Duplicate/)
  })
  it('recognizes real unqualified iterator columns while leaving row-context binding to the engine',()=>{
    expect(()=>compileScopedMeasures({Filtered:"COUNTROWS(FILTER('Product', [Category] = \"A\"))"},{schema,homeTable:'M'})).not.toThrow()
  })
  it('projects an inline NativeMeasure rather than referencing a nonexistent model measure',async()=>{
    const visual=makeVisualContainer({visualName:'margin',spec:{type:'bar',measures:{Margin:measures.Margin}},bindings:{dimensions:[{table:'Product',column:'Category'}],measures:[{table:'M',name:'Margin'}]}})
    expect(visual.visual.query.queryState.content.projections[0].field).toEqual({NativeMeasure:{Language:'dax',DataType:3,Expression:measures.Margin,ProposedName:'Margin'}})
    await expect(validateVisualContainer(visual)).resolves.toBe(true)
    expect(JSON.stringify(visual)).not.toContain('TMDL')
  })
  it('bounds dependency expansion and definition count',()=>{
    expect(()=>compileScopedMeasures(Object.fromEntries(Array.from({length:33},(_,i)=>['m'+i,'1'])))).toThrow(/32/)
    const nested={m0:'1'};for(let i=1;i<25;i++)nested['m'+i]=`[m${i-1}]+[m${i-1}]`
    expect(()=>compileScopedMeasures(nested)).toThrow(/100000/)
  })
  it('preserves the same engine-evaluated values through SSR and categorical renderer paths',()=>{
    const fixture=[{category:'A',margin:0.21},{category:'B',margin:0},{category:'C',margin:null}]
    const spec={type:'bar',config:{animationEnabled:false},measures:{Margin:'DIVIDE([Profit],[Revenue])'}}
    const raw=fixture.map(r=>({'Product[Category]':r.category,'[Margin]':r.margin}))
    const ssr=normaliseRows(raw,'Product[Category]',['Margin'])
    const runtime=rowsFromCategorical({categories:[{values:fixture.map(r=>r.category)}],values:[{values:fixture.map(r=>r.margin)}]})
    expect(runtime.map(r=>r._val)).toEqual(ssr.map(r=>r._val))
    // Renderer formatters are independently constructed function instances.
    expect(JSON.stringify(resolveVisualSpec(spec,runtime))).toBe(JSON.stringify(resolveVisualSpec(spec,ssr)))
  })
})
