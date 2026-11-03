import { fmtAxisNumber } from './formatters.js'

// Preserve a usable plot when both value axes are visible. Hosts provide
// horizontal scrolling below this drawing width instead of collapsing marks.
export function secondaryAxisMinimumWidth(option, config = {}) {
  if (!config.secondaryAxisEnabled || !Array.isArray(option?.yAxis) || option.yAxis.length !== 2) return 0
  const axis = option.yAxis[1]
  if (!axis.show) return 0
  return Math.max(300, 160 + (Number(axis.axisLabel?.fontSize) || 9) * 6 + (axis.name ? (Number(axis.nameGap) || 40) : 0))
}

// Scrollable charts must not trap HTML tooltips inside the scroll viewport.
// Keep the popup in its own document (including a Power BI sandbox iframe),
// and convert viewport-clamped coordinates back into chart coordinates.
export function scrollableChartTooltip(option, root) {
  if (!root) return option
  return { ...option, tooltip: { ...option.tooltip, appendToBody: true, confine: false, enterable: true,
    extraCssText: `${option.tooltip?.extraCssText || ''};box-sizing:border-box;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px);white-space:normal;overflow:auto;overflow-wrap:anywhere;`,
    position(point, _params, _dom, _rect, size) {
      const bounds = root.getBoundingClientRect(), view = root.ownerDocument.documentElement
      const scaleX = bounds.width / root.clientWidth || 1, scaleY = bounds.height / root.clientHeight || 1
      const x = Math.max(4, Math.min(bounds.left + point[0] * scaleX + 12, view.clientWidth - size.contentSize[0] - 4))
      const y = Math.max(4, Math.min(bounds.top + point[1] * scaleY + 12, view.clientHeight - size.contentSize[1] - 4))
      return [(x - bounds.left) / scaleX, (y - bounds.top) / scaleY]
    },
  } }
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
