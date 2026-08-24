const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_DIR = path.resolve(process.cwd(), 'cache');
const DB_FILE = path.join(DB_DIR, 'semantica.db');

let db = null;
let cacheHits = 0;
let cacheMisses = 0;

function getDb() {
  return db;
}

function persistDb() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function initCache() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }

  // Performance pragmas (cache_size + temp_store apply to sql.js in-memory SQLite;
  // journal_mode WAL is a no-op since sql.js manages persistence manually, but harmless)
  try { db.run("PRAGMA journal_mode=WAL") }    catch {}
  try { db.run("PRAGMA synchronous=NORMAL") }  catch {}
  try { db.run("PRAGMA cache_size=-64000") }   catch {}  // 64MB page cache
  try { db.run("PRAGMA temp_store=MEMORY") }   catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS query_cache (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT NOT NULL,
      measures     TEXT,
      filters      TEXT,
      table_name   TEXT,
      rows_written INTEGER,
      destination  TEXT,
      user_id      TEXT,
      source       TEXT,
      query_ms     INTEGER,
      timestamp    TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS measure_registry (
      dataset_id   TEXT NOT NULL,
      measure_name TEXT NOT NULL,
      table_name   TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (dataset_id, measure_name)
    )
  `);
  // Migration: add table_name column if it doesn't exist yet
  try { db.run(`ALTER TABLE measure_registry ADD COLUMN table_name TEXT NOT NULL DEFAULT ''`); } catch { /* already exists */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS dimension_registry (
      dataset_id   TEXT NOT NULL,
      table_name   TEXT NOT NULL,
      column_name  TEXT NOT NULL,
      data_type    TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (dataset_id, table_name, column_name)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS saved_visuals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      config_json TEXT NOT NULL,
      dataset_id  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    )
  `);

  // Playground Spike — declarative custom-visual templates (.vilsem-visual).
  // Keyed by (dataset_id, template_id) so a re-save upserts. Additive table.
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_templates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id   TEXT NOT NULL,
      name          TEXT NOT NULL,
      icon          TEXT,
      template_json TEXT NOT NULL,
      dataset_id    TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      UNIQUE(dataset_id, template_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS model_metadata_cache (
      model_id           TEXT PRIMARY KEY,
      workspace_id       TEXT NOT NULL,
      dataset_id         TEXT NOT NULL,
      tmsl_json          TEXT NOT NULL,
      measures_json      TEXT NOT NULL,
      relationships_json TEXT NOT NULL,
      last_refreshed     INTEGER NOT NULL,
      expires_at         INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS filter_distinct_cache (
      column_fqn           TEXT NOT NULL,
      dataset_id           TEXT NOT NULL,
      distinct_values_json TEXT NOT NULL,
      last_fetched         INTEGER NOT NULL,
      expires_at           INTEGER NOT NULL,
      PRIMARY KEY (column_fqn, dataset_id)
    )
  `);

  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_filter_cache_dataset ON filter_distinct_cache(dataset_id)`);
  } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      dataset_id  TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      visuals_json TEXT NOT NULL,
      theme_json  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS saved_app_specs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      dataset_id  TEXT NOT NULL,
      spec_json   TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pbi_report_drafts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id       TEXT,
      workspace_id    TEXT NOT NULL,
      report_name     TEXT NOT NULL,
      pages_json      TEXT NOT NULL,
      injection_scope TEXT,
      renderer        TEXT,
      saved_at        TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  // PBI Restyler — Director plans saved as named profiles for reuse
  // across multiple reports. Each profile stores the full plan JSON
  // (Director output: narrative, archetype, globalDefaults, rules[]) +
  // brand kit metadata. User picks a profile in DirectorChat to apply
  // a previously-good design without re-running the LLM.
  db.run(`
    CREATE TABLE IF NOT EXISTS restyler_profiles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      description   TEXT,
      plan_json     TEXT NOT NULL,
      brand_kit_json TEXT,
      source_report_name TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // Delete expired cache entries on startup
  db.run(`DELETE FROM query_cache WHERE expires_at < datetime('now')`);

  persistDb();
}

/**
 * Build a deterministic SHA-256 cache key.
 */
function buildCacheKey(datasetId, measures, filters) {
  const sortedMeasures = [...measures].sort();
  const sortedFilters = {};
  for (const k of Object.keys(filters).sort()) {
    sortedFilters[k] = filters[k];
  }
  const raw = JSON.stringify({ datasetId, measures: sortedMeasures, filters: sortedFilters });
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Get a cache entry. Returns { value, cachedAt, expiresAt } or null if missing/expired.
 */
function cacheGet(key) {
  if (!db) return null;

  const stmt = db.prepare(
    `SELECT value, cached_at, expires_at FROM query_cache
     WHERE key = ? AND expires_at >= datetime('now')`
  );
  stmt.bind([key]);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();

  if (!row) {
    cacheMisses++;
    return null;
  }

  cacheHits++;
  return {
    value: JSON.parse(row.value),
    cachedAt: row.cached_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Store a cache entry. Returns { cachedAt, expiresAt }.
 */
function cacheSet(key, value, ttlSeconds) {
  if (!db) throw new Error('Cache not initialized');

  const cachedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  db.run(
    `INSERT OR REPLACE INTO query_cache (key, value, cached_at, expires_at) VALUES (?, ?, ?, ?)`,
    [key, JSON.stringify(value), cachedAt, expiresAt]
  );

  persistDb();

  return { cachedAt, expiresAt };
}

/**
 * Count non-expired cache entries (used by /health).
 */
function getCacheEntryCount() {
  if (!db) return 0;

  const result = db.exec(`SELECT COUNT(*) FROM query_cache WHERE expires_at >= datetime('now')`);
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return 0;
}

/**
 * Delete all cache entries (called after writeback to invalidate stale data).
 */
function flushCache() {
  if (!db) return;
  db.run(`DELETE FROM query_cache`);
  cacheHits = 0;
  cacheMisses = 0;
  persistDb();
}

/**
 * Wipe all stored data: query cache, audit log, measure registry,
 * dimension registry, and saved visuals.
 */
function resetAllData() {
  if (!db) return;
  db.run(`DELETE FROM query_cache`);
  db.run(`DELETE FROM audit_log`);
  db.run(`DELETE FROM measure_registry`);
  db.run(`DELETE FROM dimension_registry`);
  db.run(`DELETE FROM saved_visuals`);
  db.run(`DELETE FROM model_metadata_cache`);
  db.run(`DELETE FROM filter_distinct_cache`);
  cacheHits = 0;
  cacheMisses = 0;
  persistDb();
}

/**
 * Cache hit rate stats for /health.
 */
function getCacheStats() {
  const total = cacheHits + cacheMisses;
  const hitRate = total === 0 ? '0%' : `${Math.round((cacheHits / total) * 100)}%`;
  return { hits: cacheHits, misses: cacheMisses, hitRate };
}

// ── Measure registry ──────────────────────────────────────────────────────────

/**
 * Upsert a measure into the registry (INSERT OR REPLACE so table_name is always current).
 */
function saveRegistryMeasure(datasetId, measureName, tableName = '') {
  if (!db || !datasetId || !measureName) return;
  db.run(
    `INSERT OR REPLACE INTO measure_registry (dataset_id, measure_name, table_name) VALUES (?, ?, ?)`,
    [datasetId, measureName, tableName || '']
  );
}

/**
 * Bulk-save an array of { name, table } measures for a dataset.
 * Clears existing entries first so stale measures don't persist.
 * Skips persistDb() per-row — call once after bulk save.
 */
function bulkSaveRegistryMeasures(datasetId, measures) {
  if (!db || !datasetId || !measures.length) return;
  db.run(`DELETE FROM measure_registry WHERE dataset_id = ?`, [datasetId]);
  for (const m of measures) {
    db.run(
      `INSERT INTO measure_registry (dataset_id, measure_name, table_name) VALUES (?, ?, ?)`,
      [datasetId, m.name, m.table || '']
    );
  }
  persistDb();
}

/**
 * Returns [{name, table}] for a dataset, ordered by table then name.
 */
function getRegistryMeasures(datasetId) {
  if (!db || !datasetId) return [];
  const result = db.exec(
    `SELECT measure_name, table_name FROM measure_registry
     WHERE dataset_id = ?
     ORDER BY table_name, measure_name`,
    [datasetId]
  );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([name, table]) => ({ name, table: table || '' }));
}

function removeRegistryMeasure(datasetId, measureName) {
  if (!db || !datasetId || !measureName) return;
  db.run(
    `DELETE FROM measure_registry WHERE dataset_id = ? AND measure_name = ?`,
    [datasetId, measureName]
  );
  persistDb();
}

function clearRegistryMeasures(datasetId) {
  if (!db || !datasetId) return;
  db.run(`DELETE FROM measure_registry WHERE dataset_id = ?`, [datasetId]);
  persistDb();
}

// ── Dimension registry ────────────────────────────────────────────────────────

/**
 * Save all columns for a table (replaces existing entries for that table).
 * columns: string[] of column names, or [{name, dataType}] objects.
 */
function saveDimensionTable(datasetId, tableName, columns) {
  if (!db || !datasetId || !tableName) return;
  db.run(`DELETE FROM dimension_registry WHERE dataset_id = ? AND table_name = ?`, [datasetId, tableName]);
  for (const col of columns) {
    const name     = typeof col === 'string' ? col : col.name;
    const dataType = typeof col === 'string' ? '' : (col.dataType || '');
    if (name) db.run(
      `INSERT OR IGNORE INTO dimension_registry (dataset_id, table_name, column_name, data_type) VALUES (?, ?, ?, ?)`,
      [datasetId, tableName, name, dataType]
    );
  }
}

/**
 * Bulk-save all tables for a dataset. Clears existing first.
 * tables: [{name, columns: string[]|{name,dataType}[]}]
 */
function bulkSaveDimensionTables(datasetId, tables) {
  if (!db || !datasetId || !tables.length) return;
  db.run(`DELETE FROM dimension_registry WHERE dataset_id = ?`, [datasetId]);
  for (const t of tables) {
    saveDimensionTable(datasetId, t.name, t.columns || []);
  }
  persistDb();
}

/**
 * Returns [{name, columns: [{name, dataType}]}] for a dataset.
 */
function getDimensionTables(datasetId) {
  if (!db || !datasetId) return [];
  const result = db.exec(
    `SELECT table_name, column_name, data_type
     FROM dimension_registry WHERE dataset_id = ?
     ORDER BY table_name, column_name`,
    [datasetId]
  );
  if (!result.length || !result[0].values.length) return [];
  const tableMap = new Map();
  for (const [tName, cName, dtype] of result[0].values) {
    if (!tableMap.has(tName)) tableMap.set(tName, { name: tName, columns: [] });
    tableMap.get(tName).columns.push({ name: cName, dataType: dtype || '' });
  }
  return [...tableMap.values()];
}

function clearDimensionTables(datasetId) {
  if (!db || !datasetId) return;
  db.run(`DELETE FROM dimension_registry WHERE dataset_id = ?`, [datasetId]);
  persistDb();
}

// ── Saved visuals ─────────────────────────────────────────────────────────────

function saveVisual(datasetId, name, type, config) {
  if (!db || !datasetId) return null;
  const created_at = new Date().toISOString();
  db.run(
    `INSERT INTO saved_visuals (name, type, config_json, dataset_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    [name, type, JSON.stringify(config), datasetId, created_at]
  );
  const result = db.exec(`SELECT last_insert_rowid() as id`);
  const id = result?.[0]?.values?.[0]?.[0] ?? null;
  persistDb();
  return { id, name, type, config, datasetId, created_at };
}

function getSavedVisuals(datasetId) {
  if (!db || !datasetId) return [];
  const result = db.exec(
    `SELECT id, name, type, config_json, created_at FROM saved_visuals
     WHERE dataset_id = ? ORDER BY created_at DESC`,
    [datasetId]
  );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([id, name, type, config_json, created_at]) => ({
    id, name, type, config: JSON.parse(config_json), created_at,
  }));
}

// ── Playground Spike: custom-visual templates (additive) ──────────────────
function saveCustomTemplate(datasetId, template) {
  if (!db || !datasetId || !template?.meta?.id) return null;
  const created_at = new Date().toISOString();
  const templateId = String(template.meta.id);
  // Re-saving an edited template replaces the old one. Delete-then-insert keeps
  // this portable across the WASM SQLite build (no ON CONFLICT dependency).
  db.run(`DELETE FROM custom_templates WHERE dataset_id = ? AND template_id = ?`, [datasetId, templateId]);
  db.run(
    `INSERT INTO custom_templates (template_id, name, icon, template_json, dataset_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [templateId, template.meta.name || templateId, template.meta.icon || '', JSON.stringify(template), datasetId, created_at]
  );
  persistDb();
  return { templateId, name: template.meta.name, created_at };
}

function getCustomTemplates(datasetId) {
  if (!db || !datasetId) return [];
  const result = db.exec(
    `SELECT template_id, name, icon, template_json, created_at FROM custom_templates
     WHERE dataset_id = ? ORDER BY created_at DESC`,
    [datasetId]
  );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([template_id, name, icon, template_json, created_at]) => ({
    templateId: template_id, name, icon, template: JSON.parse(template_json), created_at,
  }));
}

function deleteCustomTemplate(datasetId, templateId) {
  if (!db || !datasetId || !templateId) return;
  db.run(`DELETE FROM custom_templates WHERE dataset_id = ? AND template_id = ?`, [datasetId, templateId]);
  persistDb();
}

function deleteSavedVisual(id) {
  if (!db) return;
  db.run(`DELETE FROM saved_visuals WHERE id = ?`, [id]);
  persistDb();
}

// ── Model metadata cache ──────────────────────────────────────────────────────

function cacheModelMetadata(datasetId, workspaceId, tmsl, measures, relationships) {
  if (!db) return;
  const now     = Date.now();
  const expires = now + 24 * 60 * 60 * 1000; // 24 hours
  db.run(
    `INSERT OR REPLACE INTO model_metadata_cache
     (model_id, workspace_id, dataset_id, tmsl_json, measures_json, relationships_json, last_refreshed, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [datasetId, workspaceId, datasetId,
     JSON.stringify(tmsl || {}),
     JSON.stringify(measures || []),
     JSON.stringify(relationships || []),
     now, expires]
  );
}

function getCachedModelMetadata(datasetId) {
  if (!db) return null;
  const result = db.exec(
    `SELECT tmsl_json, measures_json, relationships_json FROM model_metadata_cache
     WHERE dataset_id = ? AND expires_at > ?`,
    [datasetId, Date.now()]
  );
  if (!result.length || !result[0].values.length) return null;
  const [tmsl_json, measures_json, relationships_json] = result[0].values[0];
  return {
    tmsl:          JSON.parse(tmsl_json),
    measures:      JSON.parse(measures_json),
    relationships: JSON.parse(relationships_json),
  };
}

// ── Filter distinct value cache ───────────────────────────────────────────────

function cacheDistinctValues(columnFqn, datasetId, values) {
  if (!db) return;
  const now     = Date.now();
  const expires = now + 4 * 60 * 60 * 1000; // 4 hours
  db.run(
    `INSERT OR REPLACE INTO filter_distinct_cache
     (column_fqn, dataset_id, distinct_values_json, last_fetched, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [columnFqn, datasetId, JSON.stringify(values), now, expires]
  );
}

function getCachedDistinctValues(columnFqn, datasetId) {
  if (!db) return null;
  const result = db.exec(
    `SELECT distinct_values_json FROM filter_distinct_cache
     WHERE column_fqn = ? AND dataset_id = ? AND expires_at > ?`,
    [columnFqn, datasetId, Date.now()]
  );
  if (!result.length || !result[0].values.length) return null;
  return JSON.parse(result[0].values[0][0]);
}

// ── Dashboards ────────────────────────────────────────────────────────────────

function saveDashboard(name, datasetId, layout, visuals, theme) {
  if (!db) return null;
  const stmt = db.prepare('SELECT id FROM dashboards WHERE name = ? AND dataset_id = ?');
  stmt.bind([name, datasetId]);
  let existingId = null;
  if (stmt.step()) existingId = stmt.getAsObject().id;
  stmt.free();

  if (existingId) {
    db.run(
      `UPDATE dashboards SET layout_json = ?, visuals_json = ?, theme_json = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(layout), JSON.stringify(visuals), JSON.stringify(theme), existingId]
    );
    persistDb();
    return existingId;
  }

  db.run(
    `INSERT INTO dashboards (name, dataset_id, layout_json, visuals_json, theme_json) VALUES (?, ?, ?, ?, ?)`,
    [name, datasetId, JSON.stringify(layout), JSON.stringify(visuals), JSON.stringify(theme)]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result?.[0]?.values?.[0]?.[0] ?? null;
  persistDb();
  return id;
}

function saveAppSpec(name, datasetId, spec) {
  if (!db) return null;
  const stmt = db.prepare('SELECT id FROM saved_app_specs WHERE name = ? AND dataset_id = ?');
  stmt.bind([name, datasetId]);
  let existingId = null;
  if (stmt.step()) existingId = stmt.getAsObject().id;
  stmt.free();

  if (existingId) {
    db.run(
      `UPDATE saved_app_specs SET spec_json = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(spec), existingId]
    );
    persistDb();
    return existingId;
  }

  db.run(
    `INSERT INTO saved_app_specs (name, dataset_id, spec_json) VALUES (?, ?, ?)`,
    [name, datasetId, JSON.stringify(spec)]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result?.[0]?.values?.[0]?.[0] ?? null;
  persistDb();
  return id;
}

function renameAppSpec(id, newName) {
  if (!db) return;
  db.run(`UPDATE saved_app_specs SET name = ?, updated_at = datetime('now') WHERE id = ?`, [newName, id]);
  persistDb();
}

function getAppSpecs(datasetId) {
  if (!db) return [];
  // If no datasetId, return ALL projects (Home screen shows everything)
  const result = datasetId
    ? db.exec(
        `SELECT id, name, dataset_id, spec_json, created_at, updated_at
         FROM saved_app_specs WHERE dataset_id = ? ORDER BY updated_at DESC`,
        [datasetId]
      )
    : db.exec(
        `SELECT id, name, dataset_id, spec_json, created_at, updated_at
         FROM saved_app_specs ORDER BY updated_at DESC`
      );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([id, name, dataset_id, spec_json, created_at, updated_at]) => ({
    id,
    name,
    datasetId: dataset_id,
    spec: JSON.parse(spec_json),
    createdAt: created_at,
    updatedAt: updated_at,
  }));
}

function deleteAppSpec(id) {
  if (!db) return;
  db.run('DELETE FROM saved_app_specs WHERE id = ?', [id]);
  persistDb();
}

// ─── Power BI Mode draft persistence ────────────────────────────────────────

/**
 * Save (or update) a Power BI report draft. A draft is the editor state for
 * a report-in-progress — pages, visuals, injection scope, renderer.
 *
 * Identity rule: drafts are unique per (workspace_id, report_id) when an
 * existing report is being edited. For brand-new reports (report_id === null)
 * uniqueness falls back to (workspace_id, report_name).
 *
 * @returns {number|null} draft row id
 */
function savePbiReportDraft({ reportId, workspaceId, reportName, pages, injectionScope, renderer }) {
  if (!db) return null;
  if (!workspaceId || !reportName) return null;

  const pagesJson = JSON.stringify(pages || []);
  const scope     = injectionScope || 'fullpage';
  const rend      = renderer || 'htmlcontent';

  // Look up existing draft
  let existingId = null;
  if (reportId) {
    const stmt = db.prepare('SELECT id FROM pbi_report_drafts WHERE workspace_id = ? AND report_id = ?');
    stmt.bind([workspaceId, reportId]);
    if (stmt.step()) existingId = stmt.getAsObject().id;
    stmt.free();
  } else {
    const stmt = db.prepare('SELECT id FROM pbi_report_drafts WHERE workspace_id = ? AND report_id IS NULL AND report_name = ?');
    stmt.bind([workspaceId, reportName]);
    if (stmt.step()) existingId = stmt.getAsObject().id;
    stmt.free();
  }

  if (existingId) {
    db.run(
      `UPDATE pbi_report_drafts
       SET report_name = ?, pages_json = ?, injection_scope = ?, renderer = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [reportName, pagesJson, scope, rend, existingId]
    );
    persistDb();
    return existingId;
  }

  db.run(
    `INSERT INTO pbi_report_drafts (report_id, workspace_id, report_name, pages_json, injection_scope, renderer)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reportId || null, workspaceId, reportName, pagesJson, scope, rend]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result?.[0]?.values?.[0]?.[0] ?? null;
  persistDb();
  return id;
}

function getPbiReportDrafts(workspaceId) {
  if (!db || !workspaceId) return [];
  const result = db.exec(
    `SELECT id, report_id, workspace_id, report_name, pages_json, injection_scope, renderer, saved_at, updated_at
     FROM pbi_report_drafts WHERE workspace_id = ? ORDER BY updated_at DESC`,
    [workspaceId]
  );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([id, report_id, workspace_id, report_name, pages_json, injection_scope, renderer, saved_at, updated_at]) => {
    let pages = [];
    try { pages = JSON.parse(pages_json) || []; } catch { /* ignore */ }
    return {
      id,
      reportId:       report_id,
      workspaceId:    workspace_id,
      reportName:     report_name,
      pages,
      injectionScope: injection_scope || 'fullpage',
      renderer:       renderer || 'htmlcontent',
      savedAt:        saved_at,
      updatedAt:      updated_at,
      pageCount:      pages.length,
      visualCount:    pages.reduce((n, p) => n + ((p && p.visuals && p.visuals.length) || 0), 0),
    };
  });
}

/**
 * Look up a single draft by (workspaceId, reportId). Returns null if none.
 * Used by the editor to detect "unsaved work for this report" on load.
 */
function getPbiReportDraftFor(workspaceId, reportId) {
  if (!db || !workspaceId || !reportId) return null;
  const all = getPbiReportDrafts(workspaceId);
  return all.find((d) => d.reportId === reportId) || null;
}

function deletePbiReportDraft(id) {
  if (!db) return;
  db.run('DELETE FROM pbi_report_drafts WHERE id = ?', [id]);
  persistDb();
}

function getDashboards(datasetId) {
  if (!db || !datasetId) return [];
  const result = db.exec(
    `SELECT id, name, dataset_id, layout_json, visuals_json, theme_json, created_at, updated_at
     FROM dashboards WHERE dataset_id = ? ORDER BY updated_at DESC`,
    [datasetId]
  );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([id, name, dataset_id, layout_json, visuals_json, theme_json, created_at, updated_at]) => ({
    id, name, datasetId: dataset_id,
    layout:  JSON.parse(layout_json),
    visuals: JSON.parse(visuals_json),
    theme:   JSON.parse(theme_json),
    createdAt: created_at, updatedAt: updated_at,
  }));
}

function deleteDashboard(id) {
  if (!db) return;
  db.run('DELETE FROM dashboards WHERE id = ?', [id]);
  persistDb();
}

// ─── PBI Restyler — Director plan profiles ──────────────────────────────────

/**
 * Save (or update by name) a Director plan as a named restyler profile.
 * Returns the row id. Names are unique — an existing profile with the same
 * name is overwritten.
 */
function saveRestylerProfile({ name, description, plan, brandKit, sourceReportName }) {
  if (!db || !name || !plan) return null;
  const planJson      = JSON.stringify(plan);
  const brandKitJson  = brandKit ? JSON.stringify(brandKit) : null;

  const stmt = db.prepare('SELECT id FROM restyler_profiles WHERE name = ?');
  stmt.bind([name]);
  let existingId = null;
  if (stmt.step()) existingId = stmt.get()[0];
  stmt.free();

  if (existingId) {
    db.run(
      `UPDATE restyler_profiles SET description = ?, plan_json = ?, brand_kit_json = ?, source_report_name = ?, updated_at = datetime('now') WHERE id = ?`,
      [description || null, planJson, brandKitJson, sourceReportName || null, existingId]
    );
    persistDb();
    return existingId;
  }

  db.run(
    `INSERT INTO restyler_profiles (name, description, plan_json, brand_kit_json, source_report_name) VALUES (?, ?, ?, ?, ?)`,
    [name, description || null, planJson, brandKitJson, sourceReportName || null]
  );
  const idResult = db.exec('SELECT last_insert_rowid()');
  const newId = idResult[0]?.values?.[0]?.[0];
  persistDb();
  return newId;
}

function getRestylerProfiles() {
  if (!db) return [];
  const result = db.exec(
    `SELECT id, name, description, plan_json, brand_kit_json, source_report_name, created_at, updated_at
     FROM restyler_profiles ORDER BY updated_at DESC`
  );
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(([id, name, description, plan_json, brand_kit_json, source_report_name, created_at, updated_at]) => ({
    id, name, description,
    plan:     JSON.parse(plan_json),
    brandKit: brand_kit_json ? JSON.parse(brand_kit_json) : null,
    sourceReportName: source_report_name,
    createdAt: created_at,
    updatedAt: updated_at,
  }));
}

function getRestylerProfile(id) {
  if (!db) return null;
  const result = db.exec(
    `SELECT id, name, description, plan_json, brand_kit_json, source_report_name, created_at, updated_at
     FROM restyler_profiles WHERE id = ?`,
    [id]
  );
  if (!result.length || !result[0].values.length) return null;
  const [rid, name, description, plan_json, brand_kit_json, source_report_name, created_at, updated_at] = result[0].values[0];
  return {
    id: rid, name, description,
    plan:     JSON.parse(plan_json),
    brandKit: brand_kit_json ? JSON.parse(brand_kit_json) : null,
    sourceReportName: source_report_name,
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

function deleteRestylerProfile(id) {
  if (!db) return;
  db.run('DELETE FROM restyler_profiles WHERE id = ?', [id]);
  persistDb();
}

module.exports = {
  initCache, getDb, buildCacheKey, cacheGet, cacheSet, getCacheEntryCount, flushCache, resetAllData, getCacheStats,
  saveRegistryMeasure, bulkSaveRegistryMeasures, getRegistryMeasures, removeRegistryMeasure, clearRegistryMeasures,
  saveDimensionTable, bulkSaveDimensionTables, getDimensionTables, clearDimensionTables,
  saveVisual, getSavedVisuals, deleteSavedVisual,
  saveCustomTemplate, getCustomTemplates, deleteCustomTemplate,
  cacheModelMetadata, getCachedModelMetadata, cacheDistinctValues, getCachedDistinctValues,
  saveDashboard, getDashboards, deleteDashboard,
  saveAppSpec, getAppSpecs, deleteAppSpec, renameAppSpec,
  savePbiReportDraft, getPbiReportDrafts, getPbiReportDraftFor, deletePbiReportDraft,
  saveRestylerProfile, getRestylerProfiles, getRestylerProfile, deleteRestylerProfile,
};
