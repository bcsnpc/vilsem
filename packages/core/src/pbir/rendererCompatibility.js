// Feature floors for additions after the 4.14 renderer. Never upgrade a report's
// existing custom-visual resources implicitly while inserting one visual.
import fs from 'node:fs/promises'
import path from 'node:path'
import {slotCount} from '../templates/instantiate.js'
import {scopedMeasuresOf} from '../spec/migrate.js'

export function requiredRendererVersion(spec, bindings = {}) {
  let minor = 0
  const require = version => { minor = Math.max(minor, version) }
  if(spec?.specVersion==='0.7')require(40)
  if(spec?.template?.meta?.formatVersion===4)require(40)
  if(spec?.formatting&&Object.keys(spec.formatting).length)require(35)
  // Older bundles defaulted to a dark canvas and ignored model formats. Refuse
  // silent preview/native divergence; never replace an existing report resource.
  if(!['light','dark'].includes(spec?.canvasTheme))require(34)
  if(bindings.measures?.some(measure=>typeof measure?.formatString==='string'&&measure.formatString))require(34)
  if(Object.values(spec?.measures || {}).some(measure=>typeof measure==='object'&&measure?.format))require(34)
  if(spec?.template?.meta?.formatVersion===3)require(28)
  const templateMeasures=Object.values(spec?.template?.slots || {}).filter(slot=>slot?.kind==='measure').reduce((count,slot)=>count+slotCount(slot.count),0)
  if (Object.keys(scopedMeasuresOf(spec)).length || Math.max(templateMeasures,bindings.measures?.length || 0) > 3) require(15)
  const walk = value => {
    if(value?.type==='custom'&&value.renderItem?.language==='vilsem-expression')require(36)
    if(value&&typeof value==='object'&&(Object.hasOwn(value,'timeline')||Object.hasOwn(value,'universalTransition')))require(36)
    if(typeof value==='string'&&/^\$theme\.paletteText(?:\.\d+)?$/.test(value))require(34)
    if(typeof value==='string'&&/^\$theme\.(readablePalette|pageBackground)(?:\.\d+)?$/.test(value))require(36)
    if(typeof value==='string'&&/^\$item\.(pixelSpan|labelWidth|labelVisible)$/.test(value))require(30)
    if(typeof value==='string'&&/^\$(slot|calc)\.[A-Za-z_]\w*\.(lastRowValue|lastRowLabel)$/.test(value))require(28)
    if (typeof value === 'string' && /\{(?:value|c)\.[0-5](?::(?:thousands|percent|date))?\}/.test(value)) require(20)
    if (typeof value === 'string' && /^\$item\.(last|lastLabel|sum|max|avg)$/.test(value)) require(15)
    if (typeof value === 'string' && (value === '$item.values' || value === '$item')) require(22)
    if (typeof value === 'string' && /^\$calc\.[A-Za-z_]\w*\.indicators$/.test(value)) require(24)
    if (!value || typeof value !== 'object') return
    if(Object.hasOwn(value,'formatterEmptyText'))require(28)
    if (Object.hasOwn(value, 'concat')) require(15)
    if (typeof value.repeat === 'string' && /^\$calc\.[A-Za-z_]\w*\.data$/.test(value.repeat)) require(25)
    if (['heatmap','tree','boxplot','candlestick','parallel','themeRiver','pictorialBar','funnel'].includes(value.type)) require(15)
    if (value.type === 'chord') require(22)
    for (const key of ['markArea','markPoint','polar','radar','calendar','parallel','singleAxis','visualMap','dataZoom','dataset']) if (Object.hasOwn(value,key)) require(15)
    for (const child of Object.values(value)) walk(child)
  }
  walk(spec?.template?.template)
  for (const transform of spec?.template?.transforms || []) {
    if(transform.mosaic)require(36)
    if(transform.setOverlaps)require(36)
    if(transform.voronoi)require(36)
    if(transform.race)require(36)
    if(transform.flows?.time)require(36)
    if(transform.density?.expressionGeometry)require(36)
    if(transform.jitter?.expressionGeometry||transform.words?.expressionGeometry||transform.hierarchy?.expressionGeometry)require(36)
    if(transform.hexbin?.expressionGeometry||transform.density2d?.contourFractions)require(36)
    if(transform.words)require(31)
    if(transform.density2d)require(30)
    if(['qq','hexbin','density2d','groupShare','conditional','rebase','cohort','pivot','correlation','pareto','tiles'].some(key=>Object.hasOwn(transform,key))||transform.top?.countParam!=null)require(29)
    if (transform.stat) require(15)
    if (['points','chunk','top','allocate'].some(key => Object.hasOwn(transform,key))) require(16)
    if (transform.heikinAshi) require(17)
    if (transform.waterfall) require(18)
    if (transform.hierarchy?.color || transform.hierarchy?.layout) require(19)
    if (transform.flows) require(22)
    if (transform.points?.sample != null) require(25)
    if (transform.stream) require(25)
    if (transform.intervals) require(26)
    if (transform.conversion || transform.dateBands || transform.window?.op === 'ewma') require(27)
    if (transform.histogram || transform.boxplot || transform.ecdf || transform.stat?.records || transform.density || transform.jitter) require(28)
    if (transform.top?.other === false) require(28)
  }
  return minor ? `4.${minor}.0.0` : null
}

export function assertRendererVersion(spec, bindings, actual) {
  const minimum = requiredRendererVersion(spec, bindings)
  if (!minimum) return
  const parse = value => typeof value === 'string' && /^\d+(?:\.\d+){1,3}$/.test(value) ? value.split('.').map(Number) : null
  const parts = parse(actual), target = parse(minimum)
  const comparison = parts ? target.reduce((result, value, i) => result || Math.sign((parts[i] || 0)-value),0) : -1
  if (comparison < 0) throw Error(`This visual requires vilsem Renderer ${minimum} or later; this report registers ${actual || 'an unreadable renderer version'}. Import the updated renderer package in Power BI Desktop before committing. Existing report resources were not changed.`)
}

export async function assertReportRenderer(reportDir, guid, spec, bindings) {
  let version
  try {
    const metadata = JSON.parse((await fs.readFile(path.join(reportDir,'CustomVisuals',guid,'package.json'),'utf8')).replace(/^\uFEFF/,''))
    if (metadata.visual?.guid === guid) version = metadata.version || metadata.visual.version
  } catch (error) {
    if (!['ENOENT','ENOTDIR'].includes(error.code) && !(error instanceof SyntaxError)) throw error
  }
  assertRendererVersion(spec,bindings,version)
}
