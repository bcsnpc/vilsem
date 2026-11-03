import React, { useState } from 'react'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'

/**
 * SetupBanner — one-time install reminder shown at the top of ReportPicker.
 *
 * Power BI Mode publishes reports that embed Microsoft's HTML Content visual
 * (from AppSource). For the published reports to render correctly in Power BI
 * Service, that visual must be installed once into the user's organization
 * (or per-user, depending on tenant settings).
 *
 * The banner explains this requirement and links to the AppSource page. Once
 * dismissed, it stays dismissed via localStorage.
 */

const STORAGE_KEY = 'pbi-setup-banner-dismissed'
// Link to Fabric admin portal where admins upload the .pbiviz. The actual
// .pbiviz file lives at vilsem-renderer/dist/ inside the Semantica
// install directory; admins download it from there and upload here.
const ADMIN_PORTAL_URL = 'https://app.fabric.microsoft.com/admin-portal/organizationalVisuals'

export default function SetupBanner() {
  const T    = getThemeTokens('dark')
  const teal = COLOR_SCHEMES.teal

  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  if (dismissed) return null

  function handleDismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  function handleOpenAdminPortal() {
    // In Electron the link will open in the system browser via target="_blank"
    // because window.open is intercepted by the main process.
    try { window.open(ADMIN_PORTAL_URL, '_blank', 'noopener,noreferrer') }
    catch { /* ignore */ }
  }

  return (
    <div style={{
      margin: '0 0 22px 0',
      padding: '14px 18px',
      background: `linear-gradient(135deg, ${teal.start}14, ${teal.start}06)`,
      border: `1px solid ${teal.start}55`,
      borderRadius: 12,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      position: 'relative',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${teal.start}22`,
        border: `1px solid ${teal.start}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color: teal.mid, flexShrink: 0,
      }}>
        ⚡
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: T.textPrimary,
          marginBottom: 4,
        }}>
          One-time setup: install vilsem Renderer
        </div>
        <div style={{
          fontSize: 11, color: T.textSecondary, lineHeight: 1.55,
        }}>
          Power BI Mode publishes reports using Semantica's own custom visual. Your Power BI
          tenant admin must upload <code style={{ color: T.textPrimary, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>semanticaHtmlRenderer.pbiviz</code> to
          the organizational visual library once. The file lives in the Semantica install
          directory under <code style={{ color: T.textPrimary }}>vilsem-renderer/dist/</code>.
          Without this step, viewers will see <code style={{ color: '#FCA5A5' }}>CustomVisualNotFound</code>.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleOpenAdminPortal}
            style={{
              padding: '7px 13px',
              background: teal.start,
              color: 'white',
              border: 'none',
              borderRadius: 7,
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 6px 16px ${teal.start}44`,
            }}
          >
            ↗ Open Fabric Admin Portal
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '7px 13px',
              background: 'rgba(255,255,255,0.05)',
              color: T.textSecondary,
              border: `1px solid ${T.CARD_BORDER}`,
              borderRadius: 7,
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Got it, dismiss
          </button>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        title="Dismiss"
        style={{
          width: 22, height: 22, borderRadius: 5,
          background: 'transparent',
          border: 'none',
          color: T.textMuted,
          cursor: 'pointer',
          fontSize: 14, lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
