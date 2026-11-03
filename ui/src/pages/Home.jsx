import React, { useState, useEffect, useRef } from 'react'
import { Card } from '../ui/Surface.jsx'
import { Button, IconButton } from '../ui/Button.jsx'
import { Input } from '../ui/Input.jsx'
import { Modal } from '../ui/Modal.jsx'
import { Logo, LogoMark } from '../ui/Logo.jsx'
import { Spinner, EmptyState, StatusDot } from '../ui/Feedback.jsx'
import { useTheme } from '../ui/theme.js'
import { Plus, Settings, LogOut, Search, Wand2, Layers, X, Sun, Moon, Sparkles, ArrowRight } from '../ui/icons.js'
import '../vilsem/tokens.css'

// vilsem Home primary-action card styles
const actionCard = () => ({
  position: 'relative', textAlign: 'left', cursor: 'pointer', padding: 20, font: 'inherit',
  background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)',
  transition: 'border-color .12s, background .12s',
})
const actionIcon = (prime) => ({
  width: 34, height: 34, borderRadius: 'var(--v-r)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', marginBottom: 14,
  background: prime ? 'var(--v-accent-quiet)' : 'var(--v-surface-4)',
  color: prime ? 'var(--v-accent)' : 'var(--v-text-2)',
})

export default function Home({ connectionInfo, authCreds, onOpenProject, onCreateProject, onRestyleReport, onSettings, onLogout }) {
  const [projects, setProjects] = useState([])
  const [projectError, setProjectError] = useState('')
  const [deleteDialog, setDeleteDialog] = useState(null)
  const deletingRef = useRef(false)
  const [loading, setLoading]   = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createStep, setCreateStep]     = useState('workspace')
  const [workspaces, setWorkspaces]     = useState([])
  const [datasets, setDatasets]         = useState([])
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)
  const [selectedDataset, setSelectedDataset]     = useState(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [dialogError, setDialogError]     = useState('')
  const [projectName, setProjectName]     = useState('')
  const [projectSource, setProjectSource] = useState('fabric')
  const [localSource, setLocalSource] = useState(null)

  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState(null) // { x, y, project }
  const [renameDialog, setRenameDialog] = useState(null) // { id, name }
  const [theme, toggleTheme] = useTheme()

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    setProjectError('')
    try {
      if (!window.semantica?.getAppSpecs) throw new Error('Project storage is unavailable.')
      const specs = await window.semantica.getAppSpecs({})
      if (!Array.isArray(specs)) throw new Error('Project storage returned an invalid response.')
      setProjects(specs)
    } catch (error) { setProjectError(error.message || 'Could not load projects.') }
    setLoading(false)
  }

  const creds = authCreds
    ? (authCreds.accessToken
        ? { accessToken: authCreds.accessToken }
        : { tenantId: authCreds.tenantId, clientId: authCreds.clientId, clientSecret: authCreds.clientSecret })
    : null

  async function handleCreateClick() {
    setShowCreateDialog(true); setCreateStep('name'); setProjectName('')
    setProjectSource('fabric'); setLocalSource(null)
    setSelectedWorkspace(null); setSelectedDataset(null); setDialogError(''); setDialogLoading(false)
  }

  async function chooseLocalModel() {
    setDialogError('')
    const result = await window.semantica.selectLocalPowerBIModel()
    if (result?.canceled) return
    if (!result?.success) { setDialogError(result?.error || 'Could not read local project.'); return }
    setLocalSource(result.source)
  }

  async function createLocalReport() {
    if (!localSource || !projectName.trim() || dialogLoading) return
    setDialogLoading(true); setDialogError('')
    try {
      const result = await window.semantica.connectLocalPowerBIModel({ path: localSource.projectPath || localSource.modelPath })
      if (!result?.success) throw new Error(result?.error || 'Local connection failed.')
      setShowCreateDialog(false)
      onCreateProject({ ...result.connection, projectName: projectName.trim() })
    } catch (error) { setDialogError(error.message || 'Local connection failed.') }
    finally { setDialogLoading(false) }
  }

  async function handleWorkspaceNext() {
    if (!selectedWorkspace) return
    setDialogLoading(true); setDialogError('')
    try {
      const res = await window.semantica?.getDatasets?.({ ...(creds || {}), workspaceId: selectedWorkspace.id })
      setDatasets(Array.isArray(res?.datasets) ? res.datasets : [])
    } catch { setDatasets([]) }
    setCreateStep('dataset')
    setDialogLoading(false)
  }

  async function handleCreateConfirm() {
    if (!selectedDataset || !selectedWorkspace) return
    setDialogLoading(true)
    try {
      const result = await window.semantica?.connectDataset?.({
        workspaceId: selectedWorkspace.id, workspaceName: selectedWorkspace.name,
        datasetId: selectedDataset.id, datasetName: selectedDataset.name,
        authMode: authCreds?.authMode || connectionInfo?.authMode,
        tenantId: authCreds?.tenantId || connectionInfo?.tenantId,
        clientId: authCreds?.clientId || connectionInfo?.clientId,
        clientSecret: authCreds?.clientSecret || connectionInfo?.clientSecret,
        accessToken: authCreds?.accessToken,
        refreshToken: authCreds?.refreshToken,
        expiresIn: authCreds?.expiresIn,
      })
      if (result && !result.success) throw new Error(result.error || 'Connection failed')
    } catch (e) { setDialogError(e?.message || 'Failed'); setDialogLoading(false); return }
    setShowCreateDialog(false)
    onCreateProject({
      workspaceId: selectedWorkspace.id, workspaceName: selectedWorkspace.name,
      datasetId: selectedDataset.id, datasetName: selectedDataset.name,
      projectName: projectName.trim() || 'Untitled App',
    })
  }

  function handleDelete(id) {
    const project = projects.find(item => item.id === id)
    setDeleteDialog({ id, name: project?.name || 'Untitled project', busy: false, error: '' })
  }

  async function confirmDelete() {
    if (!deleteDialog || deletingRef.current) return
    deletingRef.current = true
    const id = deleteDialog.id
    setDeleteDialog(current => ({ ...current, busy: true, error: '' }))
    try {
      if (!window.semantica?.deleteAppSpec) throw new Error('Project storage is unavailable.')
      const result = await window.semantica.deleteAppSpec({ id })
      if (result?.success === false) throw new Error(result.error || result.message || 'Could not delete project.')
      setProjects(current => current.filter(project => project.id !== id))
      setDeleteDialog(null)
    } catch (error) {
      setDeleteDialog(current => ({ ...current, busy: false, error: error.message || 'Could not delete project.' }))
    } finally { deletingRef.current = false }
  }

  function handleRename(project) {
    const spec = typeof project.config === 'string' ? (() => { try { return JSON.parse(project.config) } catch { return project.spec } })() : (project.spec || project.config)
    const current = project.name || spec?.title || 'Untitled'
    setRenameDialog({ id: project.id, name: current })
  }

  async function confirmRename() {
    if (!renameDialog?.name?.trim()) return
    try {
      await window.semantica?.renameAppSpec?.({ id: renameDialog.id, name: renameDialog.name.trim() })
      await loadProjects()
    } catch (error) {
      setRenameDialog(current => current ? { ...current, error: error.message || 'Rename failed. Try again.' } : current)
      return
    }
    setRenameDialog(null)
  }

  async function goToWorkspaceStep() {
    setCreateStep('workspace'); setDialogLoading(true)
    try { const res = await window.semantica?.getWorkspaces?.(creds || {}); setWorkspaces(Array.isArray(res?.workspaces) ? res.workspaces : []) }
    catch { setWorkspaces([]) }
    setDialogLoading(false)
  }

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true
    const spec = typeof p.config === 'string' ? (() => { try { return JSON.parse(p.config) } catch { return p.spec } })() : (p.spec || p.config)
    const title = (p.name || spec?.title || '').toLowerCase()
    return title.includes(search.trim().toLowerCase())
  })

  return (
    <div onClick={() => contextMenu && setContextMenu(null)} style={{
      height: '100%', background: 'var(--surface-base)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header removed — the vilsem shell provides window controls, wordmark,
          connection pill, Settings (rail) and Sign out (avatar menu). */}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(24px, 4vw, 56px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--v-accent)', marginBottom: 8 }}>Start</div>
          <h1 style={{ margin: 0, font: '600 22px var(--v-font)', letterSpacing: '-.01em', color: 'var(--v-text)' }}>What are we building?</h1>
          <div style={{ font: '400 13px var(--v-font)', color: 'var(--v-text-muted)', margin: '4px 0 26px' }}>
            Compose ECharts visuals over your semantic model, then publish or export.
          </div>

          {/* Primary actions (three cards per mockup S2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <button onClick={handleCreateClick} style={actionCard()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-border-strong)'; e.currentTarget.style.background = 'var(--v-surface-2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.background = 'var(--v-surface)' }}>
              <div style={actionIcon(false)}><Plus size={18} /></div>
              <div style={{ font: '600 15px var(--v-font)', color: 'var(--v-text)', marginBottom: 5 }}>Create new project</div>
              <div style={{ font: '400 12px var(--v-font)', color: 'var(--v-text-muted)', lineHeight: 1.5 }}>Build a new dashboard from a semantic model — export as a web package or publish.</div>
              <ArrowRight size={16} style={{ position: 'absolute', top: 18, right: 18, color: 'var(--v-text-faint)' }} />
            </button>
            {/* "Improve an existing report" hidden for v1-beta (restyler route kept in App.jsx). */}
            {false && (
            <button onClick={onRestyleReport || (() => {})} style={{ ...actionCard(), opacity: onRestyleReport ? 1 : 0.85 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v-border-strong)'; e.currentTarget.style.background = 'var(--v-surface-2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.background = 'var(--v-surface)' }}>
              <span style={{ position: 'absolute', top: 14, right: 14, font: '600 9px var(--v-mono)', letterSpacing: '.06em', color: 'var(--v-amber)', background: 'var(--v-amber-quiet)', border: '1px solid var(--v-amber)', borderRadius: 2, padding: '1px 5px' }}>V2</span>
              <div style={actionIcon(false)}><Wand2 size={18} /></div>
              <div style={{ font: '600 15px var(--v-font)', color: 'var(--v-text)', marginBottom: 5 }}>Improve an existing report</div>
              <div style={{ font: '400 12px var(--v-font)', color: 'var(--v-text-muted)', lineHeight: 1.5 }}>Audit design, apply a brand, fix alignment &amp; clutter — review every change first.</div>
            </button>
            )}
          </div>

          {/* Recent */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '34px 0 10px' }}>
            <div style={{ font: '600 10px var(--v-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--v-text-faint)' }}>Recent</div>
            {projects.length > 5 && (
              <input aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ width: 180, boxSizing: 'border-box', padding: '5px 9px', background: 'var(--v-bg-1)', border: '1px solid var(--v-border)', borderRadius: 'var(--v-r)', color: 'var(--v-text)', font: '400 12px var(--v-font)', outline: 'none' }} />
            )}
          </div>
          {projectError && <div role="alert" style={{ padding: 16, color: 'var(--danger)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
            <div>Could not load projects. {projectError}</div>
            <Button size="sm" onClick={loadProjects} disabled={loading} style={{ marginTop: 10 }}>Retry loading projects</Button>
          </div>}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={20} /></div>
          ) : projectError && projects.length === 0 ? null : filtered.length === 0 ? (
            <div style={{ padding: 22, textAlign: 'center', border: '1px dashed var(--v-border)', borderRadius: 'var(--v-r-2)', font: '400 12px var(--v-font)', color: 'var(--v-text-muted)' }}>
              {search.trim() ? 'No projects match your search.' : 'No projects yet. Create one above.'}
              {search.trim() && <div style={{ marginTop: 10 }}><Button size="sm" onClick={() => setSearch('')}>Clear search</Button></div>}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--v-border)', borderRadius: 'var(--v-r-2)', overflow: 'hidden', background: 'var(--v-surface)' }}>
              {filtered.map((p, i) => {
                const spec = typeof p.config === 'string' ? (() => { try { return JSON.parse(p.config) } catch { return p.spec } })() : (p.spec || p.config)
                const title   = p.name || spec?.title || 'Untitled'
                const count   = Array.isArray(spec?.pages) && spec.pages.length ? spec.pages.reduce((total, page) => total + (page.visuals?.length || 0), 0) : spec?.visuals?.length || 0
                const date    = p.updatedAt || p.createdAt
                const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                return (
                  <div key={p.id} role="group" aria-label={title} onClick={() => onOpenProject(p)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, project: p }) }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--v-surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer', borderTop: i ? '1px solid var(--v-border-subtle)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 'var(--v-r)', background: 'var(--v-accent-quiet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoMark size={16} /></div>
                    <button type="button" onClick={e => { e.stopPropagation(); onOpenProject(p) }} aria-label={`Open ${title}`} style={{ flex: 1, minWidth: 0, padding: 0, border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ font: '500 13px var(--v-font)', color: 'var(--v-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                      <div style={{ font: '400 11px var(--v-mono)', color: 'var(--v-text-muted)', marginTop: 2 }}>{count} visual{count !== 1 ? 's' : ''}{dateStr && ` · ${dateStr}`}</div>
                    </button>
                    <button aria-label={`Delete ${title}`} onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} title="Delete"
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--v-danger)'; e.currentTarget.style.background = 'var(--v-surface-3)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--v-text-faint)'; e.currentTarget.style.background = 'transparent' }}
                      style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--v-text-faint)', cursor: 'pointer', borderRadius: 'var(--v-r)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Dialog */}
      {showCreateDialog && (
        <Modal
          title="New project"
          onClose={() => setShowCreateDialog(false)}
          footer={
            <>
              {(createStep === 'dataset' || createStep === 'workspace') && (
                <Button variant="ghost" style={{ marginRight: 'auto' }} onClick={() => setCreateStep(createStep === 'dataset' ? 'workspace' : 'name')}>← Back</Button>
              )}
              <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              {createStep === 'name' ? (
                <Button variant="primary" onClick={projectSource === 'local' ? createLocalReport : goToWorkspaceStep} loading={dialogLoading} disabled={!projectName.trim() || (projectSource === 'local' && !localSource)}>Next →</Button>
              ) : createStep === 'workspace' ? (
                <Button variant="primary" onClick={handleWorkspaceNext} disabled={!selectedWorkspace}>Next →</Button>
              ) : (
                <Button variant="canvas" onClick={handleCreateConfirm} disabled={!selectedDataset || dialogLoading} loading={dialogLoading}>Create</Button>
              )}
            </>
          }
        >
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
            {createStep === 'name' ? 'Give your project a name.'
             : createStep === 'workspace' ? 'Select a Fabric workspace.'
             : `Select a dataset in ${selectedWorkspace?.name || 'workspace'}.`}
          </div>

          {dialogError && (
            <div style={{ padding: '8px 12px', background: 'var(--danger-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: 'var(--fs-sm)', marginBottom: 12 }}>
              {dialogError}
            </div>
          )}

          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {createStep === 'name' ? (
              <><Input aria-label="Project name" autoFocus value={projectName} onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && projectName.trim()) { if (projectSource === 'local') createLocalReport(); else goToWorkspaceStep() } }}
                placeholder="My Analytics Dashboard" />
              <div role="group" aria-label="Semantic model source" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button aria-pressed={projectSource === 'fabric'} onClick={() => setProjectSource('fabric')} disabled={dialogLoading}>Fabric model</Button>
                <Button aria-pressed={projectSource === 'local'} onClick={() => setProjectSource('local')} disabled={dialogLoading}>Local PBIP model</Button>
              </div>
              {projectSource === 'local' && <div style={{ marginTop: 12 }}>
                <p>Create a new Vilsem report using a local model. Open the model or an unchanged copy in Power BI Desktop first. Your existing report is not imported or overwritten.</p>
                <Button onClick={chooseLocalModel} disabled={dialogLoading}>Choose PBIP folder</Button>
                {localSource && <p role="status" style={{ overflowWrap: 'anywhere' }}>{localSource.name}<br />{localSource.modelPath}</p>}
              </div>}</>
            ) : dialogLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner size={20} /></div>
            ) : createStep === 'workspace' ? (
              workspaces.map((ws) => <PickRow key={ws.id} label={ws.name || ws.id} selected={selectedWorkspace?.id === ws.id} onClick={() => setSelectedWorkspace(ws)} />)
            ) : (
              datasets.map((ds) => <PickRow key={ds.id} label={ds.name || ds.id} selected={selectedDataset?.id === ds.id} tone="canvas" onClick={() => setSelectedDataset(ds)} />)
            )}
          </div>
        </Modal>
      )}

      {deleteDialog && <Modal title="Delete project" onClose={deleteDialog.busy ? undefined : () => setDeleteDialog(null)} footer={<>
        <Button onClick={() => setDeleteDialog(null)} disabled={deleteDialog.busy}>Cancel</Button>
        <Button onClick={confirmDelete} loading={deleteDialog.busy} disabled={deleteDialog.busy}>Delete project</Button>
      </>}>
        <p>Delete <strong>{deleteDialog.name}</strong> from your saved projects? This cannot be undone. The connected semantic model is not deleted.</p>
        {deleteDialog.error && <p role="alert" style={{ color: 'var(--danger)' }}>{deleteDialog.error} You can retry.</p>}
      </Modal>}

      {/* Rename dialog */}
      {renameDialog && (
        <Modal
          title="Rename project" size="sm"
          onClose={() => setRenameDialog(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setRenameDialog(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmRename}>Rename</Button>
          </>}
        >
          <Input autoFocus value={renameDialog.name}
            onChange={e => setRenameDialog(prev => ({ ...prev, name: e.target.value, error: null }))}
            onKeyDown={e => { if (e.key === 'Enter') confirmRename() }} />
          {renameDialog.error && <p role="alert" style={{ color: 'var(--danger, #ef4444)', fontSize: 13 }}>{renameDialog.error}</p>}
        </Modal>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9100,
          background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
          padding: 4, minWidth: 150, boxShadow: 'var(--shadow-lg)',
        }}>
          {[
            { label: 'Open', action: () => { setContextMenu(null); onOpenProject(contextMenu.project) } },
            { label: 'Rename', action: () => { setContextMenu(null); handleRename(contextMenu.project) } },
            { label: 'Delete', action: () => { setContextMenu(null); handleDelete(contextMenu.project.id) }, danger: true },
          ].map(item => (
            <button key={item.label} onClick={item.action} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: 'none', color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
              fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Selectable row used inside the Create Project dialog.
function PickRow({ label, selected, tone, onClick }) {
  const accent = tone === 'canvas' ? 'var(--accent-canvas)' : 'var(--accent)'
  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', marginBottom: 4, borderRadius: 'var(--radius-md)', cursor: 'pointer',
      background: selected ? 'var(--accent-subtle)' : 'transparent',
      border: `1px solid ${selected ? 'var(--accent-border)' : 'transparent'}`,
      color: selected ? accent : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: selected ? 600 : 400,
      transition: 'background var(--dur-fast) var(--ease-standard)',
    }}>
      {label}
    </div>
  )
}
