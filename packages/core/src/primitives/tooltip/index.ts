import { fmtVal } from '../../shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { TooltipPrimitiveProps } from './types'
import { escapeHtml } from '../escapeHtml'

// Tooltip content is derived from data and color scheme automatically.
export const schema: PrimitiveFieldDef[] = []

// Tooltip — generates an ECharts tooltip config that matches AppBarTooltip's
// visual structure: dark container, category name, measure label + formatted
// value. Handles both 'item' trigger (single series, params is an object) and
// 'axis' trigger (multi-series at the hover position, params is an array).
export const Tooltip: Primitive<TooltipPrimitiveProps> = (props, ctx) => {
  const {
    prefix, suffix, measureName, accentColor = '#5EEAD4', trigger = 'item', seriesColors,
    // Content controls (all default to today's behaviour → backward compatible):
    showTitle = true,     // show the category/title row
    titleText,            // override the auto title (category name)
    showName = true,      // show the series/measure label per row
    showValue = true,     // show the formatted value per row
    showSwatch = true,    // show the colour dot per row
    fontSize = 11,        // row font size
  } = props
  const { theme: t } = ctx
  // Pull tooltip colors from theme tokens so the bubble matches the active theme
  // in both modes. Fallback paths preserve previous dark-theme aesthetic if a
  // primitive is invoked with a partial theme stub (e.g. tests).
  const bg          = t.echartsTooltipBg     ?? '#0e0e1c'
  const border      = t.echartsTooltipBorder ?? 'rgba(255,255,255,0.11)'
  const text        = t.echartsTooltipText   ?? '#E5E7EB'
  const titleColor  = t.textPrimary          ?? '#F8FAFC'
  const labelColor  = t.echartsLegendText    ?? 'rgba(255,255,255,0.7)'
  // Heavier shadow on dark themes (looks natural over dark canvases); softer on
  // light. Rough heuristic: tooltip bg starting with '#0' = dark theme.
  const shadow      = (typeof bg === 'string' && bg.startsWith('#0')) ? '0 12px 28px rgba(0,0,0,0.48)' : '0 8px 24px rgba(0,0,0,0.12)'

  return {
    option: {
      tooltip: {
        trigger,
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params]
          const cat = (titleText != null && titleText !== '') ? titleText : (arr[0]?.name ?? '')
          // One row per series — each uses its own seriesName (set in the series
          // primitive via measureName / secondaryMeasureName props) so multi-series
          // tooltips (stacked/grouped bars, line+secondary) show all measures.
          const rows = arr
            .filter(p => p?.value != null)
            .map((p, i) => {
              const seriesName = p?.seriesName || measureName || 'Value'
              const formatted = fmtVal(Number(p?.value ?? 0), prefix, suffix)
              // Prefer explicit seriesColors[i] (full-alpha base color from caller)
              // over params.color (which carries per-bar alpha when rankOpacity is on,
              // making the swatch fade alongside the bar — visually confusing).
              const swatchColor = seriesColors?.[i] || p?.color
              const swatch = (showSwatch && swatchColor)
                ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${swatchColor};margin-right:6px;vertical-align:middle"></span>`
                : ''
              const nameCell = (showName || showSwatch)
                ? `<span style="color:${labelColor}">${swatch}${showName ? escapeHtml(seriesName) : ''}</span>`
                : ''
              const valCell = showValue
                ? `<span style="color:${accentColor};font-weight:700">${escapeHtml(formatted)}</span>`
                : ''
              return `<div style="display:flex;justify-content:space-between;gap:16px;font-size:${fontSize}px;padding:2px 0">
                ${nameCell}${valCell}
              </div>`
            })
            .join('')
          const titleHtml = (showTitle && cat)
            ? `<div style="font-size:${fontSize + 1}px;font-weight:600;color:${titleColor};margin-bottom:6px">${escapeHtml(cat)}</div>`
            : ''
          return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:10px 13px;min-width:160px;box-shadow:${shadow};color:${text}">
            ${titleHtml}${rows}
          </div>`
        },
      } as any,
    },
  }
}
