/**
 * XMLA fallback config and condition detection.
 *
 * True XMLA (ADOMD.NET protocol) is not available in Node.js. Instead, when the
 * primary executeQueries call hits a capacity-related error, we retry with the
 * Prefer: respond-async header, which enables Power BI's async execution path.
 *
 * If the async retry also fails, the original error is returned with a note.
 */

// Display-only endpoint label for diagnostics. Set from the connected workspace
// (connection.js). No hardcoded dataset default — empty until a workspace connects.
const XMLA_ENDPOINT = process.env.XMLA_ENDPOINT || '';

let lastUsed = null;

/**
 * Returns true if the error from executeQueries should trigger an XMLA fallback retry.
 */
function shouldFallback(err) {
  const status = err.status || err.response?.status;
  if (status === 403) return true;
  if (status === 503) return true;
  if (status === 400 && err.message?.toLowerCase().includes('capacity')) return true;
  return false;
}

function recordUsed() {
  lastUsed = new Date().toISOString();
}

function getXmlaInfo() {
  return {
    endpoint: XMLA_ENDPOINT,
    fallbackAvailable: true,
    lastUsed,
  };
}

module.exports = { shouldFallback, recordUsed, getXmlaInfo, XMLA_ENDPOINT };
