const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('semantica', {
  // ── Queries ──────────────────────────────────────────────────────────────
  query:       (params) => ipcRenderer.invoke('query',     params),
  batch:       (params) => ipcRenderer.invoke('batch',     params),
  writeback:   (params) => ipcRenderer.invoke('writeback', params),

  // ── Health / metadata ─────────────────────────────────────────────────
  getHealth:             ()       => ipcRenderer.invoke('get-health'),
  getMeasures:           ()       => ipcRenderer.invoke('get-measures'),
  getDimensions:         ()       => ipcRenderer.invoke('get-dimensions'),
  getAuditLog:           (params) => ipcRenderer.invoke('get-audit',             params),
  getMeasureRegistry:    ()       => ipcRenderer.invoke('get-measure-registry'),
  removeMeasureRegistry: (params) => ipcRenderer.invoke('remove-measure-registry', params),
  importFromFile:        ()       => ipcRenderer.invoke('import-from-file'),

  // ── Connection / workspace setup ──────────────────────────────────────
  startMsLogin:       ()       => ipcRenderer.invoke('start-ms-login'),
  testAuth:           (creds)  => ipcRenderer.invoke('test-auth',         creds),
  getWorkspaces:      (creds)  => ipcRenderer.invoke('get-workspaces',    creds),
  getDatasets:        (params) => ipcRenderer.invoke('get-datasets',      params),
  getLakehouses:      (params) => ipcRenderer.invoke('get-lakehouses',    params),
  saveWorkspace:      (config) => ipcRenderer.invoke('save-workspace',    config),
  getSavedWorkspaces: ()       => ipcRenderer.invoke('get-saved-workspaces'),
  switchWorkspace:    (params) => ipcRenderer.invoke('switch-workspace',  params),
  connectDataset:     (params) => ipcRenderer.invoke('connect-dataset',   params),
  deleteWorkspace:    (params) => ipcRenderer.invoke('delete-workspace',  params),
  getWorkspaceConfig: ()       => ipcRenderer.invoke('get-workspace-config'),

  // ── Window controls ───────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close:    () => ipcRenderer.invoke('close-window'),

  // ── Events ────────────────────────────────────────────────────────────
  onStartupComplete: (cb) => ipcRenderer.on('startup-complete', cb),
  onShowSetup:       (cb) => ipcRenderer.on('show-setup',       cb),
  onMetadataUpdated: (cb) => ipcRenderer.on('metadata-updated', cb),
  onAuthExpired:     (cb) => ipcRenderer.on('auth-expired',     cb),

  // ── Re-auth ───────────────────────────────────────────────────────────
  reauthMicrosoft: () => ipcRenderer.invoke('reauth-microsoft'),

  // ── Visual Builder ────────────────────────────────────────────────────
  queryTable:        (params) => ipcRenderer.invoke('query-table',         params),
  getDistinctValues: (params) => ipcRenderer.invoke('get-distinct-values', params),
  saveVisual:        (params) => ipcRenderer.invoke('save-visual',         params),
  loadVisuals:  (params) => ipcRenderer.invoke('load-visuals', params),
  deleteVisual: (params) => ipcRenderer.invoke('delete-visual', params),
  // Playground Spike — custom-visual templates
  saveCustomTemplate:   (params) => ipcRenderer.invoke('save-custom-template',   params),
  loadCustomTemplates:  (params) => ipcRenderer.invoke('load-custom-templates',  params),
  deleteCustomTemplate: (params) => ipcRenderer.invoke('delete-custom-template', params),
  // Playground Spike (Phase 7) — AI generation + trial telemetry
  generateCustomTemplate: (params) => ipcRenderer.invoke('generate-custom-template', params),
  appendPlaygroundLog:    (record) => ipcRenderer.invoke('append-playground-log',    record),
  readPlaygroundLog:      ()       => ipcRenderer.invoke('read-playground-log'),
  clearPlaygroundLog:     ()       => ipcRenderer.invoke('clear-playground-log'),

  // ── AI key management ─────────────────────────────────────────────────
  saveAiKey:          (p) => ipcRenderer.invoke('save-ai-key',          p),
  testAiKey:          (p) => ipcRenderer.invoke('test-ai-key',          p),
  removeAiKey:        (p) => ipcRenderer.invoke('remove-ai-key',        p),
  getAiStatus:        ()  => ipcRenderer.invoke('get-ai-status'),
  setDefaultProvider: (p) => ipcRenderer.invoke('set-default-provider', p),
  setAiModel:         (p) => ipcRenderer.invoke('set-ai-model',         p),
  getAiModels:        ()  => ipcRenderer.invoke('get-ai-models'),

  // ── AI visual generation ──────────────────────────────────────────────
  generateVisualConfig: (p) => ipcRenderer.invoke('generate-visual-config', p),
  generateAppSpec:      (p) => ipcRenderer.invoke('generate-app-spec',      p),
  getGeminiModels:      ()  => ipcRenderer.invoke('get-gemini-models'),

  // ── Cache management ──────────────────────────────────────────────────
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  // ── Session ───────────────────────────────────────────────────────────
  logoutAll: () => ipcRenderer.invoke('logout-all'),

  // ── Model context ─────────────────────────────────────────────────────
  getModelContext: () => ipcRenderer.invoke('get-model-context'),

  // ── Relationship validation ───────────────────────────────────────────
  validateFilter: (p) => ipcRenderer.invoke('validate-filter', p),

  // ── Dashboard Builder ─────────────────────────────────────────────────
  saveDashboard:   (p) => ipcRenderer.invoke('save-dashboard',   p),
  getDashboards:   (p) => ipcRenderer.invoke('get-dashboards',   p),
  deleteDashboard: (p) => ipcRenderer.invoke('delete-dashboard', p),
  saveAppSpec:     (p) => ipcRenderer.invoke('save-app-spec',    p),
  getAppSpecs:     (p) => ipcRenderer.invoke('get-app-specs',    p),
  deleteAppSpec:   (p) => ipcRenderer.invoke('delete-app-spec',  p),
  renameAppSpec:   (p) => ipcRenderer.invoke('rename-app-spec', p),

  // ── App Generator patch ───────────────────────────────────────────────
  patchAppSpec: (p) => ipcRenderer.invoke('patch-app-spec', p),

  // ── Export ────────────────────────────────────────────────────────────
  exportAppPackage: (p) => ipcRenderer.invoke('export-app-package', p),

  // ── Deploy to Fabric (Rayfin) — spike, ADDITIVE. IPC only exists when
  //    FEATURE_FABRIC_EXPORT is on; these invokes reject harmlessly otherwise. ──
  fabricPrereqCheck: ()  => ipcRenderer.invoke('fabric-prereq-check'),
  fabricConfigInfo:  ()  => ipcRenderer.invoke('fabric-config-info'),
  fabricDeploy:      (p) => ipcRenderer.invoke('fabric-deploy', p),
  fabricLogin:       ()  => ipcRenderer.invoke('fabric-login'),
  fabricLogout:      ()  => ipcRenderer.invoke('fabric-logout'),
  onFabricOutput:    (cb) => {
    const h = (_e, chunk) => cb(chunk)
    ipcRenderer.on('fabric-deploy-output', h)
    return () => ipcRenderer.removeListener('fabric-deploy-output', h)
  },

  // ── Power BI Mode (Fabric Items API) ──────────────────────────────────
  pbiGetAccessToken:          ()  => ipcRenderer.invoke('pbi-get-access-token'),
  pbiListReports:             (p) => ipcRenderer.invoke('pbi-list-reports',             p),
  pbiGetReportDefinitionV2:   (p) => ipcRenderer.invoke('pbi-get-report-definition-v2', p),
  pbiUpdateReportDefinition:  (p) => ipcRenderer.invoke('pbi-update-report-definition', p),
  pbiCreateReport:            (p) => ipcRenderer.invoke('pbi-create-report',            p),
  pbiCreateBlankReport:       (p) => ipcRenderer.invoke('pbi-create-blank-report',      p),
  pbiGetBundledPbiviz:        ()  => ipcRenderer.invoke('pbi-get-bundled-pbiviz'),
  pbiGetCustomVisualParts:    ()  => ipcRenderer.invoke('pbi-get-custom-visual-parts'),
  pbiExportVisualPackage:     (p) => ipcRenderer.invoke('pbi-export-visual-package',   p),

  // ── HTML Content (XMLA-measure) publish path — standalone from main pbi ──
  pbismGetDefinition:         (p) => ipcRenderer.invoke('pbism-get-definition',    p),
  pbismUpdateDefinition:      (p) => ipcRenderer.invoke('pbism-update-definition', p),

  // ── Auto-run web preview ──────────────────────────────────────────────
  runWebPreview:              (p) => ipcRenderer.invoke('run-web-preview',  p),
  stopWebPreview:             ()  => ipcRenderer.invoke('stop-web-preview'),

  // ── Power BI Mode draft persistence ───────────────────────────────────
  pbiSaveDraft:               (p) => ipcRenderer.invoke('pbi-save-draft',               p),
  pbiGetDrafts:               (p) => ipcRenderer.invoke('pbi-get-drafts',               p),
  pbiGetDraftForReport:       (p) => ipcRenderer.invoke('pbi-get-draft-for-report',     p),
  pbiDeleteDraft:             (p) => ipcRenderer.invoke('pbi-delete-draft',             p),

  // ── PBI Restyler — backup snapshots before applying restyle ───────────
  restyler: {
    backupWrite:    (p) => ipcRenderer.invoke('pbi-restyler-backup-write',   p),
    backupList:     (p) => ipcRenderer.invoke('pbi-restyler-backup-list',    p),
    backupRead:     (p) => ipcRenderer.invoke('pbi-restyler-backup-read',    p),
    backupDelete:   (p) => ipcRenderer.invoke('pbi-restyler-backup-delete',  p),
    listBackedUp:   ()  => ipcRenderer.invoke('pbi-restyler-list-backed-up'),
    // AI Director — produces a rule-based plan from parsed report + audit.
    // Reuses the cloud-LLM provider routing exposed by llm.js since 1b33a3f.
    aiPlan:         (p) => ipcRenderer.invoke('pbi-restyler-ai-plan', p),
    // Profiles — save Director plans for reuse on other reports
    profileSave:    (p) => ipcRenderer.invoke('pbi-restyler-profile-save',   p),
    profileList:    ()  => ipcRenderer.invoke('pbi-restyler-profile-list'),
    profileLoad:    (p) => ipcRenderer.invoke('pbi-restyler-profile-load',   p),
    profileDelete:  (p) => ipcRenderer.invoke('pbi-restyler-profile-delete', p),
  },
})
