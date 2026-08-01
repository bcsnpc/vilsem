import React, { useEffect, useRef, useState } from 'react'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'

/**
 * PageManager — left column of ReportEditor.
 * Header: back arrow, editable report name, Save Draft + Publish buttons.
 * Body:   page list with rename / delete / +Add Page.
 */
export default function PageManager({
  reportName,
  onRenameReport,
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onBack,
  onPublish,
  publishing,
  reportLoading,
  onSaveDraft,
  savingDraft,
  showSavedToast,
  lastSavedAt,
  collapsed,
}) {
  // When collapsed, render a thin sidebar with just the publish + page count
  if (collapsed) {
    return <CollapsedPageManager
      pages={pages}
      activePageId={activePageId}
      onSelectPage={onSelectPage}
      onBack={onBack}
      onPublish={onPublish}
      publishing={publishing}
      reportLoading={reportLoading}
    />
  }

  const T    = getThemeTokens('dark')
  const teal = COLOR_SCHEMES.teal

  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  // Editable report name — local state shadows the prop while user is typing
  const [editingReportName, setEditingReportName] = useState(false)
  const [reportNameDraft,   setReportNameDraft]   = useState(reportName || '')
  const reportNameInputRef = useRef(null)

  // Sync local draft when the prop changes from outside (e.g. draft restore)
  useEffect(() => {
    if (!editingReportName) setReportNameDraft(reportName || '')
  }, [reportName, editingReportName])

  function startRename(page) {
    setRenamingId(page.id)
    setRenameValue(page.name)
  }
  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRenamePage(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function startEditingReportName() {
    setEditingReportName(true)
    setReportNameDraft(reportName || '')
    setTimeout(() => {
      reportNameInputRef.current?.focus()
      reportNameInputRef.current?.select()
    }, 0)
  }
  function commitReportName() {
    setEditingReportName(false)
    const next = (reportNameDraft || '').trim()
    if (next && next !== reportName && onRenameReport) {
      onRenameReport(next)
    } else {
      setReportNameDraft(reportName || '')
    }
  }

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'rgba(15,17,23,0.7)',
      borderRight: `1px solid ${T.CARD_BORDER}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: `1px solid ${T.CARD_BORDER}`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Row 1: back arrow + editable report name + pencil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            title="Back to reports"
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${T.CARD_BORDER}`,
              color: T.textSecondary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            ←
          </button>

          {editingReportName ? (
            <input
              ref={reportNameInputRef}
              value={reportNameDraft}
              onChange={(e) => setReportNameDraft(e.target.value)}
              onBlur={commitReportName}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  { e.preventDefault(); commitReportName() }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setReportNameDraft(reportName || '')
                  setEditingReportName(false)
                }
              }}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${teal.start}`,
                color: T.textPrimary,
                fontSize: 12, fontWeight: 700,
                padding: '3px 0',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          ) : (
            <button
              onClick={startEditingReportName}
              title={`${reportName} — click to rename`}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 'none',
                padding: 0, cursor: 'text',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <span style={{
                flex: 1, minWidth: 0,
                fontSize: 12, fontWeight: 700, color: T.textPrimary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textAlign: 'left',
              }}>
                {reportName}
              </span>
              <span style={{
                fontSize: 10, color: T.textMuted, opacity: 0.7,
                flexShrink: 0,
              }}>
                ✎
              </span>
            </button>
          )}
        </div>

        {/* Row 2: Save Draft + Publish */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onSaveDraft}
            disabled={savingDraft || publishing}
            title="Save draft to local cache"
            style={{
              flex: '0 0 auto',
              padding: '8px 10px',
              background: savingDraft ? `${teal.start}22` : 'rgba(255,255,255,0.04)',
              color: savingDraft ? teal.mid : T.textSecondary,
              border: `1px solid ${savingDraft ? teal.start + '66' : T.CARD_BORDER}`,
              borderRadius: 7,
              fontSize: 11, fontWeight: 600,
              cursor: (savingDraft || publishing) ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {savingDraft ? '…' : '💾'} Save
          </button>
          <button
            onClick={onPublish}
            disabled={publishing || reportLoading}
            title={reportLoading ? 'Waiting for report to finish loading…' : undefined}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: (publishing || reportLoading) ? 'rgba(255,255,255,0.06)' : teal.start,
              color: (publishing || reportLoading) ? T.textMuted : 'white',
              border: 'none', borderRadius: 7,
              fontSize: 12, fontWeight: 600,
              cursor: (publishing || reportLoading) ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: (publishing || reportLoading) ? 'none' : `0 6px 18px ${teal.start}33`,
              fontFamily: 'inherit',
            }}
          >
            {publishing
              ? '⚡ Publishing…'
              : reportLoading
                ? '⟳ Loading…'
                : 'Publish →'}
          </button>
        </div>

        {/* Saved confirmation strip */}
        {showSavedToast && (
          <div style={{
            fontSize: 10, color: teal.mid,
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 0 0 2px',
          }}>
            ✓ Draft saved
          </div>
        )}
        {!showSavedToast && lastSavedAt && (
          <div style={{
            fontSize: 9, color: T.textFaint,
            padding: '2px 0 0 2px',
          }}>
            Last saved {relativeTime(lastSavedAt)}
          </div>
        )}
      </div>

      {/* Page list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 8px' }}>
        <div style={{
          fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: T.textMuted, padding: '4px 8px 8px',
        }}>
          Pages · {pages.length}
        </div>

        {pages.map((page) => {
          const active = page.id === activePageId
          const visualCount = page.visuals?.length || 0
          const renaming = renamingId === page.id

          return (
            <div
              key={page.id}
              onClick={() => !renaming && onSelectPage(page.id)}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px 8px 12px',
                marginBottom: 3,
                borderRadius: 7,
                cursor: renaming ? 'text' : 'pointer',
                background: active ? 'rgba(20,184,166,0.10)' : 'transparent',
                borderLeft: `3px solid ${active ? teal.start : 'transparent'}`,
                color: active ? T.textPrimary : T.textSecondary,
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => { if (!active && !renaming) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { if (!active && !renaming) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 13, opacity: 0.75 }}>📄</span>

              {renaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); commitRename() }
                    if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                  }}
                  style={{
                    flex: 1, minWidth: 0,
                    background: 'rgba(0,0,0,0.35)',
                    border: `1px solid ${teal.start}66`,
                    color: T.textPrimary,
                    fontSize: 12, padding: '3px 6px', borderRadius: 4,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  title={page.name}
                  style={{
                    flex: 1, minWidth: 0,
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {page.name}
                </div>
              )}

              <span style={{
                fontSize: 9, fontWeight: 600,
                padding: '1px 6px', borderRadius: 99,
                background: active ? `${teal.start}33` : 'rgba(255,255,255,0.05)',
                color: active ? teal.mid : T.textMuted,
                border: `1px solid ${active ? teal.start + '44' : 'rgba(255,255,255,0.06)'}`,
                flexShrink: 0,
              }}>
                {visualCount}
              </span>

              {/* Inline actions on hover (always shown to avoid extra menu wiring) */}
              {!renaming && (
                <PageActions
                  T={T}
                  onRename={() => startRename(page)}
                  onDelete={() => {
                    if (pages.length <= 1) return
                    if (confirm(`Delete page "${page.name}"?`)) onDeletePage(page.id)
                  }}
                  canDelete={pages.length > 1}
                />
              )}
            </div>
          )
        })}

        <button
          onClick={onAddPage}
          style={{
            width: '100%',
            marginTop: 6,
            padding: '8px 10px',
            background: 'transparent',
            border: `1px dashed ${T.CARD_BORDER}`,
            color: T.textSecondary,
            borderRadius: 7,
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${teal.start}66`; e.currentTarget.style.color = teal.start }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.CARD_BORDER;     e.currentTarget.style.color = T.textSecondary }}
        >
          ＋ Add Page
        </button>
      </div>
    </aside>
  )
}

function PageActions({ T, onRename, onDelete, canDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        title="Page actions"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.10)' : 'transparent',
          color: T.textMuted, fontSize: 12, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ⋯
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 22, right: 0, zIndex: 200,
            background: '#15172A',
            border: `1px solid ${T.CARD_BORDER}`,
            borderRadius: 7,
            boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
            minWidth: 110, overflow: 'hidden',
          }}>
            <MenuItem T={T} onClick={() => { setOpen(false); onRename() }} label="Rename" />
            <MenuItem
              T={T}
              onClick={() => { if (canDelete) { setOpen(false); onDelete() } }}
              label="Delete"
              danger
              disabled={!canDelete}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ T, onClick, label, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', textAlign: 'left',
        padding: '7px 11px', border: 'none',
        background: 'transparent',
        color: disabled ? T.textFaint : (danger ? '#F87171' : T.textSecondary),
        fontSize: 11, fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {label}
    </button>
  )
}

// ─── Collapsed mode ────────────────────────────────────────────────────────

function CollapsedPageManager({
  pages,
  activePageId,
  onSelectPage,
  onBack,
  onPublish,
  publishing,
  reportLoading,
}) {
  const T    = getThemeTokens('dark')
  const teal = COLOR_SCHEMES.teal
  const total = pages?.length || 0
  return (
    <aside style={{
      width: 56, flexShrink: 0,
      background: 'rgba(15,17,23,0.7)',
      borderRight: `1px solid ${T.CARD_BORDER}`,
      display: 'flex', flexDirection: 'column',
      padding: '10px 8px',
      gap: 8,
      alignItems: 'center',
    }}>
      <button
        onClick={onBack}
        title="Back to reports"
        style={{
          width: 36, height: 30, borderRadius: 6,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${T.CARD_BORDER}`,
          color: T.textSecondary, cursor: 'pointer',
          fontSize: 14, fontFamily: 'inherit',
        }}
      >←</button>

      <div style={{ height: 1, width: '100%', background: T.CARD_BORDER, margin: '4px 0' }} />

      <div style={{
        fontSize: 9, color: T.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase',
        textAlign: 'center', fontWeight: 600,
      }}>
        Pages
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
        flex: 1, overflow: 'auto',
      }}>
        {(pages || []).map((p, idx) => {
          const active = p.id === activePageId
          return (
            <button
              key={p.id}
              onClick={() => onSelectPage(p.id)}
              title={p.name}
              style={{
                width: '100%', padding: '6px 0',
                background: active ? `${teal.start}22` : 'transparent',
                border: `1px solid ${active ? teal.start + '66' : 'transparent'}`,
                color: active ? teal.mid : T.textSecondary,
                borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>

      <button
        onClick={onPublish}
        disabled={publishing || reportLoading}
        title={publishing ? 'Publishing…' : reportLoading ? 'Loading…' : 'Publish to Fabric'}
        style={{
          width: 40, height: 40, borderRadius: 8,
          background: (publishing || reportLoading) ? 'rgba(255,255,255,0.06)' : teal.start,
          color: (publishing || reportLoading) ? T.textMuted : 'white',
          border: 'none', fontSize: 16, fontWeight: 700,
          cursor: (publishing || reportLoading) ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: (publishing || reportLoading) ? 'none' : `0 6px 18px ${teal.start}44`,
        }}
      >
        ↑
      </button>

      <div style={{ fontSize: 8, color: T.textFaint, fontWeight: 600 }}>
        {total} pg
      </div>
    </aside>
  )
}

function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60)  return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60)  return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}
