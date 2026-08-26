const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getToken } = require('../auth/auth');

const FABRIC_API = 'https://api.fabric.microsoft.com/v1';
const ONELAKE_API = 'https://onelake.dfs.fabric.microsoft.com';
const STAGING_DIR = path.resolve(process.env.SEMANTICA_DATA_DIR || process.cwd(), 'staging');

let lakehouseId = null;
let lakehouseName = null;
let lakehouseStatus = 'not_initialized';

/**
 * Discover the lakehouse ID by name on server startup.
 * Non-fatal — if discovery fails, writeback will return WRITEBACK_FAILED.
 */
async function initLakehouse() {
  const workspaceId = process.env.FABRIC_WORKSPACE_ID;
  const targetName = process.env.FABRIC_LAKEHOUSE_NAME || 'data_engineering';
  lakehouseName = targetName;

  // If ID is hardcoded in env, use it directly
  if (process.env.FABRIC_LAKEHOUSE_ID) {
    lakehouseId = process.env.FABRIC_LAKEHOUSE_ID;
    lakehouseStatus = 'connected';
    console.log(`✓ Lakehouse "${targetName}" loaded from env, ID: ${lakehouseId}`);
    return;
  }

  try {
    const token = await getToken();
    const url = `${FABRIC_API}/workspaces/${workspaceId}/lakehouses`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const items = res.data.value || [];
    const found = items.find(
      (item) => item.displayName?.toLowerCase() === targetName.toLowerCase()
    );

    if (found) {
      lakehouseId = found.id;
      lakehouseStatus = 'connected';
      console.log(`✓ Lakehouse "${targetName}" found, ID: ${lakehouseId}`);
    } else {
      lakehouseStatus = 'not_found';
      console.log(`WARNING: Lakehouse "${targetName}" not found in workspace. Writeback will use local staging.`);
      console.log(`  Available lakehouses: ${items.map((i) => i.displayName).join(', ') || '(none)'}`);
    }
  } catch (err) {
    lakehouseStatus = 'discovery_failed';
    console.log(`WARNING: Lakehouse discovery failed: ${err.message}. Writeback will use local staging.`);
  }
}

/**
 * Get a token scoped to Azure Storage for OneLake DFS writes (SP mode only).
 * Falls back to the standard Power BI token.
 */
async function getStorageToken() {
  const authMode = (process.env.AUTH_MODE || 'device_code').toLowerCase();
  if (authMode !== 'service_principal') {
    return await getToken();
  }

  const tenantId = process.env.FABRIC_TENANT_ID;
  const clientId = process.env.FABRIC_CLIENT_ID;
  const clientSecret = process.env.FABRIC_CLIENT_SECRET;

  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://storage.azure.com/.default',
    });
    const res = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data.access_token;
  } catch {
    // Fall back to PBI token
    return await getToken();
  }
}

/**
 * Write rows to OneLake using the DFS (ADLS Gen2) Files API.
 * Uploads a newline-delimited JSON file to the staging path.
 */
async function writeViaOneLake(tableName, rowsWithTimestamp) {
  const workspaceId = process.env.FABRIC_WORKSPACE_ID;
  if (!lakehouseId) throw new Error('Lakehouse ID not discovered');

  const token = await getStorageToken();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `semantica-staging/${tableName}-${timestamp}.json`;
  const url = `${ONELAKE_API}/${workspaceId}/${lakehouseId}/Files/${filePath}`;

  const body = rowsWithTimestamp.map((r) => JSON.stringify(r)).join('\n');

  await axios.put(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'x-ms-version': '2021-06-08',
      'x-ms-blob-type': 'BlockBlob',
    },
  });

  return { method: 'onelake', path: filePath };
}

/**
 * Write rows to a local staging directory as fallback.
 */
function writeToLocalStaging(tableName, rowsWithTimestamp) {
  if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${tableName}-${timestamp}.jsonl`;
  const filePath = path.join(STAGING_DIR, fileName);
  const body = rowsWithTimestamp.map((r) => JSON.stringify(r)).join('\n');
  fs.writeFileSync(filePath, body, 'utf8');
  return { method: 'local_staging', path: filePath };
}

/**
 * Write rows to the Lakehouse. Tries Fabric API → OneLake DFS → local staging.
 * Always succeeds (returns the write result with the method used).
 */
async function writeLakehouseRows(tableName, rows) {
  const rowsWithTimestamp = rows.map((r) => ({
    ...r,
    created_at: new Date().toISOString(),
  }));

  const workspaceId = process.env.FABRIC_WORKSPACE_ID;

  // Attempt 1: Fabric Lakehouse Tables API
  if (lakehouseId) {
    try {
      const token = await getToken();
      const url = `${FABRIC_API}/workspaces/${workspaceId}/lakehouses/${lakehouseId}/tables/${tableName}/rows`;
      await axios.post(url, { rows: rowsWithTimestamp }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return { method: 'fabric_tables_api', written: rowsWithTimestamp.length };
    } catch (err) {
      console.log(`[lakehouse] Fabric Tables API failed (${err.response?.status || err.message}), trying OneLake DFS...`);
    }

    // Attempt 2: OneLake DFS
    try {
      const result = await writeViaOneLake(tableName, rowsWithTimestamp);
      return { method: result.method, path: result.path, written: rowsWithTimestamp.length };
    } catch (err) {
      console.log(`[lakehouse] OneLake DFS failed (${err.response?.status || err.message}), falling back to local staging.`);
    }
  }

  // Attempt 3: Local staging
  const result = writeToLocalStaging(tableName, rowsWithTimestamp);
  console.log(`[lakehouse] Rows staged locally at: ${result.path}`);
  return { method: 'local_staging', path: result.path, written: rowsWithTimestamp.length };
}

function getLakehouseInfo() {
  return {
    name: lakehouseName,
    id: lakehouseId || 'not_discovered',
    status: lakehouseStatus,
  };
}

module.exports = { initLakehouse, writeLakehouseRows, getLakehouseInfo };
