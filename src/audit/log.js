const { getDb, persistDb: _persist } = require('../cache/sqlite');

// Re-export persistDb via getDb() pattern — we call it through the db instance
function persist() {
  const db = getDb();
  if (!db) return;
  // sqlite.js owns persistDb; we trigger it by going through a no-op run
  // (persistDb is not exported, so we rely on cacheSet/flushCache in sqlite.js
  //  for persistence. Here we need our own persist call.)
  // Instead, import the internal persistDb indirectly: write a helper below.
  _persistAudit();
}

// We need access to the file path and export function. Import them via sqlite module.
const sqliteModule = require('../cache/sqlite');

function _persistAudit() {
  // Use the shared db — the file is persisted via the sqlite module's own persistDb.
  // Since audit writes happen alongside cache operations, we call persistDb via
  // a thin workaround: write a no-op cache-key to trigger persistence.
  // Cleaner: just call the underlying db.export() and write ourselves.
  const db = getDb();
  if (!db) return;

  const fs = require('fs');
  const path = require('path');
  const DB_FILE = path.resolve(process.cwd(), 'cache', 'semantica.db');
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

/**
 * Log a query event.
 */
function logQuery({ measures, filters, source, queryMs }) {
  const db = getDb();
  if (!db) return;

  db.run(
    `INSERT INTO audit_log (type, measures, filters, source, query_ms, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'query',
      JSON.stringify(measures),
      JSON.stringify(filters || {}),
      source,
      queryMs,
      new Date().toISOString(),
    ]
  );
  _persistAudit();
}

/**
 * Log a writeback event.
 */
function logWriteback({ tableName, rowsWritten, destination, userId }) {
  const db = getDb();
  if (!db) return;

  db.run(
    `INSERT INTO audit_log (type, table_name, rows_written, destination, user_id, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'writeback',
      tableName,
      rowsWritten,
      destination,
      userId || null,
      new Date().toISOString(),
    ]
  );
  _persistAudit();
}

/**
 * Retrieve audit entries. Returns formatted entries sorted newest-first.
 */
function getAuditEntries(limit = 20, type = null) {
  const db = getDb();
  if (!db) return { entries: [], total: 0 };

  const safeLimitVal = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  let rows;
  if (type) {
    const stmt = db.prepare(
      `SELECT * FROM audit_log WHERE type = ? ORDER BY id DESC LIMIT ?`
    );
    stmt.bind([type, safeLimitVal]);
    rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
  } else {
    const stmt = db.prepare(
      `SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`
    );
    stmt.bind([safeLimitVal]);
    rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
  }

  // Count total (unfiltered by limit)
  let totalResult;
  if (type) {
    const stmt = db.prepare(`SELECT COUNT(*) as c FROM audit_log WHERE type = ?`);
    stmt.bind([type]);
    stmt.step();
    totalResult = stmt.getAsObject();
    stmt.free();
  } else {
    const result = db.exec(`SELECT COUNT(*) FROM audit_log`);
    totalResult = { c: result[0]?.values?.[0]?.[0] ?? 0 };
  }

  const entries = rows.map((row) => {
    if (row.type === 'query') {
      return {
        id: row.id,
        type: 'query',
        measures: tryParse(row.measures, []),
        filters: tryParse(row.filters, {}),
        source: row.source,
        queryMs: row.query_ms,
        timestamp: row.timestamp,
      };
    }
    return {
      id: row.id,
      type: 'writeback',
      table: row.table_name,
      rowsWritten: row.rows_written,
      destination: row.destination,
      userId: row.user_id,
      timestamp: row.timestamp,
    };
  });

  return { entries, total: totalResult.c };
}

/**
 * Get counts for /health.
 */
function getAuditCounts() {
  const db = getDb();
  if (!db) return { totalQueries: 0, totalWritebacks: 0 };

  const result = db.exec(
    `SELECT type, COUNT(*) as c FROM audit_log GROUP BY type`
  );

  let totalQueries = 0;
  let totalWritebacks = 0;
  if (result.length > 0) {
    for (const [type, count] of result[0].values) {
      if (type === 'query') totalQueries = count;
      if (type === 'writeback') totalWritebacks = count;
    }
  }
  return { totalQueries, totalWritebacks };
}

function tryParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = { logQuery, logWriteback, getAuditEntries, getAuditCounts };
