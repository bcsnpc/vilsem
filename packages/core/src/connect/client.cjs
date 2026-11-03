const axios = require('axios');
const { getToken, forceRefresh } = require('./auth.cjs');
const { shouldFallback, recordUsed } = require('./xmla.cjs');

function getExecuteUrl() {
  const datasetId = process.env.FABRIC_DATASET_ID;
  return `https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/executeQueries`;
}

async function postQuery(url, body, token, extraHeaders = {}) {
  return axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

async function pollAsyncResult(locationUrl, token, maxWaitMs = 30_000) {
  const pollInterval = 2000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const res = await axios.get(locationUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 200) return res;
    // 202 means still running — keep polling
  }
  throw new Error('XMLA async fallback timed out after 30 seconds');
}

async function executeQuery(daxQuery) {
  const local = require('./localRuntime.cjs');
  if (local.current()) return { ...parseFabricResponse({ results: [{ tables: [{ rows: await local.query(daxQuery) }] }] }), queryPath: 'local' };
  const token = await getToken();
  const url = getExecuteUrl();
  const body = {
    queries: [{ query: daxQuery }],
    serializerSettings: { includeNulls: true },
  };

  // ── Primary attempt ──────────────────────────────────────────────────────
  let primaryErr = null;
  try {
    const res = await postQuery(url, body, token);
    return { ...parseFabricResponse(res.data), queryPath: 'direct' };
  } catch (err) {
    if (err.response?.status === 401) {
      await forceRefresh();
      const newToken = await getToken();
      try {
        const res = await postQuery(url, body, newToken);
        return { ...parseFabricResponse(res.data), queryPath: 'direct' };
      } catch (retryErr) {
        primaryErr = retryErr;
      }
    } else {
      primaryErr = err;
    }
  }

  if (primaryErr.response?.status === 429) {
    throw Object.assign(new Error('FABRIC_THROTTLE'), { code: 'FABRIC_THROTTLE', status: 429 });
  }

  // ── XMLA fallback ────────────────────────────────────────────────────────
  if (shouldFallback(primaryErr)) {
    console.error(`[client] Primary executeQueries failed (${primaryErr.response?.status}), trying XMLA async fallback...`);
    try {
      const currentToken = await getToken();
      const fallbackRes = await postQuery(url, body, currentToken, { Prefer: 'respond-async' });

      let finalRes = fallbackRes;
      if (fallbackRes.status === 202) {
        const location = fallbackRes.headers['location'] || fallbackRes.headers['Location'];
        if (location) {
          finalRes = await pollAsyncResult(location, currentToken);
        }
      }

      recordUsed();
      console.error('[client] XMLA async fallback succeeded');
      return { ...parseFabricResponse(finalRes.data), queryPath: 'xmla_fallback' };
    } catch (fallbackErr) {
      console.error(`[client] XMLA fallback also failed: ${fallbackErr.message}`);
      // Fall through to throw the original error with a note
      const pbiError = primaryErr.response?.data?.error;
      let msg = pbiError?.message || primaryErr.message;
      const details = pbiError?.['pbi.error']?.details || [];
      for (const d of details) {
        if (d.code === 'DetailsMessage' && d.detail?.value) { msg = d.detail.value; break; }
      }
      throw Object.assign(
        new Error(`FABRIC_ERROR: ${msg} (XMLA fallback attempted but also failed)`),
        { code: 'FABRIC_ERROR', status: primaryErr.response?.status || 500 }
      );
    }
  }

  // ── Normal error path ────────────────────────────────────────────────────
  const pbiError = primaryErr.response?.data?.error;
  let msg = pbiError?.message || primaryErr.message;
  const details = pbiError?.['pbi.error']?.details || [];
  for (const d of details) {
    if (d.code === 'DetailsMessage' && d.detail?.value) { msg = d.detail.value; break; }
  }
  const statusCode = primaryErr.response?.status || 500;
  throw Object.assign(new Error(`FABRIC_ERROR: ${msg}`), { code: 'FABRIC_ERROR', status: statusCode });
}

function parseFabricResponse(data) {
  const results = {};
  const table = data?.results?.[0]?.tables?.[0];
  if (!table || !table.rows || table.rows.length === 0) {
    return results;
  }

  const row = table.rows[0];
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.replace(/^\[/, '').replace(/\]$/, '');
    results[cleanKey] = typeof value === 'string' && !isNaN(value) && value.trim() !== ''
      ? Number(value)
      : value;
  }

  return results;
}

function parseFabricResponseMulti(data) {
  const table = data?.results?.[0]?.tables?.[0];
  if (!table || !table.rows) return [];
  return table.rows.map(row => {
    const obj = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = (key.startsWith('[') && key.endsWith(']'))
        ? key.slice(1, -1)
        : key;
      const isDimension = key.indexOf('[') > 0 && key.endsWith(']');
      obj[cleanKey] = !isDimension && typeof value === 'string' && !isNaN(value) && value.trim() !== ''
        ? Number(value)
        : value;
    }
    return obj;
  });
}

async function executeQueryMulti(daxQuery) {
  const local = require('./localRuntime.cjs');
  if (local.current()) return parseFabricResponseMulti({ results: [{ tables: [{ rows: await local.query(daxQuery) }] }] });
  const token = await getToken();
  const url = getExecuteUrl();
  const body = {
    queries: [{ query: daxQuery }],
    serializerSettings: { includeNulls: true },
  };

  let primaryErr = null;
  try {
    const res = await postQuery(url, body, token);
    return parseFabricResponseMulti(res.data);
  } catch (err) {
    if (err.response?.status === 401) {
      await forceRefresh();
      const newToken = await getToken();
      try {
        const res = await postQuery(url, body, newToken);
        return parseFabricResponseMulti(res.data);
      } catch (retryErr) {
        primaryErr = retryErr;
      }
    } else {
      primaryErr = err;
    }
  }

  if (primaryErr.response?.status === 429) {
    throw Object.assign(new Error('FABRIC_THROTTLE'), { code: 'FABRIC_THROTTLE', status: 429 });
  }

  const pbiError = primaryErr.response?.data?.error;
  let msg = pbiError?.message || primaryErr.message;
  const details = pbiError?.['pbi.error']?.details || [];
  for (const d of details) {
    if (d.code === 'DetailsMessage' && d.detail?.value) { msg = d.detail.value; break; }
  }
  throw Object.assign(new Error(`FABRIC_ERROR: ${msg}`), { code: 'FABRIC_ERROR', status: primaryErr.response?.status || 500 });
}

module.exports = { executeQuery, executeQueryMulti, parseFabricResponse, parseFabricResponseMulti };
