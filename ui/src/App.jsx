import React, { useState, useEffect } from 'react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import Setup from './pages/Setup.jsx'
import AiSetup from './pages/AiSetup.jsx'
import Connect from './pages/Connect.jsx'
import Home from './pages/Home.jsx'
import AppGenerator from './pages/AppGenerator.jsx'
import PbiRestyler from './pages/PbiRestyler.jsx'
import PbiInjector from './pages/PbiInjector.jsx'
import SettingsModal from './pages/SettingsModal.jsx'
import Shell from './vilsem/Shell.jsx'
import CommandPalette from './vilsem/CommandPalette.jsx'
import { Home as HomeIcon, Upload, Wand2, Plus, Settings as SettingsIcon, LogOut } from 'lucide-react'

/**
 * App — root component.
 *
 * New project-based flow (UX redesign 2026-04-16):
 *   sign-in → home (project grid) → project editor (AppGenerator)
 *
 * Old multi-tab pages (Playground, Explorer, Health, Audit, Visual Builder,
 * Power BI Mode, Dashboard Builder) are removed from the navigation. Their
 * source files remain for reference but are no longer rendered.
 */

export default function App() {
  const [page, setPage]               = useState('connect')
  const [connectionInfo, setInfo]     = useState(null)
  const [workspaceKey, setKey]        = useState(0)
  const [sessionStart]                = useState(() => new Date().toISOString())
  const [sessionExpired, setExpired]  = useState(false)
  const [showAuthModal, setAuthModal] = useState(false)
  const [expiredWorkspace, setExpWs]  = useState('')

  // Active project: { id, spec, name } or null (new project)
  const [activeProject, setActiveProject] = useState(null)
  const [showSettings, setShowSettings]   = useState(false)
  const [cmdkOpen, setCmdkOpen]           = useState(false)

  useEffect(() => {
    if (!window.semantica) {
      setPage('home')
      return
    }
    window.semantica.onStartupComplete(async (_event, data) => {
      setInfo(data)
      setKey((k) => k + 1)
      // On reload the frontend's authCreds (used by inject/restyle) is gone.
      // For MS-login (interactive) we can silently re-fetch the token so the
      // session is restored and everything keeps working — no manual re-login.
      // For service-principal (secret is never exposed to the renderer) or if
      // the token can't be fetched, land on the login page where the saved
      // profile re-signs in with one click.
      if (data?.authMode === 'interactive' && window.semantica.pbiAuthState) {
        try {
          // Ask the main process whether a usable token exists — WITHOUT ever
          // receiving the token. It stays in the main process; handlers use it.
          const res = await window.semantica.pbiAuthState()
          if (res?.ok) {
            setAuthCreds({ authMode: 'interactive' })
            setPage('home')
            return
          }
        } catch { /* fall through to the login screen */ }
      }
      setPage('setup')
    })
    window.semantica.onShowSetup((_event) => {
      setPage('setup')
    })
    if (window.semantica.onAuthExpired) {
      window.semantica.onAuthExpired((_event, data) => {
        setExpWs(data.workspaceName || '')
        setAuthModal(true)
        setExpired(true)
      })
    }
  }, [])

  // ⌘/Ctrl-K command palette — available on the main screens (not the auth flow).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        if (['connect', 'setup', 'aiSetup'].includes(page)) return
        e.preventDefault()
        setCmdkOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page])

  // Auth creds (stored after Setup, before workspace selection)
  const [authCreds, setAuthCreds] = useState(null)

  // After sign-in, gate on AI setup: first-run users with no provider configured
  // see the S1.5 onboarding; everyone else goes straight Home.
  async function goPostAuth() {
    try {
      const s = await window.semantica?.getAiStatus?.()
      setPage(s?.anyConfigured ? 'home' : 'aiSetup')
    } catch {
      setPage('home')
    }
  }

  function handleSetupComplete(info) {
    if (info?.authOnly) {
      // Auth only — store creds. Workspace/dataset selected in Create Project.
      setAuthCreds(info)
      goPostAuth()
      return
    }
    // Legacy path: full workspace info (from startup-complete or old Setup flow)
    setInfo(info)
    setKey((k) => k + 1)
    goPostAuth()
  }

  async function handleReauth() {
    if (!window.semantica?.reauthMicrosoft) return
    try {
      const res = await window.semantica.reauthMicrosoft()
      if (res?.success) { setAuthModal(false); setExpired(false) }
    } catch { /* keep modal */ }
  }

  function handleCreateProject() {
    setActiveProject(null)
    setPage('project')
  }

  async function handleOpenProject(project) {
    const raw = project.spec || project.config
    const spec = typeof raw === 'string'
      ? (() => { try { return JSON.parse(raw) } catch { return null } })()
      : raw

    // Auto-connect to this project's dataset if not already connected.
    // Saved projects have a datasetId; we need the backend connected to it
    // for AppSpecRenderer to query data and render visual values.
    if (project.datasetId && project.datasetId !== connectionInfo?.datasetId) {
      try {
        // Try to switch to the saved workspace. If creds are available
        // from the current session, the switch will reconnect.
        const ws = await window.semantica?.getWorkspaceConfig?.()
        if (ws) {
          await window.semantica?.switchWorkspace?.({
            ...ws,
            datasetId: project.datasetId,
            datasetName: project.datasetName || project.name || '',
          })
          setInfo((prev) => ({ ...prev, datasetId: project.datasetId, datasetName: project.datasetName || project.name || '' }))
          setKey((k) => k + 1)
        }
      } catch (e) {
        console.warn('[App] Failed to auto-switch workspace for project:', e?.message)
      }
    }

    setActiveProject({ id: project.id, spec, name: project.name || spec?.title || 'Untitled' })
    setPage('project')
  }

  function handleBackToHome() {
    setActiveProject(null)
    setPage('home')
  }

  // ── vilsem shell (Phase 1: wraps existing screens; nothing deleted) ──
  const connection = (() => {
    if (!connectionInfo && !authCreds) return { state: 'disconnected', label: 'Disconnected' }
    const mode = authCreds?.authMode || connectionInfo?.authMode
    if (mode === 'service_principal') return { state: 'sp', label: connectionInfo?.workspaceName || 'Service Principal' }
    return { state: 'connected', label: connectionInfo?.workspaceName || connectionInfo?.datasetName || 'Connected' }
  })()
  const accountLabel = connectionInfo?.workspaceName || connectionInfo?.tenantId || ''
  const handleLogout = () => {
    if (window.semantica?.logoutAll) window.semantica.logoutAll()
    setInfo(null)
    setPage('setup')
  }
  const shellCommon = {
    connection, accountLabel,
    onSettings: () => setShowSettings(true),
    onLogout: handleLogout,
    onCommandPalette: () => setCmdkOpen(true),
  }
  const globalSettings = showSettings ? <SettingsModal onClose={() => setShowSettings(false)} /> : null

  // Command-palette entries (⌘K). Wired to real actions; scoped to the current screen.
  const paletteCommands = [
    ...(page !== 'home' ? [{ id: 'home', label: 'Go to Home', group: 'Go', icon: <HomeIcon size={15} />, run: () => setPage('home') }] : []),
    { id: 'new', label: 'New project', group: 'Create', icon: <Plus size={15} />, run: () => handleCreateProject() },
    { id: 'inject', label: 'Inject visuals into a report', group: 'Go', icon: <Upload size={15} />, run: () => setPage('injector') },
    { id: 'improve', label: 'Improve a report', group: 'Go', icon: <Wand2 size={15} />, run: () => setPage('restyler') },
    { id: 'settings', label: 'Open Settings', group: 'App', icon: <SettingsIcon size={15} />, run: () => setShowSettings(true) },
    { id: 'signout', label: 'Sign out', group: 'App', icon: <LogOut size={15} />, run: () => handleLogout() },
  ]
  const cmdk = <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} commands={paletteCommands} />
  // Screens that manage their own full-bleed sizing fill the shell's <main>.
  const fill = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }

  // ── Auth (no rail — full-bleed per mockup) ───────────────────────────
  if (page === 'connect') {
    return <Shell {...shellCommon} showRail={false}><Connect step={0} />{globalSettings}{cmdk}</Shell>
  }
  if (page === 'setup') {
    return <Shell {...shellCommon} showRail={false}><Setup onComplete={handleSetupComplete} />{globalSettings}{cmdk}</Shell>
  }
  if (page === 'aiSetup') {
    return <Shell {...shellCommon} showRail={false}><AiSetup onComplete={() => setPage('home')} />{globalSettings}{cmdk}</Shell>
  }

  // ── Home ─────────────────────────────────────────────────────────────
  if (page === 'home') {
    return (
      <Shell {...shellCommon} showRail={false} breadcrumb={[{ label: 'Home' }]}>
        <Home
          connectionInfo={connectionInfo}
          authCreds={authCreds}
          onCreateProject={(datasetInfo) => {
            if (datasetInfo) setInfo(datasetInfo)
            setActiveProject({ id: null, spec: null, name: datasetInfo?.projectName || 'Untitled App' })
            setPage('project')
          }}
          onOpenProject={handleOpenProject}
          onRestyleReport={() => setPage('restyler')}  // S13/S14 "Improve a report" (stub path)
          onInjectVisuals={() => setPage('injector')}
          onSettings={() => setShowSettings(true)}
          onLogout={handleLogout}
        />
        {globalSettings}{cmdk}
      </Shell>
    )
  }

  // ── Project Editor (AppGenerator) ────────────────────────────────────
  if (page === 'project') {
    return (
      <Shell {...shellCommon} breadcrumb={[{ label: 'Home', onClick: handleBackToHome }, { label: activeProject?.name || 'Project' }]}>
        <div style={fill}>
          <AppGenerator
            key={workspaceKey}
            initialSpec={activeProject?.spec || null}
            initialProjectId={activeProject?.id || null}
            initialProjectName={activeProject?.name || null}
            onBack={handleBackToHome}
            connectionInfo={connectionInfo}
          />
        </div>
        {globalSettings}{cmdk}
      </Shell>
    )
  }

  // ── PBI Restyler — VILSEM_STUB: S13/S14 design-audit / before-after path.
  //    Render via the existing restyler (unlinked from Home today); v1 scope =
  //    render, don't polish. ──
  if (page === 'restyler') {
    return (
      <Shell {...shellCommon} showRail={false} breadcrumb={[{ label: 'Home', onClick: () => setPage('home') }, { label: 'Restyle' }]}>
        <div style={fill}>
          <PbiRestyler authCreds={authCreds} connectionInfo={connectionInfo} onBack={() => setPage('home')} />
        </div>
        {globalSettings}{cmdk}
      </Shell>
    )
  }

  // ── PBI Injector ─────────────────────────────────────────────────────
  if (page === 'injector') {
    return (
      <Shell {...shellCommon} breadcrumb={[{ label: 'Home', onClick: () => setPage('home') }, { label: 'Inject into Power BI' }]}>
        <div style={fill}>
          <PbiInjector authCreds={authCreds} connectionInfo={connectionInfo} onBack={() => setPage('home')} />
        </div>
        {globalSettings}{cmdk}
      </Shell>
    )
  }

  // Fallback
  return <Shell {...shellCommon} showRail={false}><div style={{ color: 'var(--v-text)', padding: 40 }}>Unknown page: {page}</div></Shell>
}
