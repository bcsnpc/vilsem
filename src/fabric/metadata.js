const axios = require('axios');
const { getToken } = require('../auth/auth');
const {
  getRegistryMeasures,
  bulkSaveRegistryMeasures,
  bulkSaveDimensionTables,
} = require('../cache/sqlite');

// ── In-memory stores ──────────────────────────────────────────────────────────
let measuresMap      = new Map();  // name → { name, table, expression, formatString, description }
let measuresSet      = new Set();
let relationshipsCache = [];       // [{ name, fromTable, fromColumn, toTable, toColumn, cardinality, crossFilter, isActive }]
let refreshedAt      = null;
let measuresDiscovered = false;
let discoveryMethod  = 'none';
let refreshInterval  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadFromArray(items) {
  measuresMap.clear(); measuresSet.clear();
  for (const m of items) {
    if (m.name && !m.name.startsWith('__')) {
      measuresMap.set(m.name, {
        name:         m.name,
        table:        m.table        || '',
        expression:   m.expression   || null,
        formatString: m.formatString || null,
        description:  m.description  || null,
      });
      measuresSet.add(m.name);
    }
  }
  measuresDiscovered = measuresSet.size > 0;
  refreshedAt = new Date().toISOString();
}

// ── TMDL parsing helpers ──────────────────────────────────────────────────────

const coreMetadata = require('@vilsem/core/connect/metadata');
let rawModelBimCache = null;
async function discoverViaTmsl(...args) { const result=await coreMetadata.discoverViaTmsl(...args); rawModelBimCache=result.rawModelBim; return result; }
async function discoverViaItemDefinition(...args) { const result=await coreMetadata.discoverViaItemDefinition(...args); relationshipsCache=result.relationships || []; rawModelBimCache=result.rawModelBim || null; return result; }
const {discoverViaScanner}=coreMetadata;

async function fetchMeasures() {
  if (require('../powerbi/localRuntime').current()) return;
  const datasetId   = process.env.FABRIC_DATASET_ID;
  const workspaceId = process.env.FABRIC_WORKSPACE_ID;

  measuresMap.clear(); measuresSet.clear();
  measuresDiscovered = false;
  discoveryMethod = 'none';
  refreshedAt = null;

  // Strategy 1 — Fabric Item Definition API (TMDL, pure HTTP, no .NET needed)
  if (datasetId && workspaceId) {
    try {
      const token = await getToken();
      const { measures, tables } = await discoverViaItemDefinition(workspaceId, datasetId, token);
      if (measures.length > 0) {
        bulkSaveRegistryMeasures(datasetId, measures);
        if (tables.length > 0) bulkSaveDimensionTables(datasetId, tables);
        loadFromArray(measures);
        discoveryMethod = 'item_definition';
        console.log(`[metadata] ✓ Item Definition discovery complete — ${measures.length} measures, ${tables.length} tables`);
        return true;
      }
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        console.log('[metadata] Item Definition API: token lacks SemanticModel.ReadWrite.All scope — re-login may be needed');
      } else if (err.code === 'FORBIDDEN') {
        console.log('[metadata] Item Definition API: permission denied (403)');
      } else if (err.code === 'NOT_FOUND') {
        console.log('[metadata] Item Definition API: dataset not found (404)');
      } else {
        console.log('[metadata] Item Definition API failed:', err.message?.split('\n')[0],
          err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : '');
      }
    }
  }

  // Strategy 2 — Scanner API (works when schema metadata is available)
  if (datasetId && workspaceId) {
    try {
      const token = await getToken();
      const { measures, tables } = await discoverViaScanner(workspaceId, datasetId, token);
      if (measures.length > 0) {
        bulkSaveRegistryMeasures(datasetId, measures);
        if (tables.length > 0) bulkSaveDimensionTables(datasetId, tables);
        loadFromArray(measures);
        discoveryMethod = 'scanner';
        console.log(`[metadata] ✓ Scanner discovery complete — ${measures.length} measures, ${tables.length} tables`);
        return true;
      }
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('[metadata] Scanner API blocked (403). Check Admin API settings in Power BI Admin Portal.');
      } else if (err.code === 'NOT_FOUND') {
        console.log('[metadata] Scanner API: workspace/dataset not found');
      } else if (err.code === 'TIMEOUT') {
        console.log('[metadata] Scanner API timed out after 30s');
      } else {
        console.log('[metadata] Scanner API error:', err.message);
      }
    }
  }

  // Strategy 3 — SQLite registry (query-driven or file import)
  if (datasetId) {
    const cached = getRegistryMeasures(datasetId);
    if (cached.length > 0) {
      loadFromArray(cached);
      discoveryMethod = 'registry';
      console.log(`[metadata] ✓ Loaded ${cached.length} measures from registry`);
    } else {
      console.log('[metadata] Registry empty — use Playground or Import to add measures');
    }
  }

  return true;
}

// ── Reload after import ───────────────────────────────────────────────────────

function reloadFromRegistry() {
  const datasetId = process.env.FABRIC_DATASET_ID;
  if (!datasetId) return;
  const cached = getRegistryMeasures(datasetId);
  loadFromArray(cached);
  discoveryMethod = cached.length > 0 ? 'registry' : 'none';
}

// ── Auto-refresh (no-op — kept for API compatibility) ─────────────────────────

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
}

function stopAutoRefresh() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateMeasures(requestedMeasures) {
  const local = require('../powerbi/localRuntime').current();
  if (local) { const invalid = requestedMeasures.filter(name => !local.measures.some(m => m.name === name)); return invalid.length ? { valid: false, error: { code: 'MEASURE_NOT_FOUND', message: 'Unknown local measure: ' + invalid[0] } } : { valid: true }; }
  if (!measuresDiscovered) return { valid: true };
  const invalid = requestedMeasures.filter(m => !measuresSet.has(m));
  if (invalid.length > 0) {
    const available = [...measuresSet].join(', ');
    return {
      valid: false,
      error: {
        code: 'MEASURE_NOT_FOUND',
        message: `Measure '${invalid[0]}' not found. Available: ${available}`,
        details: { requested: invalid[0] },
      },
    };
  }
  return { valid: true };
}

// ── Getters ───────────────────────────────────────────────────────────────────

function getMeasuresList()      { return [...measuresMap.values()].map(m => ({ name: m.name, table: m.table })); }
function getEnrichedMeasures() { return [...measuresMap.values()]; }
function getRelationships()    { return relationshipsCache; }
function getRawModelBim()      { return rawModelBimCache; }
function getMeasuresInfo()     { return { count: measuresSet.size, refreshedAt, discoveryMethod }; }
function getRefreshedAt()      { return refreshedAt; }
function getMeasures()         { return getMeasuresList(); }
function getTablesList()       { return []; }
function getMeasureTable(name) { const local = require('../powerbi/localRuntime').current(); return local ? local.measures.find(m => m.name === name)?.table || '' : measuresMap.get(name)?.table || ''; }

module.exports = {
  discoverViaItemDefinition,
  discoverViaTmsl,
  discoverViaScanner,
  fetchMeasures,
  reloadFromRegistry,
  startAutoRefresh,
  stopAutoRefresh,
  validateMeasures,
  getMeasuresList,
  getEnrichedMeasures,
  getRelationships,
  getRawModelBim,
  getMeasuresInfo,
  getRefreshedAt,
  getMeasures,
  getTablesList,
  getMeasureTable,
};
