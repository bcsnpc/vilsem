// Shared expand-in-place bar option (drill pattern 02). Used by bar/column
// (CompactBarEcharts) and by grouped/stacked bars while drilled — those collapse
// to the primary measure during expansion, so the morph is identical everywhere.
// Orientation-aware, so it works on horizontal AND vertical bars.
//
// `chartRows` are the mixed-grain rows from shapeExpandInPlace(): each carries
// _cat, _val, _group and _child (true = a child of the expanded parent). While
// collapsed (expandedValue == null) every bar is a full-opacity parent.
export function buildExpandBarOption(chartRows, {
  isHorizontal, palStart, t, maxBarWidth = 26, showDataLabels = true, expandedValue = null,
}) {
  const cats = chartRows.map(r => String(r._cat))
  // Only treat as expanded once the rows are the shaped mixed-grain set (they carry
  // _group). Until the re-query lands, rows are the old collapsed set — keep them
  // full-opacity so there's no dim flash, and the morph runs collapsed→expanded.
  const isExpanded = expandedValue != null && chartRows.some(r => r._group != null)
  const manyCats = !isHorizontal && cats.length > 6
  const catAxis = {
    type: 'category', data: cats, axisTick: { show: false },
    axisLine: { lineStyle: { color: t.gridStrokeOn } },
    axisLabel: { color: t.textMuted, fontSize: 10, interval: 0, rotate: manyCats ? 32 : 0 },
  }
  const valAxis = {
    type: 'value', axisTick: { show: false },
    axisLine: { lineStyle: { color: t.gridStrokeOn } },
    splitLine: { show: false }, axisLabel: { color: t.textMuted, fontSize: 10 },
  }
  return {
    grid: { left: 8, right: 16, top: 10, bottom: manyCats ? 58 : 24, containLabel: true },
    tooltip: { trigger: 'item', backgroundColor: t.CARD_BG, borderColor: t.gridStroke, textStyle: { color: t.textPrimary, fontSize: 12 } },
    xAxis: isHorizontal ? valAxis : catAxis,
    yAxis: isHorizontal ? catAxis : valAxis,
    series: [{
      type: 'bar', id: 'expandbars', barMaxWidth: maxBarWidth,
      data: chartRows.map(r => ({
        value: Number(r._val) || 0,
        // groupId = the PARENT group: collapsed rows are their own parent (_group
        // falls back to _cat); expanded children all share the expanded parent's id,
        // so ECharts divides that one bar into N children (divideShape: clone).
        groupId: String(r._group ?? r._cat),
        itemStyle: {
          color: palStart, opacity: !isExpanded ? 1 : (r._child ? 1 : 0.3),
          borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
      })),
      label: showDataLabels
        ? { show: true, position: isHorizontal ? 'right' : 'top', color: t.textMuted, fontSize: 10 }
        : { show: false },
      universalTransition: { enabled: true, divideShape: 'clone' },
      animationDurationUpdate: 700, animationEasingUpdate: 'cubicInOut',
    }],
  }
}
