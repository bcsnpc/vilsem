import { describe, it, expect } from 'vitest'
import { resolveVisualSpec } from '../packages/core/src/spec/resolve.js'
import { resolveReportTheme, reportThemeFromHost, applyReportTheme } from '../packages/core/src/shared/reportTheme.js'
import { readReportTheme } from '../packages/core/src/pbir/reportTheme.js'
import { contrastingText } from '../packages/core/src/shared/colourContrast.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
const echarts=createRequire(new URL('../vilsem-renderer/package.json',import.meta.url))('echarts')

const rows = [{ _cat: 'A', _val: 23.45 }, { _cat: 'B', _val: 12 }]
describe('palette label contrast',()=>{
  it('renders interpolated hierarchy colours with readable padded node labels',()=>{
    const spec={template:{meta:{id:'mapped-treemap-labels'},slots:{category:{kind:'dimension'},subcategory:{kind:'dimension'},revenue:{kind:'measure'},profit:{kind:'measure'}},transforms:[{as:'tree',hierarchy:{levels:['category','subcategory'],value:'revenue',color:'profit'}}],template:{animation:false,series:[{type:'treemap',data:'$calc.tree.children',visualDimension:1,visualMin:'$slot.profit.min',visualMax:'$slot.profit.max',colorMappingBy:'value',color:['#312e81','#2dd4bf'],leafDepth:2,breadcrumb:{show:false},label:{show:true},upperLabel:{show:true,height:25,color:'#252423'}}]}}}
    const option=resolveVisualSpec(spec,[{_cats:['Bikes','Road Bikes'],_val:100,_val2:80},{_cats:['Bikes','Mountain Bikes'],_val:50,_val2:20}])
    const chart=echarts.init(null,undefined,{renderer:'svg',ssr:true,width:900,height:600})
    try {
      chart.setOption(option)
      const svg=chart.renderToSVGString()
      expect(svg).not.toMatch(/>[^<]*vilsemContrast/)
      expect(svg).toMatch(/>Bikes<\/text>/)
      for(const [name,colour] of [['Road Bikes','#000000'],['Mountain Bikes','#ffffff']]){
        const label=[...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(m=>m[2]===name)
        expect(label,name).toBeDefined()
        expect(label[1]).toContain(`fill="${colour}"`)
        expect(label[1]).toContain('text-anchor="start"')
        expect(label[1]).not.toMatch(/\by="-/)
      }
    } finally {chart.dispose()}
  })
  it('uses actual mapped treemap fill without replacing authored rich text or node colours',()=>{
    const theme=resolveReportTheme({})
    const series=label=>applyReportTheme({series:[{type:'treemap',label}]},theme).series[0]
    const label=series({show:true}).label
    expect(label.formatter({name:'Bright',color:'#2dd4bf'})).toBe('{vilsemContrastLight|Bright}')
    expect(label.formatter({name:'Dark',color:'#12239E'})).toBe('{vilsemContrastDark|Dark}')
    expect(label.formatter({name:'Unknown',color:'rgba(0,0,0,.5)'})).toBe('Unknown')
    expect(label.formatter({name:'Authored',color:'#2dd4bf',data:{label:{color:'#f00'}}})).toBe('Authored')
    expect(label.formatter({name:'{literal}',color:'#2dd4bf'})).toBe('{literal}')
    expect(series({formatter:'{b}'}).label.formatter).toBe('{b}')
    const rich=()=>'{name|Bikes}'
    expect(series({formatter:rich}).label.formatter({color:'#2dd4bf'})).toBe('{name|Bikes}')
    expect(series({color:'#f00'}).label.formatter).toBeUndefined()
    expect(series({position:'inside',align:'center'}).label.formatter).toBeUndefined()
    expect(label.position).toBe('insideTopLeft')
  })
  it.each([['#12239E','#ffffff'],['#118DFF','#000000'],['#ffb347','#000000'],['#fff','#000000'],['rgb(0,0,0)','#ffffff'],['rgba(45,212,191,1)','#000000'],['rgba(49,46,129,1.0)','#ffffff']])('chooses readable text for opaque %s',(colour,text)=>expect(contrastingText(colour)).toBe(text))
  it('does not pretend translucent or unknown paint has a known backdrop',()=>{
    expect(contrastingText('rgba(0,0,0,.1)','#abcdef')).toBe('#abcdef')
    expect(contrastingText('url(file:///x)','#abcdef')).toBe('#abcdef')
  })
  it('leaves contained mark labels to the chart engine while preserving authored colours',()=>{
    const spec={template:{meta:{id:'contained-labels'},slots:{value:{kind:'measure'}},template:{series:[{type:'heatmap',data:[],label:{show:true}},{type:'bar',data:[],label:{position:'inside'}},{type:'treemap',data:[],label:{color:'#ff0000'}}]}}}
    const option=resolveVisualSpec(spec,rows)
    expect(option.series[0].label.color).toBeUndefined()
    expect(option.series[1].label.color).toBeUndefined()
    expect(option.series[2].label.color).toBe('#ff0000')
  })
  it('resolves paletteText without changing raw data or allowing caller callbacks',()=>{
    const spec={template:{meta:{id:'contrast-label'},slots:{value:{kind:'measure'}},template:{series:[{type:'bar',data:'$slot.value.values',label:{show:true,position:'inside',color:'$theme.paletteText.0'}}]}}}
    expect(resolveVisualSpec(spec,rows,{theme:{dataColors:['#12239E']}}).series[0].label.color).toBe('#ffffff')
    expect(resolveVisualSpec(spec,rows,{theme:{dataColors:['#ffb347']}}).series[0].label.color).toBe('#000000')
  })
})
const template = { meta: { id: 'report-theme-test' }, slots: { category: { kind: 'dimension' }, value: { kind: 'measure' } }, template: {
  backgroundColor: '$theme.background', textStyle: { color: '$theme.textPrimary', fontFamily: '$theme.font' },
  xAxis: { type: 'category', data: '$slot.category.categories' }, yAxis: { type: 'value' },
  series: [{ type: 'bar', data: '$slot.value.values' }],
} }
describe('report-native visual themes', () => {
  it.each([{ type: 'bar' }, { template }])('inherits foreground and palette with a transparent default background', spec => {
    const light = resolveVisualSpec(spec, rows, { theme: { background: '#ffffff', foreground: '#242424', dataColors: ['#123456', '#abcdef'], textClasses: { label: { fontFace: 'Arial' } } } })
    const dark = resolveVisualSpec(spec, rows, { theme: { background: '#111111', foreground: '#f4f4f4', dataColors: ['#fedcba', '#654321'] } })
    expect(light.backgroundColor).toBe('transparent'); expect(dark.backgroundColor).toBe('transparent')
    expect(light.textStyle.color).toBe('#242424'); expect(dark.textStyle.color).toBe('#f4f4f4')
    expect(light.textStyle.fontFamily.split(',')[0]).toBe('Arial'); expect(light.color).toEqual(['#123456', '#abcdef'])
  })
  it('defaults to a light report, honors explicit canvasTheme, and allows an explicit pane report override', () => {
    expect(resolveReportTheme({}).mode).toBe('light')
    expect(resolveReportTheme({ canvasTheme: 'dark' }, { theme: 'light' }).mode).toBe('dark')
    expect(resolveReportTheme({ canvasTheme: 'dark' }, { theme: 'light', useReportTheme: true }).mode).toBe('light')
  })
  it('reads host structural colours and indexed palette, including high contrast', () => {
    const palette = { foreground: { value: '#eeeeee' }, background: { value: '#121212' }, getColor: key => ({ value: Number(key) % 2 ? '#aabbcc' : '#112233' }) }
    const host = reportThemeFromHost({ colorPalette: palette })
    expect(host.foreground).toBe('#eeeeee'); expect(host.background).toBe('#121212'); expect(host.dataColors.slice(0, 2)).toEqual(['#112233', '#aabbcc'])
    expect(reportThemeFromHost({ colorPalette: { ...palette, isHighContrast: true } }).dataColors).toEqual(['#eeeeee'])
    const structured=reportThemeFromHost({colorPalette:{...palette,foregroundNeutralTertiary:{value:'#778899'}}})
    expect(resolveReportTheme({}, {theme:structured}).tokens.gridStroke).toBe('#778899')
    expect(resolveReportTheme({}, {theme:reportThemeFromHost({colorPalette:{...palette,isHighContrast:true}})}).tokens.gridStroke).toBe('#eeeeee')
  })
  it.each(['#000','rgb(0,0,0)','#111827'])('recognizes supported opaque dark background syntax %s',background=>{
    expect(resolveReportTheme({}, {theme:{background}}).mode).toBe('dark')
    expect(resolveReportTheme({}, {theme:{background}}).foreground).toBe('#f2f2f2')
  })
  it('reads only the referenced registered theme, keeps report files unchanged and rejects escaping paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vilsem-report-theme-'))
    try {
      await fs.mkdir(path.join(root,'definition'),{recursive:true})
      await fs.mkdir(path.join(root,'StaticResources','RegisteredResources'),{recursive:true})
      const theme = { foreground:'#fafafa',background:'#121212',dataColors:['#abc123'],textClasses:{label:{fontFace:'Arial'}} }
      const report = {themeCollection:{customTheme:{name:'custom.json'}},resourcePackages:[{name:'RegisteredResources',type:'RegisteredResources',items:[{name:'custom.json',path:'custom.json',type:'CustomTheme'}]}]}
      const file = path.join(root,'definition','report.json')
      await fs.writeFile(file,JSON.stringify(report));await fs.writeFile(path.join(root,'StaticResources','RegisteredResources','custom.json'),JSON.stringify(theme))
      expect((await readReportTheme(root)).theme).toEqual(theme)
      expect(JSON.parse(await fs.readFile(file,'utf8'))).toEqual(report)
      report.resourcePackages[0].items[0].path='../../definition/report.json'
      await fs.writeFile(file,JSON.stringify(report))
      await expect(readReportTheme(root)).rejects.toThrow(/local registered JSON/)
      await fs.writeFile(file,JSON.stringify({themeCollection:{}}))
      expect((await readReportTheme(root)).source).toBe('Power BI default')
    } finally { await fs.rm(root,{recursive:true,force:true}) }
  })
})
