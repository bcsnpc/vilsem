import{it,expect}from'vitest'
import{resolveVisualSpec}from'../packages/core/src/spec/resolve.js'
import{validateSpecDetailed}from'../packages/core/src/spec/diagnostics.js'
const spec=()=>({type:'custom',template:{meta:{id:'tooltip-boundary'},slots:{category:{kind:'dimension'},value:{kind:'measure'}},template:{tooltip:{formatterTemplate:'{name}: {value}'},series:[{type:'pie',data:'$slot.value.pieData',tooltip:{formatterTemplate:'{name}'}}]}}})
it('uses text-only tooltips for model strings that resemble markup or network requests',()=>{
 const option=resolveVisualSpec(spec(),[{_cat:'<img src="https://invalid.example" onerror="fetch(1)">',_val:1}])
 expect(option.tooltip.renderMode).toBe('richText');expect(option.series[0].tooltip.renderMode).toBe('richText')
 expect(option.tooltip.formatter({name:'<img src=x>',value:1})).toBe('<img src=x>: 1') // plain text, not HTML
})
it('refuses an explicitly requested HTML renderer with its precise spec pointer',()=>{
 const input=spec();input.template.template.tooltip.renderMode='html'
 expect(validateSpecDetailed(input).errors[0].path).toBe('/template/template/tooltip/renderMode')
 expect(()=>resolveVisualSpec(input)).toThrow(/HTML rendering is not allowed/)
})
