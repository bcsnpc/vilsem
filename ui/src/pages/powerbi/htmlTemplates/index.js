/**
 * htmlTemplates — dispatcher that maps a Semantica visual type to its
 * static HTML rendering function.
 *
 * Each renderer takes (visual, queryResult, theme) and returns a
 * self-contained HTML string suitable for embedding inside Power BI's
 * HTML Content visual.
 *
 * Currently supported types: kpi, bar, stacked_bar, donut, line, area, table.
 * Other types fall through to a placeholder card so the publish doesn't
 * fail when those visuals appear in a report.
 */

import { renderKpiHtml }        from './kpiTemplate.js'
import { renderBarHtml }        from './barTemplate.js'
import { renderDonutHtml }      from './donutTemplate.js'
import { renderLineHtml }       from './lineTemplate.js'
import { renderTableHtml }      from './tableTemplate.js'
import { renderGaugeHtml }      from './gaugeTemplate.js'
import { renderFunnelHtml }     from './funnelTemplate.js'
import { renderStackedBarHtml } from './stackedBarTemplate.js'
import { renderRadarHtml }      from './radarTemplate.js'
import { renderScatterHtml }    from './scatterTemplate.js'
import { renderTreemapHtml }    from './treemapTemplate.js'
import { themeTokens, escapeHtml, wrapCard, getColorScheme } from './shared.js'

const TEMPLATE_MAP = {
  kpi:         renderKpiHtml,
  bar:         renderBarHtml,
  stacked_bar: renderStackedBarHtml,
  donut:       renderDonutHtml,
  line:        renderLineHtml,
  area:        renderLineHtml,       // shared renderer; branches on visual.type
  table:       renderTableHtml,
  gauge:       renderGaugeHtml,
  funnel:      renderFunnelHtml,
  sankey:      renderFunnelHtml,     // VISUAL_MAP aliases sankey→funnel in editor
  radar:       renderRadarHtml,
  scatter:     renderScatterHtml,
  treemap:     renderTreemapHtml,
}

/**
 * @param {Object} visual      — editor visual object (with type, measures, etc.)
 * @param {Object} queryResult — result of window.semantica.query / queryTable
 * @param {string} theme       — 'dark' | 'light'
 * @returns {string}           — self-contained HTML
 */
export function renderVisualToHtml(visual, queryResult, theme = 'dark') {
  const fn = TEMPLATE_MAP[visual?.type]
  if (typeof fn === 'function') {
    try { return fn(visual, queryResult, theme) }
    catch (e) {
      console.warn('[htmlTemplates] template failed for', visual?.type, e?.message)
      return renderFallbackHtml(visual, theme, e?.message)
    }
  }
  return renderFallbackHtml(visual, theme)
}

function renderFallbackHtml(visual, theme = 'dark', errorMsg) {
  const t      = themeTokens(theme)
  const scheme = getColorScheme(visual?.config?.colorScheme || visual?.colorScheme)
  const title  = visual?.title || visual?.config?.title || visual?.type || 'Visual'
  const inner = `
    <div style="
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%; gap: 8px;
      color: ${t.textMuted};
    ">
      <div style="font-size: 28px;">📊</div>
      <div style="font-size: 11px; font-weight: 700; color: ${t.textPrimary};">
        ${escapeHtml(title)}
      </div>
      <div style="font-size: 10px; color: ${t.textMuted};">
        Visual type: <code style="color:${t.textSecondary};">${escapeHtml(visual?.type || 'unknown')}</code>
      </div>
      <div style="font-size: 9px; color: ${t.textMuted}; max-width: 220px; text-align: center;">
        ${errorMsg
          ? `Render error: ${escapeHtml(errorMsg)}`
          : 'Static HTML render not yet supported for this type. Live preview is available in the Semantica editor.'}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
