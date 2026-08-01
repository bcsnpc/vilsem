require('dotenv').config();

const fastify = require('fastify')({
  logger: { level: process.env.LOG_LEVEL || 'info' },
});
const cors = require('@fastify/cors');
const { apiKeyAuth } = require('./middleware/apiKey');
const { initCache, getCacheEntryCount, getCacheStats } = require('./cache/sqlite');
const { initAuth, getTokenInfo } = require('./auth/auth');
const { fetchMeasures, startAutoRefresh, getMeasuresList, getMeasuresInfo, getRefreshedAt } = require('./fabric/metadata');
const { getLimiterInfo } = require('./queue/limiter');
const { initLakehouse, getLakehouseInfo } = require('./fabric/lakehouse');
const { getXmlaInfo } = require('./fabric/xmla');
const { getAuditCounts } = require('./audit/log');
const queryRoute = require('./routes/query');
const batchRoute = require('./routes/batch');
const writebackRoute = require('./routes/writeback');
const auditRoute = require('./routes/audit');
const previewRoute = require('./routes/preview');

async function start() {
  try {
    // 1. Initialize cache (creates both query_cache and audit_log tables)
    await initCache();
    console.log('[app] SQLite cache initialized');

    // 2. Authenticate — blocks until token obtained
    await initAuth();
    console.log('[app] Authentication complete');

    // 3. Fetch measure metadata
    await fetchMeasures();
    startAutoRefresh();
    console.log('[app] Measure metadata loaded, auto-refresh started');

    // 4. Discover Lakehouse (non-fatal)
    await initLakehouse();

    // 5. Register CORS
    await fastify.register(cors);

    // 6. Global API key auth hook
    fastify.addHook('onRequest', apiKeyAuth);

    // 7. Health endpoint (no auth needed)
    fastify.get('/health', { onRequest: [] }, async (request, reply) => {
      const tokenInfo = getTokenInfo();
      const cacheStats = getCacheStats();
      const limiterInfo = getLimiterInfo();
      const measuresInfo = getMeasuresInfo();
      const lakehouseInfo = getLakehouseInfo();
      const xmlaInfo = getXmlaInfo();
      const auditCounts = getAuditCounts();

      return {
        status: 'healthy',
        fabric: 'connected',
        auth: {
          mode: tokenInfo.mode,
          tokenValid: tokenInfo.status === 'valid',
          expiresAt: tokenInfo.expiresAt,
        },
        cache: {
          engine: 'sqlite',
          entries: getCacheEntryCount(),
          hitRate: cacheStats.hitRate,
        },
        queue: {
          waiting: limiterInfo.waiting,
          active: limiterInfo.active,
          reqPerMin: limiterInfo.active,
        },
        measures: measuresInfo,
        lakehouse: lakehouseInfo,
        audit: auditCounts,
        xmla: {
          endpoint: xmlaInfo.endpoint,
          fallbackAvailable: xmlaInfo.fallbackAvailable,
        },
      };
    });

    // 8. Model measures endpoint
    fastify.get('/model/measures', async (request, reply) => {
      return {
        measures: getMeasuresList(),
        refreshedAt: getRefreshedAt(),
      };
    });

    // 9. Register route plugins
    await fastify.register(queryRoute);
    await fastify.register(batchRoute);
    await fastify.register(writebackRoute);
    await fastify.register(auditRoute);
    await fastify.register(previewRoute);

    // 10. Start server
    const port = parseInt(process.env.PORT, 10) || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`[app] Semantica server running on port ${port}`);
  } catch (err) {
    console.error('[app] Failed to start:', err.message);
    process.exit(1);
  }
}

start();

module.exports = fastify;
