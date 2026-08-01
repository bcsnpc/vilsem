/**
 * Funnel HTML template — direct port of CompactFunnel (AppSpecRenderer.jsx:809).
 * Uses pure HTML/CSS bar-width rendering, no SVG needed.
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid } from './shared.js'

export function renderFunnelHtml(visual, queryResult, theme = 'dark') {
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const title   = config.title || config.label || visual.title || ''
  const measure = visual.measures?.[0] || ''

  const rows = normalizeRows(queryResult, visual.dimension, visual.measures || [measure])
  const data = rows.length
    ? rows
    : [{ _cat: 'Stage 1', _val: 100 }, { _cat: 'Stage 2', _val: 65 }, { _cat: 'Stage 3', _val: 40 }]
  const maxVal = Math.max(...data.map((r) => Math.abs(r._val || 0)))

  const prefix = config.prefix || ''
  const suffix = config.suffix || ''

  const t = themeTokens(theme)
  const uid = tooltipUid()
  const stageRows = data.map((r) => {
    const pct = maxVal > 0 ? (Math.abs(r._val || 0) / maxVal) * 100 : 0
    const valText = `${prefix}${formatNumber(r._val)}${suffix}`
    return `
      <div class="${uid}-row" style="display:flex;align-items:center;gap:6px;position:relative;"
        onmousemove="var t=this.querySelector('.${uid}-tt');if(t){t.style.left=event.offsetX+'px';t.style.top=(event.offsetY<50?(event.offsetY+20):(event.offsetY-50))+'px'}"
      >
        <div style="font-size:10px;color:${t.textSecondary};width:60px;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r._cat)}</div>
        <div style="flex:1;height:16px;background:${theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'};border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${scheme.start},${scheme.mid || scheme.start});border-radius:3px;"></div>
        </div>
        <div style="font-size:10px;color:${t.textPrimary};width:40px;flex-shrink:0;font-weight:600;">${escapeHtml(valText)}</div>
        <div class="${uid}-tt" style="display:none;position:absolute;z-index:10;background:${theme === 'light' ? '#fff' : '#0e0e1c'};border:1px solid ${theme === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.11)'};border-radius:10px;padding:10px 13px;min-width:140px;pointer-events:none;white-space:nowrap;box-shadow:${theme === 'light' ? '0 8px 24px rgba(0,0,0,0.12)' : '0 12px 28px rgba(0,0,0,0.48)'};color:${theme === 'light' ? '#1E293B' : '#E5E7EB'}">
          <div style="font-size:12px;font-weight:600;color:${theme === 'light' ? '#0F172A' : '#F8FAFC'};margin-bottom:6px;">${escapeHtml(r._cat)}</div>
          <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;"><span style="color:${theme === 'light' ? '#64748B' : 'rgba(255,255,255,0.55)'};">${escapeHtml(measure || 'Value')}</span><span style="color:${scheme.text || scheme.start};font-weight:700;">${escapeHtml(valText)}</span></div>
        </div>
      </div>
    `
  }).join('')

  const inner = `
    <style>.${uid}-row:hover .${uid}-tt{display:block!important}.${uid}-row:hover{background:rgba(${theme === 'light' ? '0,0,0,0.03' : '255,255,255,0.03'})}</style>
    <div style="display:flex;flex-direction:column;height:100%;">
      ${title ? `<div style="font-size:11px;font-weight:600;color:${t.textMuted};margin-bottom:8px;">${escapeHtml(title)}</div>` : ''}
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; padding: 0 8px;">
        ${stageRows}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
