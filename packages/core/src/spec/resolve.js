import { composeOption } from '../../dist/compositions.js'
import { resolveReportTheme, applyReportTheme } from '../shared/reportTheme.js'
import { instantiateVisual, buildThemeContext, validateTemplate } from '../templates/instantiate.js'
import { prepareVisualRows } from '../dax/row-normalize.js'
import { compileScopedMeasures } from '../dax/scopedMeasures.js'
import { applyModelFormats } from '../shared/applyModelFormats.js'

// This boundary is deliberately declarative. It never accepts executable code.
export function resolveVisualSpec(spec, rows = [], context = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw Error('spec must be an object')
  if (spec.measures !== undefined) compileScopedMeasures(spec.measures)
  const theme = resolveReportTheme(spec, context)
  rows = prepareVisualRows(rows,spec.type,spec.config,spec.template)
  if (spec.template) {
    const template = spec.template
    const { errors } = validateTemplate(template)
    const check = (value, path = 'template') => {
      if (Array.isArray(value)) return value.forEach((item, index) => check(item, `${path}[${index}]`))
      if (!value || typeof value !== 'object') return
      for (const [key, item] of Object.entries(value)) {
        if (key === 'formatterTemplate' && typeof item === 'string') {
          for (const match of item.matchAll(/\{([^{}]+)\}/g)) {
            if (!/^((?:value|c)(?:\.[0-5])?(?::(?:thousands|percent|date))?|name|seriesName|a|b|d|percent|label)$/.test(match[1])) errors.push(`${path}.${key}: unknown formatter {${match[1]}}`)
          }
        }
        check(item, `${path}.${key}`)
      }
    }
    check(template.template)
    if (errors.length) throw Error(errors.join('\n'))
    const resolved=instantiateVisual({ template, rows, params: spec.params || {}, theme: buildThemeContext(theme.tokens, undefined, theme.fontFamily, theme.palette) })
    return applyModelFormats(applyReportTheme(resolved.option, theme), spec, context.measures, {locale:context.locale,seriesSources:resolved.seriesSources})
  }
  if (typeof spec.type !== 'string') throw Error('spec.type or spec.template is required')
  return applyModelFormats(applyReportTheme(composeOption(spec.type, rows, { ...spec.config, colorScheme: spec.config?.colorScheme || theme.palette[0] }, theme.tokens) || { series: [] }, theme, { palette: !spec.config?.colorScheme && !spec.config?.sectionColors }), spec, context.measures, {locale:context.locale,rows,width:context.width,measureText:context.measureText})
}
