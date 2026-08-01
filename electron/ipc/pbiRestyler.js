/**
 * PBI Restyler — backup endpoints.
 *
 * Read (`pbi-get-report-definition-v2`) and write (`pbi-update-report-definition`)
 * are already exposed by `electron/ipc/powerbi.js`. The Restyler reuses them
 * directly — no need to duplicate that logic here.
 *
 * What this module ADDS:
 *   - pbi-restyler-backup-write   — snapshot the current report definition
 *                                   to userData/restyler-backups/<reportId>/<timestamp>.json
 *                                   before any updateDefinition call.
 *   - pbi-restyler-backup-list    — list snapshots for a report (for rollback UI)
 *   - pbi-restyler-backup-read    — read a specific snapshot's parts so the
 *                                   Restyler can rollback via the existing
 *                                   updateDefinition endpoint.
 *   - pbi-restyler-backup-delete  — drop an old snapshot.
 *
 * Snapshot file format:
 *   {
 *     version:    1,
 *     timestamp:  '2026-05-05T...',
 *     reportId:   'GUID',
 *     reportName: 'Sales Dashboard',
 *     workspaceId: 'GUID',
 *     parts:      [{ path, content }],     // exactly the shape getReportDefinitionV2 returns
 *     auditScore: 47,                       // optional — captured at snapshot time
 *     planLabel:  'Elevated Cards',         // optional — what was applied
 *   }
 *
 * Snapshots live OUTSIDE the project tree at app.getPath('userData')/restyler-backups/
 * so they survive uninstall/reinstall of dev builds and can't be accidentally
 * checked into git.
 */

const { ipcMain, app } = require('electron/main')
const path = require('path')
const fs = require('fs')
const {
  saveRestylerProfile, getRestylerProfiles, getRestylerProfile, deleteRestylerProfile,
} = require('../../src/cache/sqlite')

function getBackupRoot() {
  try {
    const root = path.join(app.getPath('userData'), 'restyler-backups')
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
    return root
  } catch (err) {
    console.error('[pbiRestyler] getBackupRoot failed:', err.message)
    return null
  }
}

function safeReportDir(reportId) {
  // Guard: only [a-zA-Z0-9-_] allowed in the dir name
  const safe = String(reportId || '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safe) throw new Error('reportId is required')
  const root = getBackupRoot()
  if (!root) throw new Error('Backup root unavailable')
  const dir = path.join(root, safe)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Write snapshot ───────────────────────────────────────────────────────────

async function backupWrite({ reportId, reportName, workspaceId, parts, auditScore, planLabel, planSnapshot }) {
  if (!reportId)            throw new Error('reportId is required')
  if (!Array.isArray(parts)) throw new Error('parts array is required')

  const dir = safeReportDir(reportId)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(dir, `${timestamp}.json`)

  const snapshot = {
    version:      1,
    timestamp:    new Date().toISOString(),
    reportId,
    reportName:   reportName || null,
    workspaceId:  workspaceId || null,
    parts,                            // [{ path, content }]
    auditScore:   typeof auditScore === 'number' ? auditScore : null,
    planLabel:    planLabel  || null,
    planSnapshot: planSnapshot || null,
  }

  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf-8')
  console.log(`[pbiRestyler] backup written: ${file} (${parts.length} parts)`)
  return { success: true, file, timestamp: snapshot.timestamp }
}

// ── List snapshots ───────────────────────────────────────────────────────────

async function backupList({ reportId }) {
  if (!reportId) throw new Error('reportId is required')
  const dir = safeReportDir(reportId)
  if (!fs.existsSync(dir)) return { success: true, snapshots: [] }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
  const snapshots = []
  for (const f of files) {
    try {
      const full = path.join(dir, f)
      const stat = fs.statSync(full)
      // Lightweight read — only metadata, not the full parts blob
      const head = fs.readFileSync(full, 'utf-8')
      const obj  = JSON.parse(head)
      snapshots.push({
        file:        f,
        path:        full,
        timestamp:   obj.timestamp,
        reportName:  obj.reportName,
        auditScore:  obj.auditScore,
        planLabel:   obj.planLabel,
        sizeBytes:   stat.size,
        partsCount:  Array.isArray(obj.parts) ? obj.parts.length : 0,
      })
    } catch (err) {
      console.warn('[pbiRestyler] failed to read snapshot', f, err.message)
    }
  }
  // Newest first
  snapshots.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  return { success: true, snapshots }
}

// ── Read full snapshot ───────────────────────────────────────────────────────

async function backupRead({ reportId, file }) {
  if (!reportId || !file) throw new Error('reportId and file are required')
  const dir  = safeReportDir(reportId)
  // Re-resolve to prevent path traversal
  const safeFile = String(file).replace(/[^a-zA-Z0-9_.-]/g, '')
  const full = path.join(dir, safeFile)
  if (!fs.existsSync(full)) {
    return { success: false, message: 'Snapshot not found' }
  }
  try {
    const obj = JSON.parse(fs.readFileSync(full, 'utf-8'))
    return { success: true, snapshot: obj }
  } catch (err) {
    return { success: false, message: 'Failed to parse snapshot: ' + err.message }
  }
}

// ── Delete snapshot ──────────────────────────────────────────────────────────

async function backupDelete({ reportId, file }) {
  if (!reportId || !file) throw new Error('reportId and file are required')
  const dir  = safeReportDir(reportId)
  const safeFile = String(file).replace(/[^a-zA-Z0-9_.-]/g, '')
  const full = path.join(dir, safeFile)
  if (!fs.existsSync(full)) return { success: true, alreadyGone: true }
  try {
    fs.unlinkSync(full)
    return { success: true }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

// ── List recent reports the user has backed up (for restyler home) ───────────

async function listBackedUpReports() {
  const root = getBackupRoot()
  if (!root || !fs.existsSync(root)) return { success: true, reports: [] }
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory())
  const reports = []
  for (const d of dirs) {
    try {
      const subDir = path.join(root, d.name)
      const files = fs.readdirSync(subDir).filter(f => f.endsWith('.json'))
      if (!files.length) continue
      // Read newest snapshot for metadata
      files.sort().reverse()
      const newest = JSON.parse(fs.readFileSync(path.join(subDir, files[0]), 'utf-8'))
      reports.push({
        reportId:       d.name,
        reportName:     newest.reportName || d.name,
        workspaceId:    newest.workspaceId || null,
        snapshotCount:  files.length,
        lastBackup:     newest.timestamp,
      })
    } catch { /* skip broken dirs */ }
  }
  reports.sort((a, b) => (b.lastBackup || '').localeCompare(a.lastBackup || ''))
  return { success: true, reports }
}

// ── IPC registration ─────────────────────────────────────────────────────────

// ── Profile IPC handlers ─────────────────────────────────────────────────────

async function profileSave({ name, description, plan, brandKit, sourceReportName }) {
  if (!name || !plan) return { success: false, message: 'name and plan are required' }
  try {
    const id = saveRestylerProfile({ name, description, plan, brandKit, sourceReportName })
    return { success: true, id }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

async function profileList() {
  try {
    const profiles = getRestylerProfiles() || []
    // Strip the heavy plan JSON from list view — caller asks for full plan
    // via profileLoad when applying. Keeps list payload light.
    return { success: true, profiles: profiles.map(p => ({
      id:               p.id,
      name:             p.name,
      description:      p.description,
      sourceReportName: p.sourceReportName,
      createdAt:        p.createdAt,
      updatedAt:        p.updatedAt,
      ruleCount:        Array.isArray(p.plan?.rules) ? p.plan.rules.length : 0,
      archetype:        p.plan?.archetype || null,
      brandKit:         p.brandKit,
    })) }
  } catch (err) {
    return { success: false, message: err.message, profiles: [] }
  }
}

async function profileLoad({ id }) {
  if (!id) return { success: false, message: 'id is required' }
  try {
    const profile = getRestylerProfile(id)
    if (!profile) return { success: false, message: 'profile not found' }
    return { success: true, profile }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

async function profileDelete({ id }) {
  if (!id) return { success: false, message: 'id is required' }
  try {
    deleteRestylerProfile(id)
    return { success: true }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

function register() {
  ipcMain.handle('pbi-restyler-backup-write',   (_e, p) => backupWrite(p   || {}))
  ipcMain.handle('pbi-restyler-backup-list',    (_e, p) => backupList(p    || {}))
  ipcMain.handle('pbi-restyler-backup-read',    (_e, p) => backupRead(p    || {}))
  ipcMain.handle('pbi-restyler-backup-delete',  (_e, p) => backupDelete(p  || {}))
  ipcMain.handle('pbi-restyler-list-backed-up', ()      => listBackedUpReports())
  ipcMain.handle('pbi-restyler-profile-save',   (_e, p) => profileSave(p   || {}))
  ipcMain.handle('pbi-restyler-profile-list',   ()      => profileList())
  ipcMain.handle('pbi-restyler-profile-load',   (_e, p) => profileLoad(p   || {}))
  ipcMain.handle('pbi-restyler-profile-delete', (_e, p) => profileDelete(p || {}))
  console.log('[pbiRestyler] IPC handlers registered (backup + profile)')
}

module.exports = {
  register,
  backupWrite,
  backupList,
  backupRead,
  backupDelete,
}
