import { hexToRgb } from './palettes.js'

/**
 * Single source of truth for card chrome. Every render path (edit GridLayout,
 * edit CanvasEditor, view section-based, view freeform, and the PBI DAX
 * mirror) MUST use this so a `filled` KPI looks identical everywhere.
 *
 * Honors config.cardStyle (minimal|filled|glass|glossy|accent|bordered),
 * config.bgOpacity (number 0-1 overriding background alpha),
 * config.cardOpacity (number 0-1 for overall opacity),
 * config.borderRadius (number, default 14).
 *
 * @param {object}  args
 * @param {import('./chart-config').ChartConfig} args.config
 * @param {string}  args.colorVal
 * @param {import('../getThemeTokens').ThemeTokens} args.T
 * @param {boolean} args.isKpi
 * @param {boolean} [args.isSelected]
 */
export function getCardChromeStyle({ config, colorVal, T, isKpi, isSelected = false }) {
  const cfg = config || {}
  const cardStyle = cfg.cardStyle || 'minimal'
  const [cr, cg, cb] = hexToRgb(colorVal)
  const bo = cfg.bgOpacity ?? null
  const cardOpacity = cfg.cardOpacity ?? 1
  const borderRadius = cfg.borderRadius ?? 14

  let base
  if (cardStyle === 'filled') {
    base = {
      background: `linear-gradient(135deg, rgba(${cr},${cg},${cb},${bo ?? 1}) 0%, rgba(${cr},${cg},${cb},${bo ?? 0.7}) 100%)`,
      border: `1px solid ${colorVal}`,
      borderTop: `2px solid ${colorVal}`,
      boxShadow: `0 8px 24px rgba(${cr},${cg},${cb},0.3)`,
    }
  } else if (cardStyle === 'glass') {
    base = {
      background: `rgba(${cr},${cg},${cb},${bo ?? 0.08})`,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid rgba(${cr},${cg},${cb},0.2)`,
      boxShadow: `0 8px 32px rgba(${cr},${cg},${cb},0.1), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }
  } else if (cardStyle === 'glossy') {
    base = {
      background: `linear-gradient(145deg, rgba(${cr},${cg},${cb},${bo ?? 0.15}) 0%, rgba(${cr},${cg},${cb},${bo ?? 0.05}) 50%, rgba(${cr},${cg},${cb},${bo ?? 0.12}) 100%)`,
      border: `1px solid rgba(${cr},${cg},${cb},0.25)`,
      boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`,
    }
  } else if (cardStyle === 'accent') {
    base = {
      background: bo != null ? `rgba(${cr},${cg},${cb},${bo})` : (isKpi ? T.kpiBgFn(colorVal) : T.CARD_BG),
      border: `1px solid ${T.CARD_BORDER}`,
      borderLeft: `4px solid ${colorVal}`,
      boxShadow: T.CARD_SHADOW,
    }
  } else if (cardStyle === 'bordered') {
    base = {
      background: bo != null ? `rgba(${cr},${cg},${cb},${bo})` : 'transparent',
      border: `2px solid rgba(${cr},${cg},${cb},0.4)`,
      borderTop: `2px solid rgba(${cr},${cg},${cb},0.6)`,
      boxShadow: 'none',
    }
  } else {
    // minimal (default)
    base = isKpi
      ? {
          background: bo != null ? `rgba(${cr},${cg},${cb},${bo})` : T.kpiBgFn(colorVal),
          border: T.kpiBorderFn(colorVal),
          borderTop: T.kpiBorderTop(colorVal),
          boxShadow: T.kpiShadowFn(colorVal),
        }
      : {
          background: bo != null ? `rgba(${cr},${cg},${cb},${bo})` : T.CARD_BG,
          border: `1px solid ${T.CARD_BORDER}`,
          borderTop: T.chartBorderTop(colorVal),
          boxShadow: T.CARD_SHADOW,
        }
  }

  if (isSelected) {
    base = {
      ...base,
      border: '2px solid #818CF8',
      borderTop: '2px solid #818CF8',
      boxShadow: '0 0 0 3px rgba(129,140,248,0.25)',
    }
  }

  return { ...base, opacity: cardOpacity, borderRadius }
}
