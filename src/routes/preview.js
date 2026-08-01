const { translateToDAX, buildFilterExpression, parseFilterKey, buildColumnReference } = require('../fabric/translator');
const { executeQueryMulti } = require('../fabric/client');
const { rateLimitedCall } = require('../queue/limiter');
const path = require('path');
const fs = require('fs');

// In-memory preview spec store (single-user local preview only)
let currentPreviewSpec = null;

// Build SUMMARIZECOLUMNS DAX — matches electron/ipc/query.js buildTableDAX exactly
function buildTableDAX(groupBy, measures, filters, limit, orderBy) {
  const order = String(orderBy || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const groupCols = groupBy.map(col => buildColumnReference(col));
  const filterParts = Object.entries(filters || {})
    .map(([key, val]) => buildFilterExpression(key, val))
    .filter(Boolean);
  const measureParts = measures.map(m => `"${m}", [${m}]`);
  const args = [...groupCols, ...filterParts, ...measureParts];
  const summary = `SUMMARIZECOLUMNS(\n  ${args.join(',\n  ')}\n)`;
  const sortMeasure = measures[0];
  const sortColumn = groupCols[0];
  const lim = limit || 100;
  return `EVALUATE\nTOPN(${lim}, ${summary}, [${sortMeasure}], ${order}, ${sortColumn}, ASC)\nORDER BY [${sortMeasure}] ${order}, ${sortColumn} ASC`;
}

async function previewRoute(fastify) {
  // Store preview spec
  fastify.post('/preview-spec', async (request, reply) => {
    currentPreviewSpec = request.body;
    return { ok: true };
  });

  // Get preview spec
  fastify.get('/preview-spec', async (request, reply) => {
    if (!currentPreviewSpec) return reply.code(404).send({ error: 'No preview spec set' });
    return currentPreviewSpec;
  });

  // Query endpoint for web runtime (mirrors IPC query-table)
  fastify.post('/query-table', async (request, reply) => {
    const { groupBy, measures, filters = {}, limit = 100, orderBy = 'desc' } = request.body || {};
    if (!groupBy || !Array.isArray(groupBy) || !groupBy.length) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'groupBy required' });
    }
    if (!measures || !Array.isArray(measures) || !measures.length) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'measures required' });
    }
    try {
      const dax = buildTableDAX(groupBy, measures, filters, limit, orderBy);
      const rows = await rateLimitedCall(() => executeQueryMulti(dax));
      return { rows, total: rows.length };
    } catch (err) {
      return reply.code(500).send({ error: err.code || 'FABRIC_ERROR', message: err.message });
    }
  });

  // Distinct values for slicer dropdowns (uses queryTable under the hood)
  fastify.post('/distinct-values', async (request, reply) => {
    const { column, limit = 100 } = request.body || {};
    if (!column) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'column required' });
    }
    try {
      const dax = `EVALUATE TOPN(${limit}, DISTINCT(${buildColumnReference(column)}), ${buildColumnReference(column)}, ASC)`;
      const rows = await rateLimitedCall(() => executeQueryMulti(dax));
      const colName = column.includes('[') ? column.split('[')[1]?.replace(']', '') : column;
      const values = rows.map(r => r[column] ?? r[colName] ?? Object.values(r)[0]).filter(v => v != null);
      return { values };
    } catch (err) {
      return reply.code(500).send({ error: err.code || 'FABRIC_ERROR', message: err.message });
    }
  });

  // Scalar query for KPI/gauge (mirrors IPC query)
  fastify.post('/query-scalar', async (request, reply) => {
    const { measures, filters = {} } = request.body || {};
    if (!measures || !Array.isArray(measures) || !measures.length) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'measures required' });
    }
    try {
      const dax = translateToDAX(measures, filters);
      const rows = await rateLimitedCall(() => executeQueryMulti(dax));
      const data = {};
      if (rows?.[0]) {
        for (const m of measures) {
          data[m] = rows[0][m] ?? rows[0][`[${m}]`] ?? null;
        }
      }
      return { data };
    } catch (err) {
      return reply.code(500).send({ error: err.code || 'FABRIC_ERROR', message: err.message });
    }
  });

  // Serve the preview HTML page
  fastify.get('/preview', { onRequest: [] }, async (request, reply) => {
    const htmlPath = path.join(__dirname, '..', '..', 'dist', 'app', 'preview.html');
    if (!fs.existsSync(htmlPath)) {
      return reply.code(404).send('Preview page not found. Run the build first.');
    }
    reply.type('text/html').send(fs.readFileSync(htmlPath, 'utf-8'));
  });
}

module.exports = previewRoute;
