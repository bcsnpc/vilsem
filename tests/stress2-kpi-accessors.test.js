import {describe,it,expect} from 'vitest'
import {instantiateVisual,makeFormatter,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion,assertRendererVersion} from '@vilsem/core/pbir'
const template={meta:{id:'current-period-kpi',formatVersion:3},slots:{month:{kind:'time'},value:{kind:'measure'}},template:{lastFinite:'$slot.value.last',current:'$slot.value.lastRowValue',label:'$slot.value.lastRowLabel',detail:{formatterTemplate:'{value:percent}',formatterEmptyText:'No prior month'}}}
describe('current-period KPI tokens and explicit missing values',()=>{
 it('preserves an actual final-row null instead of resurrecting an older finite result',()=>{
  const out=instantiateVisual({template,rows:[{_cat:'2026-01-01',_val:0.1},{_cat:'2026-02-01',_val:null}]}).option
  expect(out.lastFinite).toBe(0.1);expect(out.current).toBe(null);expect(out.label).toBe('2026-02-01')
  expect(out.detail.formatter(NaN)).toBe('No prior month');expect(out.detail.formatter(null)).toBe('No prior month');expect(out.detail.formatter(0)).toBe('0%')
  expect(out.detail).not.toHaveProperty('formatterEmptyText')
 })
 it('keeps zero observations and makes empty vectors explicitly empty',()=>{
  expect(instantiateVisual({template,rows:[{_cat:'2026-02-01',_val:0}]}).option.current).toBe(0)
  const empty=instantiateVisual({template,rows:[]}).option;expect(empty.current).toBe(null);expect(empty.label).toBe(null)
  expect(makeFormatter('{value:thousands}')(NaN)).toBe('')
 })
 it('bounds literal fallback text and refuses unpaired fallback controls',()=>{
  for(const detail of [{formatterEmptyText:'orphan'},{formatterTemplate:'{value}',formatterEmptyText:2},{formatterTemplate:'{value}',formatterEmptyText:'x'.repeat(201)}])expect(validateTemplate({...template,template:{detail}}).errors.join()).toContain('formatterEmptyText')
 })
 it('requires the new reader for format3 and the new positional/fallback features',()=>{
  expect(validateTemplate(template).errors).toEqual([])
  expect(requiredRendererVersion({template})).toBe('4.28.0.0')
  expect(()=>assertRendererVersion({template},{},'4.27.0.0')).toThrow(/4.28.0.0/)
  expect(validateTemplate({...template,meta:{...template.meta,formatVersion:99}}).errors.join()).toContain('Unsupported template formatVersion')
 })
})
