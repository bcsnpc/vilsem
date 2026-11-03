import { applySecondaryAxis } from './secondaryAxis.js'
// Apply only explicit inspector typography. Preserve scale, tick formatting,
// visibility and renderer-specific defaults; never mutate the input option.
export function applyAxisTextConfig(option, config = {}) {
  if (!option) return option
  const style = {}
  if (config.axisTickColor) style.color = config.axisTickColor
  if (config.axisFontSize != null && config.axisFontSize !== '') style.fontSize = config.axisFontSize
  if (config.axisFontFamily) style.fontFamily = config.axisFontFamily
  let result = option
  for (const key of ['xAxis', 'yAxis']) {
    if (!option[key]) continue
    const axisStyle = { ...style }
    for (const [suffix, property] of [['Family','fontFamily'],['Width','width'],['Overflow','overflow'],['HideOverlap','hideOverlap'],['Color','color'],['Size','fontSize'],['Weight','fontWeight'],['Rotation','rotate'],['Spacing','margin']]) {
      const value = config[`${key}Label${suffix}`]
      if (value != null && value !== '') axisStyle[property] = value
    }
    if (!Object.keys(axisStyle).length) continue
    const apply = axis => ({ ...axis, axisLabel: { ...axis.axisLabel, ...axisStyle } })
    if (result === option) result = { ...option }
    result[key] = Array.isArray(option[key]) ? option[key].map(apply) : apply(option[key])
  }
  return applySecondaryAxis(result, config)
}
