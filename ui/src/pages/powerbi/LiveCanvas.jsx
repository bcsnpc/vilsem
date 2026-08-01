import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppSpecRenderer from '../../appspec/AppSpecRenderer'
import { pageToAppSpec } from './pageToAppSpec.js'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'

/**
 * LiveCanvas — Power BI Mode's editor canvas, rendered with AppSpecRenderer.
 *
 * Replaces the old static CanvasPreview. Translates the active editor page
 * into an AppSpec on the fly and hands it to AppSpecRenderer, which fetches
 * real Fabric data via window.semantica.{query, queryTable} and renders the
 * same Compact* visual components App Generator uses.
 *
 * Empty-page state shows a friendly placeholder.
 *
 * Selection / delete affordances are deferred to a follow-up — for now the
 * canvas is read-only preview, all editing happens via InspectorPanel.
 */
export default function LiveCanvas({
  page,
  measures,
  theme = 'dark',
  selectedVisualId,
  onSelectVisual,
  onDeleteVisual,
}) {
  const T    = getThemeTokens(theme)
  const teal = COLOR_SCHEMES.teal

  const containerRef = useRef(null)
  const [canvasWidth, setCanvasWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w > 0) setCanvasWidth(w - 32)  // subtract horizontal padding
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Build the AppSpec from the active page. Memo on page identity + visuals
  // length so we don't rebuild on every render.
  const appSpec = useMemo(() => pageToAppSpec(page), [
    page?.id,
    page?.visuals,
    page?.name,
  ])

  const isEmpty = (page?.visuals?.length || 0) === 0 ||
    appSpec.visuals.length === 0

  // Page background — used as the canvas inner panel color
  const pageBg = page?.background || (theme === 'light' ? '#FFFFFF' : '#0F1117')

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        background: theme === 'light' ? '#F4F6FA' : '#0a0a14',
        backgroundImage: theme === 'light'
          ? 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)'
          : 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        overflow: 'auto',
        padding: '60px 24px 24px',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      {/* Page info chip — top-left */}
      <div style={{
        position: 'absolute', top: 14, left: 18,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10, color: T.textMuted, letterSpacing: '0.04em',
        textTransform: 'uppercase', fontWeight: 600,
      }}>
        <span>📄</span>
        <span>{page?.name || 'Page'}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{page?.visuals?.length || 0} visual{(page?.visuals?.length || 0) !== 1 ? 's' : ''}</span>
      </div>

      <div style={{
        width: '100%',
        maxWidth: 1200,
      }}>
        {isEmpty ? (
          <EmptyState T={T} teal={teal} />
        ) : (
          <AppSpecRenderer
            spec={appSpec}
            availableMeasures={measures}
            canvasWidth={Math.min(canvasWidth || 1200, 1200)}
            theme={theme}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({ T, teal }) {
  return (
    <div style={{
      width: '100%',
      minHeight: 420,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 60,
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 18,
        background: `linear-gradient(135deg, ${teal.start}22, ${teal.start}08)`,
        border: `1px dashed ${teal.start}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 38,
      }}>
        ✨
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
        This page is empty
      </div>
      <div style={{
        fontSize: 12, color: T.textMuted, maxWidth: 380, textAlign: 'center', lineHeight: 1.6,
      }}>
        Pick a visual type from the inspector on the right, choose a measure,
        and click <strong style={{ color: T.textSecondary }}>+ Add to Page</strong>.
        Visuals render here with live data from your Fabric semantic model.
      </div>
    </div>
  )
}
