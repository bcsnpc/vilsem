const { translateToDAX } = require('../fabric/translator');
const { executeQuery } = require('../fabric/client');
const { buildCacheKey, cacheGet, cacheSet } = require('../cache/sqlite');
const { validateMeasures } = require('../fabric/metadata');
const { rateLimitedCall } = require('../queue/limiter');
const { logQuery } = require('../audit/log');

async function batchRoute(fastify) {
  fastify.post('/query/batch', async (request, reply) => {
    const totalStart = Date.now();
    const { queries } = request.body || {};

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'queries is required and must be a non-empty array',
      });
    }

    for (const q of queries) {
      if (!q.id || !q.measures || !Array.isArray(q.measures) || q.measures.length === 0) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Each query must have an id (string) and measures (non-empty array)',
        });
      }

      const validation = validateMeasures(q.measures);
      if (!validation.valid) {
        return reply.code(400).send(validation.error);
      }
    }

    const datasetId = process.env.FABRIC_DATASET_ID;
    const results = {};
    let fabricCallsMade = 0;

    // Check cache for each query
    const cacheMisses = [];
    for (const q of queries) {
      const start = Date.now();
      const filters = q.filters || {};
      const cacheKey = buildCacheKey(datasetId, q.measures, filters);
      const cached = cacheGet(cacheKey);

      if (cached) {
        const queryMs = Date.now() - start;
        logQuery({ measures: q.measures, filters: q.filters || {}, source: 'cache', queryMs });
        results[q.id] = {
          data: cached.value,
          source: 'cache',
          queryMs,
        };
      } else {
        cacheMisses.push(q);
      }
    }

    // Group cache misses by identical filters
    const filterGroups = new Map();
    for (const q of cacheMisses) {
      const filterKey = JSON.stringify(
        Object.keys(q.filters || {}).sort().reduce((acc, k) => {
          acc[k] = (q.filters || {})[k];
          return acc;
        }, {})
      );

      if (!filterGroups.has(filterKey)) {
        filterGroups.set(filterKey, { filters: q.filters || {}, queries: [] });
      }
      filterGroups.get(filterKey).queries.push(q);
    }

    // Execute combined queries per filter group
    for (const [, group] of filterGroups) {
      const start = Date.now();
      const allMeasures = [];
      for (const q of group.queries) {
        allMeasures.push(...q.measures);
      }
      const uniqueMeasures = [...new Set(allMeasures)];

      try {
        const dax = translateToDAX(uniqueMeasures, group.filters);
        const data = await rateLimitedCall(() => executeQuery(dax));
        fabricCallsMade++;

        for (const q of group.queries) {
          const queryData = {};
          for (const m of q.measures) {
            queryData[m] = data[m] !== undefined ? data[m] : null;
          }

          const cacheTtl = q.ttl || parseInt(process.env.DEFAULT_TTL, 10) || 300;
          const cacheKey = buildCacheKey(datasetId, q.measures, q.filters || {});
          cacheSet(cacheKey, queryData, cacheTtl);
          const queryMs = Date.now() - start;
          logQuery({ measures: q.measures, filters: q.filters || {}, source: 'fabric', queryMs });

          results[q.id] = {
            data: queryData,
            source: 'fabric',
            queryMs,
          };
        }
      } catch (err) {
        for (const q of group.queries) {
          results[q.id] = {
            error: err.code || 'FABRIC_ERROR',
            message: err.message,
          };
        }
      }
    }

    return reply.send({
      results,
      fabricCallsMade,
      totalMs: Date.now() - totalStart,
    });
  });
}

module.exports = batchRoute;
