// Inspector placement only; primitive descriptors and persisted keys are unchanged.
const typography = new Set(['showLabels','showValues','showCenterText','labelStyle','labelColor','labelFontSize','valueColor','valueFontSize','centerColor','centerFontSize'])
export function schemaFieldTab(field) {
  return field.tab || (typography.has(field.key) ? 'text' : field.group === 'Legend' ? 'text' : 'style')
}
export function schemaFieldsForTab(schema, tab, { valueText = false, legend = false } = {}) {
  return (schema || []).filter(field => schemaFieldTab(field) === tab
    && !(valueText && field.key === 'valueFontSize')
    && !(legend && field.group === 'Legend'))
}
export function legendSchemaExtras(schema) {
  return (schema || []).filter(field => field.group === 'Legend' && !['showLegend','legendPosition','legendColor','legendFontSize'].includes(field.key))
}
