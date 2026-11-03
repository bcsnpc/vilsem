const { translateToDAX } = require('../fabric/translator');
const { executeQuery } = require('../fabric/client');
const { buildCacheKey, cacheGet, cacheSet } = require('../cache/sqlite');
const { validateMeasures } = require('../fabric/metadata');
const { rateLimitedCall } = require('../queue/limiter');
const { logQuery } = require('../audit/log');

async function queryRoute(fastify) {
  fastify.post('/query', async (request, reply) => {
    const start = Date.now();
    const { measures, filters = {}, ttl } = request.body || {};

    if (!measures || !Array.isArray(measures) || measures.length === 0) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'measures is required and must be a non-empty array',
      });
    }

    for (const key of Object.keys(filters)) {
      if (!key.match(/^[^[]+\[[^\]]+\]$/)) {
        return reply.code(400).send({
          error: 'INVALID_FILTER',
          message: `Invalid filter key "${key}". Expected format: TableName[ColumnName]`,
          details: { key },
        });
      }
    }

    const validation = validateMeasures(measures);
    if (!validation.valid) {
      return reply.code(400).send(validation.error);
    }

    const datasetId = process.env.FABRIC_DATASET_ID;
    const cacheKey = buildCacheKey(datasetId, measures, filters);
    const cached = cacheGet(cacheKey);

    if (cached) {
      const queryMs = Date.now() - start;
      logQuery({ measures, filters, source: 'cache', queryMs });
      return reply.send({
        data: cached.value,
        source: 'cache',
        cachedAt: cached.cachedAt,
        cacheExpiresAt: cached.expiresAt,
        queryMs,
      });
    }

    try {
      const dax = translateToDAX(measures, filters);
      const data = await rateLimitedCall(() => executeQuery(dax));

      const cacheTtl = ttl || parseInt(process.env.DEFAULT_TTL, 10) || 300;
      const { cachedAt, expiresAt } = cacheSet(cacheKey, data, cacheTtl);
      const queryMs = Date.now() - start;
      logQuery({ measures, filters, source: 'fabric', queryMs });

      return reply.send({
        data,
        source: 'fabric',
        cachedAt,
        cacheExpiresAt: expiresAt,
        queryMs,
      });
    } catch (err) {
      if (err.code === 'FABRIC_THROTTLE') {
        return reply.code(429).send({
          error: 'FABRIC_THROTTLE',
          message: 'Fabric returned 429 and all retries exhausted',
        });
      }
      if (err.code === 'AUTH_FAILED' || err.message?.startsWith('AUTH_FAILED:')) {
        return reply.code(502).send({
          error: 'AUTH_FAILED',
          message: err.message,
        });
      }
      if (err.code === 'INVALID_FILTER') {
        return reply.code(400).send({
          error: 'INVALID_FILTER',
          message: err.message,
          details: err.details,
        });
      }
      const msg = (err.message || '').toLowerCase();
      const isMeasureError = msg.includes('not found') || msg.includes('unknown identifier') ||
          msg.includes('invalid') || msg.includes('cannot find') ||
          msg.includes("doesn't exist") || msg.includes('failed to execute the dax query');
      // Also treat Fabric 400 on a DAX query as likely a bad measure name
      if (isMeasureError || err.status === 400) {
        return reply.code(400).send({
          error: 'MEASURE_NOT_FOUND',
          message: 'Measure not found in dataset. Check measure name and try again.',
        });
      }
      return reply.code(500).send({
        error: 'FABRIC_ERROR',
        message: err.message,
      });
    }
  });
}

module.exports = queryRoute;
