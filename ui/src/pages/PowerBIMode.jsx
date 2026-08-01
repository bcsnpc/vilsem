import React, { useEffect, useState } from 'react'
import ReportPicker  from './powerbi/ReportPicker.jsx'
import ReportEditor  from './powerbi/ReportEditor.jsx'
import PublishResult from './powerbi/PublishResult.jsx'
import { getThemeTokens } from '../appspec/getThemeTokens'

/**
 * PowerBIMode — root page for the Power BI mode flow.
 *
 * Owns the local state machine for which sub-view is shown:
 *   picker  → ReportPicker  (list / create new)
 *   editor  → ReportEditor  (3-column editor)
 *   publish → PublishResult (success / failure terminal view)
 *
 * Connection info (workspaceId / datasetId / names) is passed in from App.jsx
 * via the existing connectionInfo state — no new IPC roundtrips here.
 */
export default function PowerBIMode({ connectionInfo }) {
  const T = getThemeTokens('dark')

  const [view, setView]                     = useState('picker')   // 'picker' | 'editor' | 'publish'
  const [selectedReport, setSelectedReport] = useState(null)
  const [isNewReport, setIsNewReport]       = useState(false)
  const [publishResult, setPublishResult]   = useState(null)
  const [reportName, setReportName]         = useState('New Semantica Report')
  // Optional draft to restore when entering the editor (from ReportPicker → Drafts → Continue)
  const [restoreDraft, setRestoreDraft]     = useState(null)

  const workspaceId   = connectionInfo?.workspaceId   || ''
  const datasetId     = connectionInfo?.datasetId     || ''
  const workspaceName = connectionInfo?.workspaceName || ''
  const datasetName   = connectionInfo?.datasetName   || ''

  // Whenever the user picks a different report or starts a new one, sync the
  // local reportName state. The editor's PageManager input writes back here.
  useEffect(() => {
    if (isNewReport) {
      setReportName('New Semantica Report')
    } else if (selectedReport?.name) {
      setReportName(selectedReport.name)
    }
  }, [isNewReport, selectedReport?.id, selectedReport?.name])

  function handleSelectReport(report) {
    setSelectedReport(report)
    setIsNewReport(false)
    setPublishResult(null)
    setRestoreDraft(null)
    setReportName(report?.name || 'New Semantica Report')
    setView('editor')
  }

  function handleCreateNew() {
    setSelectedReport(null)
    setIsNewReport(true)
    setPublishResult(null)
    setRestoreDraft(null)
    setReportName('New Semantica Report')
    setView('editor')
  }

  /**
   * Continue editing a saved draft from the picker.
   * The draft already carries pages + injectionScope + renderer; ReportEditor
   * will pick it up via the `initialDraft` prop.
   */
  function handleContinueDraft(draft) {
    if (!draft) return
    const stub = draft.reportId
      ? { id: draft.reportId, name: draft.reportName, datasetId }
      : null
    setSelectedReport(stub)
    setIsNewReport(!draft.reportId)
    setPublishResult(null)
    setRestoreDraft(draft)
    setReportName(draft.reportName || 'New Semantica Report')
    setView('editor')
  }

  function handleBackToPicker() {
    setSelectedReport(null)
    setIsNewReport(false)
    setPublishResult(null)
    setRestoreDraft(null)
    setView('picker')
  }

  function handlePublishComplete(result) {
    setPublishResult(result)
    setView('publish')
  }

  function handleEditAgain() {
    setPublishResult(null)
    setView('editor')
  }

  // Build the report object passed to ReportEditor.
  // For "new", we synthesize a placeholder so the editor can render immediately.
  const editorReport = isNewReport
    ? { id: null, name: 'New Semantica Report', datasetId }
    : selectedReport

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#0b0b14',
      color: T.textPrimary,
      overflow: 'hidden',
    }}>
      {view === 'picker' && (
        <ReportPicker
          workspaceId={workspaceId}
          datasetId={datasetId}
          workspaceName={workspaceName}
          datasetName={datasetName}
          onSelectReport={handleSelectReport}
          onCreateNew={handleCreateNew}
          onContinueDraft={handleContinueDraft}
        />
      )}

      {view === 'editor' && (
        <ReportEditor
          report={editorReport}
          workspaceId={workspaceId}
          datasetId={datasetId}
          connectionInfo={connectionInfo}
          reportName={reportName}
          onRenameReport={setReportName}
          initialDraft={restoreDraft}
          onPublish={handlePublishComplete}
          onBack={handleBackToPicker}
        />
      )}

      {view === 'publish' && (
        <PublishResult
          result={publishResult}
          workspaceId={workspaceId}
          onBack={handleBackToPicker}
          onEditAgain={handleEditAgain}
        />
      )}
    </div>
  )
}
