import React, { useMemo } from 'react'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'

/**
 * PublishResult — terminal view of the Power BI Mode flow.
 *
 * Renders one of two states:
 *   success → big checkmark, deep link to Power BI service, confetti
 *   failure → big X, error message, common-cause hints, retry button
 */
export default function PublishResult({ result, workspaceId, onBack, onEditAgain }) {
  const T    = getThemeTokens('dark')
  const teal = COLOR_SCHEMES.teal

  const isSuccess = !!result?.success
  const reportUrl = useMemo(() => {
    if (!isSuccess || !workspaceId || !result?.reportId) return null
    return `https://app.powerbi.com/groups/${workspaceId}/reports/${result.reportId}`
  }, [isSuccess, workspaceId, result?.reportId])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a14',
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '14px 14px',
      position: 'relative',
      overflow: 'hidden',
      padding: 32,
    }}>
      {isSuccess && <Confetti />}

      <div style={{
        width: '100%',
        maxWidth: 520,
        padding: '38px 40px 32px',
        background: 'linear-gradient(180deg, rgba(20,20,34,0.98) 0%, rgba(11,11,20,0.99) 100%)',
        border: `1px solid ${T.CARD_BORDER}`,
        borderRadius: 16,
        boxShadow: '0 28px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.025)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Top accent strip */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: isSuccess
            ? `linear-gradient(90deg, ${teal.start}, ${teal.mid})`
            : 'linear-gradient(90deg, #DC2626, #F87171)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
        }} />

        {isSuccess ? (
          <SuccessBody T={T} teal={teal} result={result} reportUrl={reportUrl} onBack={onBack} onEditAgain={onEditAgain} />
        ) : (
          <FailureBody T={T} result={result} onBack={onBack} onEditAgain={onEditAgain} />
        )}
      </div>
    </div>
  )
}

// ── Success ────────────────────────────────────────────────────────────────

function SuccessBody({ T, teal, result, reportUrl, onBack, onEditAgain }) {
  return (
    <>
      <div
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `linear-gradient(135deg, ${teal.start}, ${teal.mid})`,
          color: 'white', fontSize: 36, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 14px 36px ${teal.start}55`,
          marginTop: 6,
          animation: 'pbi-pop 0.55s cubic-bezier(0.22, 1.4, 0.36, 1) both',
        }}
      >
        ✓
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary, marginTop: 6, letterSpacing: '-0.01em' }}>
        Published Successfully
      </div>
      <div style={{ fontSize: 13, color: T.textSecondary, textAlign: 'center', maxWidth: 420 }}>
        <strong style={{ color: T.textPrimary }}>{result?.reportName || 'Your report'}</strong> is now live in your workspace.
      </div>

      {reportUrl && (
        <a
          href={reportUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            marginTop: 8,
            padding: '11px 22px',
            background: teal.start,
            color: 'white',
            border: 'none',
            borderRadius: 9,
            fontSize: 13, fontWeight: 700,
            textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: `0 10px 26px ${teal.start}55`,
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 14px 32px ${teal.start}77` }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = `0 10px 26px ${teal.start}55` }}
        >
          🔗 Open in Power BI
        </a>
      )}

      {result?.importState && (
        <div style={{
          fontSize: 10, color: T.textFaint, fontFamily: 'monospace',
          marginTop: 4,
        }}>
          status: {result.importState}{result.reportId ? ` · id: ${result.reportId}` : ''}
        </div>
      )}

      <div style={{ height: 1, width: '100%', background: T.CARD_BORDER, marginTop: 16 }} />

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <SecondaryButton T={T} onClick={onBack}>← Back to Reports</SecondaryButton>
        <SecondaryButton T={T} teal={teal} primary onClick={onEditAgain}>Edit Again →</SecondaryButton>
      </div>
    </>
  )
}

// ── Failure ────────────────────────────────────────────────────────────────

function FailureBody({ T, result, onBack, onEditAgain }) {
  const errorText = result?.error || 'Unknown error'
  const hint = useMemo(() => commonErrorHint(errorText), [errorText])

  return (
    <>
      <div
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #DC2626, #F87171)',
          color: 'white', fontSize: 34, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 14px 36px rgba(220,38,38,0.4)',
          marginTop: 6,
          animation: 'pbi-shake 0.5s ease',
        }}
      >
        ×
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary, marginTop: 6, letterSpacing: '-0.01em' }}>
        Publish Failed
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, textAlign: 'center' }}>
        Fabric rejected the report payload. Details below.
      </div>

      <div style={{
        width: '100%',
        marginTop: 6,
        padding: '11px 14px',
        background: 'rgba(248,113,113,0.08)',
        border: '1px solid rgba(248,113,113,0.30)',
        borderRadius: 8,
        color: '#FCA5A5',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 160,
        overflow: 'auto',
      }}>
        {errorText}
      </div>

      {hint && (
        <div style={{
          width: '100%',
          padding: '9px 12px',
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.20)',
          borderRadius: 8,
          color: '#FCD34D',
          fontSize: 11, lineHeight: 1.5,
        }}>
          💡 {hint}
        </div>
      )}

      <div style={{ height: 1, width: '100%', background: T.CARD_BORDER, marginTop: 12 }} />

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <SecondaryButton T={T} onClick={onBack}>← Back to Reports</SecondaryButton>
        <SecondaryButton T={T} primary danger onClick={onEditAgain}>Try Again →</SecondaryButton>
      </div>
    </>
  )
}

function commonErrorHint(error) {
  const e = (error || '').toLowerCase()
  if (e.includes('invalid') && e.includes('pbix'))                return 'The report structure may be incompatible with Fabric. Try a smaller report.'
  if (e.includes('unauthor') || e.includes('401'))                return 'Your token may have expired or you lack workspace permissions. Try re-authenticating.'
  if (e.includes('forbidden') || e.includes('403'))               return 'Your account lacks publish permissions on this workspace.'
  if (e.includes('payload too large') || e.includes('413'))       return 'Try fewer visuals or simpler layouts — the .pbix may be over the upload size limit.'
  if (e.includes('not found') || e.includes('404'))               return 'The report or workspace was not found. It may have been deleted.'
  if (e.includes('throttle') || e.includes('429'))                return 'Power BI is rate-limiting requests. Wait a minute and try again.'
  if (e.includes('overload') || e.includes('529') || e.includes('temporarily')) return 'Fabric is temporarily overloaded. Try again in a moment.'
  return null
}

// ── Buttons ────────────────────────────────────────────────────────────────

function SecondaryButton({ T, teal, primary, danger, onClick, children }) {
  const t = teal || COLOR_SCHEMES.teal
  const styles = primary
    ? {
        background: danger ? '#DC2626' : t.start,
        color: 'white',
        border: 'none',
        boxShadow: danger ? '0 6px 18px rgba(220,38,38,0.35)' : `0 6px 18px ${t.start}33`,
      }
    : {
        background: 'rgba(255,255,255,0.04)',
        color: T.textSecondary,
        border: `1px solid ${T.CARD_BORDER}`,
        boxShadow: 'none',
      }
  return (
    <button
      onClick={onClick}
      style={{
        ...styles,
        padding: '9px 16px',
        borderRadius: 8,
        fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'transform 0.12s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {children}
    </button>
  )
}

// ── Confetti (CSS only) ────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  COLOR_SCHEMES.teal.start, COLOR_SCHEMES.teal.mid,
  COLOR_SCHEMES.purple.start, COLOR_SCHEMES.purple.mid,
  COLOR_SCHEMES.gold.start, COLOR_SCHEMES.gold.mid,
]

const CONFETTI_PIECES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left:     Math.random() * 100,
  delay:    Math.random() * 0.6,
  duration: 2.4 + Math.random() * 1.4,
  size:     6 + Math.floor(Math.random() * 8),
  rotate:   Math.random() * 360,
  shape:    Math.random() > 0.5 ? 'square' : 'circle',
  color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

function Confetti() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 0,
    }}>
      {CONFETTI_PIECES.map((p) => (
        <span key={p.id} style={{
          position: 'absolute',
          top: -20,
          left: `${p.left}%`,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.shape === 'circle' ? '50%' : 2,
          animation: `pbi-fall ${p.duration}s cubic-bezier(0.4, 0, 0.6, 1) ${p.delay}s forwards`,
          transform: `rotate(${p.rotate}deg)`,
          opacity: 0.92,
          boxShadow: `0 0 8px ${p.color}66`,
        }} />
      ))}
    </div>
  )
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('pbi-result-keyframes')) {
  const style = document.createElement('style')
  style.id = 'pbi-result-keyframes'
  style.textContent = `
    @keyframes pbi-fall {
      0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
    }
    @keyframes pbi-pop {
      0%   { transform: scale(0.2); opacity: 0; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1);    opacity: 1; }
    }
    @keyframes pbi-shake {
      0%, 100% { transform: translateX(0); }
      20%      { transform: translateX(-6px); }
      40%      { transform: translateX(6px); }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px); }
    }
  `
  document.head.appendChild(style)
}
