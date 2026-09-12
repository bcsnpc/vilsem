// Inspector applicability, derived from registered renderers and tested option paths.
// This controls discovery only: it never removes or rewrites saved config.
const axes = new Set(['bar','stacked_bar','line','area','scatter','bubble','column','lollipop','grouped_bar','stacked_area','slope','bump','bar_race','custom'])
const grids = new Set(['bar','stacked_bar','line','area','scatter','bubble','column','lollipop','grouped_bar','stacked_area','bump','custom'])
const labels = new Set(['bar','stacked_bar','line','area','column','lollipop','grouped_bar','stacked_area','bump','waterfall','custom'])
const gradients = new Set(['bar','stacked_bar','column','grouped_bar','funnel'])
export function settingsCapabilities(type) {
  return {
    axisText: axes.has(type), grid: grids.has(type), dataLabels: labels.has(type),
    gradient: gradients.has(type), kpiFeatures: type === 'kpi' || type === 'sparkline_kpi',
    legend: ['pie','donut','grouped_bar','stacked_bar'].includes(type),
    richText: type === 'text_box',
    titleLayout: type === 'kpi' || type === 'sparkline_kpi',
  }
}

export const VALUE_TEXT_DEFAULTS = { kpi: 32, sparkline_kpi: 32, gauge: 15, bullet: 22, progress: 28, stat_card: 28, metric_tile: 20 }
