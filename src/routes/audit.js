const { getAuditEntries } = require('../audit/log');

async function auditRoute(fastify) {
  fastify.get('/audit', async (request, reply) => {
    const limit = request.query.limit || 20;
    const type = request.query.type || null;

    if (type && type !== 'query' && type !== 'writeback') {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'type must be "query" or "writeback"',
      });
    }

    const { entries, total } = getAuditEntries(limit, type);
    return reply.send({ entries, total });
  });
}

module.exports = auditRoute;
