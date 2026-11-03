import { fmtAxisNumber } from './formatters.js'

// Preserve a usable plot when both value axes are visible. Hosts provide
// horizontal scrolling below this drawing width instead of collapsing marks.
export function secondaryAxisMinimumWidth(option, config = {}) {
  if (!config.secondaryAxisEnabled || !Array.isArray(option?.yAxis) || option.yAxis.length !== 2) return 0
  const axis = option.yAxis[1]
  if (!axis.show) return 0
  return Math.max(300, 160 + (Number(axis.axisLabel?.fontSize) || 9) * 6 + (axis.name ? (Number(axis.nameGap) || 40) : 0))
}

// Opt-in for the existing two-series Line/Area contract. Never reinterpret
// stacks, ranks, or custom multi-axis compositions as independent measures.
export function applySecondaryAxis(option, config = {}) {
  const primary = option?.yAxis, series = option?.series
  if (!config.secondaryAxisEnabled || !primary || Array.isArray(primary) ||
      primary.type !== 'value' || primary.inverse || !Array.isArray(series) ||
      series.length !== 2 || series.some(s => s.type !== 'line' || s.stack || s.yAxisIndex > 0)) return option

  const axisDefaults = { ...primary }
  delete axisDefaults.min
  delete axisDefaults.max
  const label = { ...primary.axisLabel }
  for (const [suffix, property] of [['Color','color'],['Size','fontSize'],['Family','fontFamily'],['Weight','fontWeight'],['Rotation','rotate'],['Spacing','margin']]) {
    const value = config[`secondaryAxisLabel${suffix}`]
    if (value != null && value !== '') label[property] = value
  }
  if (config.secondaryAxisPrefix || config.secondaryAxisSuffix) {
    label.formatter = value => `${config.secondaryAxisPrefix || ''}${fmtAxisNumber(value)}${config.secondaryAxisSuffix || ''}`
  }
  const secondary = {
    ...axisDefaults,
    position: 'right', show: config.secondaryAxisVisible !== false,
    name: config.secondaryAxisTitle || '', nameLocation: 'middle',
    nameGap: config.secondaryAxisTitleGap ?? 40,
    nameTextStyle: {
      color: config.secondaryAxisTitleColor || label.color,
      fontFamily: config.secondaryAxisLabelFamily || label.fontFamily,
      fontSize: config.secondaryAxisTitleSize ?? 12,
      fontWeight: config.secondaryAxisTitleWeight ?? 600,
    },
    axisLabel: label,
    axisLine: { show: true, lineStyle: { color: config.secondaryAxisLineColor || label.color } },
    axisTick: { show: true, lineStyle: { color: config.secondaryAxisLineColor || label.color } },
    splitLine: { show: config.secondaryAxisGrid === true, lineStyle: { ...primary.splitLine?.lineStyle, color: config.secondaryAxisGridColor || primary.splitLine?.lineStyle?.color } },
  }
  return { ...option, yAxis: [primary, secondary], series: [series[0], { ...series[1], yAxisIndex: 1 }] }
}
