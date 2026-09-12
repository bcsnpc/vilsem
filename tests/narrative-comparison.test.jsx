import React from '../ui/node_modules/react/index.js'
import { renderToStaticMarkup } from '../ui/node_modules/react-dom/server.node.js'
import { describe, it, expect } from 'vitest'
import CompactNarrative from '../ui/src/appspec/visuals/CompactNarrative.jsx'
const render=(comparison,config={})=>renderToStaticMarkup(<CompactNarrative rows={[{_cat:'North',_val:25,_val2:comparison}]} config={{measureName:'Revenue',secondaryMeasureName:'Cost',...config}} />)
describe('Narrative comparison semantics',()=>{
 it('names the actual second measure without inventing a time comparison',()=>{const html=render(15);expect(html).toContain('66.7% higher than Cost (15)');expect(html).not.toContain('previous period');expect(html).not.toContain('Top category')})
 it('explains a zero denominator instead of displaying Infinity',()=>{const html=render(0);expect(html).toContain('percentage change from zero is undefined');expect(html).not.toContain('Infinity')})
 it('preserves explicitly authored narrative text',()=>{expect(render(15,{narrativeText:'Approved commentary'})).toContain('Approved commentary');expect(render(15,{narrativeText:'Approved commentary'})).not.toContain('higher than')})
})
