const { writeLakehouseRows } = require('../fabric/lakehouse');
const { logWriteback } = require('../audit/log');
const { flushCache } = require('../cache/sqlite');
const crypto = require('crypto');

async function writebackRoute(fastify) {
  fastify.post('/writeback', async (request, reply) => {
    const start = Date.now();
    const { table, rows, destination, userId } = request.body || {};

    if (!table || typeof table !== 'string') {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'table is required and must be a string',
      });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'rows is required and must be a non-empty array',
      });
    }

    if (!destination) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'destination is required',
      });
    }

    if (destination !== 'lakehouse') {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'destination must be "lakehouse"',
      });
    }

    try {
      const writeResult = await writeLakehouseRows(table, rows);

      // Invalidate cache — writeback may change data the cache is serving
      flushCache();

      const auditId = `audit_${crypto.randomBytes(6).toString('hex')}`;
      const timestamp = new Date().toISOString();

      logWriteback({
        tableName: table,
        rowsWritten: writeResult.written,
        destination,
        userId,
      });

      const response = {
        written: writeResult.written,
        table,
        destination,
        writeMethod: writeResult.method,
        auditId,
        timestamp,
        queryMs: Date.now() - start,
      };

      if (writeResult.path) {
        response.writePath = writeResult.path;
      }

      return reply.send(response);
    } catch (err) {
      return reply.code(500).send({
        error: 'WRITEBACK_FAILED',
        message: err.message,
      });
    }
  });
}

module.exports = writebackRoute;
