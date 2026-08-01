import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactNarrative({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')

  // Narrative visual: displays AI-generated or template-based text insights
  // Can receive pre-formatted text via config.narrativeText, or generate from data
  const text = config.narrativeText || config.subtitle || ''
  const val = rows?.[0]?._val
  const val2 = rows?.[0]?._val2
  const cat = rows?.[0]?._cat

  // Build auto-narrative if no text provided
  let narrative = text
  if (!narrative && val != null) {
    const formatted = fmtVal(val, config.prefix, config.suffix)
    const measureName = config.measureName || config.title || 'Value'
    narrative = `${measureName} is currently ${formatted}.`
    if (val2 != null) {
      const change = ((val - val2) / Math.abs(val2) * 100)
      const direction = change >= 0 ? 'up' : 'down'
      narrative += ` This is ${direction} ${Math.abs(change).toFixed(1)}% compared to the previous period.`
    }
    if (cat) narrative += ` Top category: ${cat}.`
  }

  if (loading) return <LoadingShimmer />

  const fontSize    = config.narrativeFontSize || 13
  const fontWeight  = config.narrativeFontWeight || 400
  const lineHeight  = config.narrativeLineHeight || 1.7
  const align       = config.align || 'left'
  const showIcon    = config.showIcon ?? true
  const iconEmoji   = config.icon || '💡'
  const accentWords = config.accentWords || [] // words to highlight in accent color

  // Highlight accent words
  let displayText = narrative
  if (accentWords.length && narrative) {
    for (const word of accentWords) {
      displayText = displayText.replace(new RegExp(`(${word})`, 'gi'), `<span style="color:${p.text};font-weight:700">$1</span>`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '12px 16px', gap: 8 }}>
      {(config.title || config.label) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {showIcon && <span style={{ fontSize: 16 }}>{iconEmoji}</span>}
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{config.title || config.label}</div>
        </div>
      )}
      <div
        style={{ fontSize, fontWeight, color: t.textPrimary, lineHeight, textAlign: align, fontFamily: config.titleFontFamily || 'inherit' }}
        dangerouslySetInnerHTML={accentWords.length ? { __html: displayText } : undefined}
      >
        {!accentWords.length ? narrative : undefined}
      </div>
      {error && <div style={{ fontSize: 10, color: '#F87171' }}>{error}</div>}
    </div>
  )
}
