import { mapAppSpecToPages } from './mapPages.js'
import { buildPrimitiveSpecJson, isPrimitiveCovered } from '../spec/index.js'

const base = 'https://developer.microsoft.com/json-schemas/fabric/item/report/'
const schema = (kind, version) => `${base}definition/${kind}/${version}/schema.json`
const literal = value => ({ expr: { Literal: { Value: `'${String(value).replace(/'/g, "''")}'` } } })
const part = (path, value) => ({ path, content: JSON.stringify(value, null, 2) })

// New report only. Bind existing fields directly; never install generated measures
// or reuse the source report. Reject unsupported content before writing any files.
export function buildLocalReportParts({ spec, measures, bundle }) {
  if (!bundle?.success || !bundle.guid || !bundle.parts?.length) throw Error('The bundled Power BI renderer is unavailable.')
  const sourcePages = spec?.pages?.length ? spec.pages : [spec || {}]
  const raw = sourcePages.flatMap(p => p.visuals || [])
  if (!raw.length) throw Error('Add a visual before saving a Power BI report.')
  const unsupported = raw.filter(v => !isPrimitiveCovered(v.type))
  if (unsupported.length) throw Error(`Power BI file export does not yet support: ${unsupported.map(v => `${v.id} (${v.type})`).join(', ')}. No report was written.`)
  if (sourcePages.some(p => p.slicers?.length) || spec.slicers?.length) throw Error('Local report slicer export is not implemented yet. No report was written.')
  if (raw.some(v => v.data?.filters?.length || v.data?.drill?.length)) throw Error('Local report filter/drill export is not implemented yet. No report was written.')
  const canvasTheme = spec.theme?.mode === 'light' ? 'light' : 'dark'
  const pageBackground = canvasTheme === 'dark' ? '#0b0b12' : '#FFFFFF'
  const color = { solid: { color: literal(pageBackground) } }
  const pageObjects = {
    background: [{ properties: { color, transparency: { expr: { Literal: { Value: '0D' } } } } }],
    outspace: [{ properties: { color } }],
  }
  const pages = mapAppSpecToPages(spec, { includeStaticObjects: true })
  if (pages.reduce((n,p) => n+p.visuals.length,0) !== raw.length) throw Error('The Power BI mapping omitted a visual. No report was written.')
  const metadata = bundle.parts.find(p => p.path.endsWith(`${bundle.guid}.pbiviz.json`))
  if (!metadata) throw Error('The bundled renderer metadata is missing.')
  const parts = [
    part('definition/version.json', { $schema: schema('versionMetadata','1.0.0'), version:'2.0.0' }),
    part('definition/report.json', { $schema:schema('report','3.2.0'), themeCollection:{},
      resourcePackages:[{name:bundle.guid,type:'CustomVisual',items:[{name:`${bundle.guid}.pbiviz.json`,path:`${bundle.guid}.pbiviz.json`,type:'CustomVisualMetadata'}]}] }),
    ...bundle.parts,
  ]
  const order = pages.map((_,i)=>`page${i+1}`)
  parts.push(part('definition/pages/pages.json',{$schema:schema('pagesMetadata','1.0.0'),pageOrder:order,activePageName:order[0]}))
  pages.forEach((page,index)=>{
    const pageName=order[index], prefix=`definition/pages/${pageName}`
    parts.push(part(`${prefix}/page.json`,{$schema:schema('page','2.1.0'),name:pageName,displayName:page.name,displayOption:'FitToPage',width:page.width,height:page.height,objects:pageObjects}))
    page.visuals.forEach((visual,i)=>{
      const names=visual.measures || []
      if ((!names.length && !['shape', 'divider'].includes(visual.type)) || names.length > (visual.type==='table'?10:3)) throw Error(`Visual ${visual.id} has an unsupported number of measures.`)
      const queryState={}
      names.forEach((name,j)=>{
        const matches=measures.filter(m=>m.name===name)
        if(matches.length!==1 || !matches[0].table) throw Error(`Measure ${name} could not be resolved uniquely.`)
        const table=matches[0].table, role=visual.type==='table'?'content':['content','secondary','tertiary'][j]
        const projection={field:{Measure:{Expression:{SourceRef:{Entity:table}},Property:name}},queryRef:`${table}.${name}`,nativeQueryRef:name}
        ;(queryState[role] ||= {projections:[]}).projections.push(projection)
      })
      const dimensions=visual.dimensions || []
      if(visual.type==='bar_race' && dimensions.length<2) throw Error(`Visual ${visual.id} needs a playback field and a category field before Power BI export.`)
      if(dimensions.length>6) throw Error(`Visual ${visual.id} exceeds six category fields.`)
      dimensions.forEach((dimension,j)=>{
        const match=/^(.+)\[([^\]]+)\]$/.exec(dimension)
        if(!match) throw Error(`Invalid dimension ${dimension}.`)
        const [,table,column]=match
        queryState[j?`category${j+1}`:'category']={projections:[{field:{Column:{Expression:{SourceRef:{Entity:table}},Property:column}},queryRef:`${table}.${column}`,nativeQueryRef:column,active:true}]}
      })
      const name=`visual${i+1}`
      parts.push(part(`${prefix}/visuals/${name}/visual.json`,{$schema:schema('visualContainer','2.7.0'),name,
        position:{x:visual.x,y:visual.y,width:visual.width,height:visual.height,z:i,tabOrder:i},
        visual:{visualType:bundle.guid,query:{queryState},drillFilterOtherVisuals:true,visualContainerObjects:{background:[{properties:{show:{expr:{Literal:{Value:'false'}}}}}]},objects:{semantica:[{properties:{primitiveSpec:literal(buildPrimitiveSpecJson(visual,canvasTheme))}}]}}
      }))
    })
  })
  return parts
}
