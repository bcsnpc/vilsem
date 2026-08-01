/**
 * modelContext.js
 * Builds a rich structured summary of the semantic model for use in AI prompts.
 * Works entirely from in-memory data (enriched measures + dimension tables + relationships)
 * — no file I/O, no local connections.
 */

// ── Measure inference ──────────────────────────────────────────────────────────

function inferMeasureType(name, expression) {
  const n = (name       || '').toLowerCase();
  const e = (expression || '').toLowerCase();

  if (n.includes('%') || n.includes('rate') || n.includes('ratio') ||
      n.includes('pct') || n.includes('percent') || n.includes('share') ||
      n.includes('margin') || n.includes('efficiency') || n.includes('utilization')) {
    return 'percentage';
  }
  if (n.includes('revenue') || n.includes('sales') || n.includes('cost') ||
      n.includes('price') || n.includes('profit') || n.includes('amount') ||
      n.includes('earning') || n.includes('spend') || n.includes('budget') ||
      n.includes('value') || n.includes('income')) {
    return 'currency';
  }
  if (n.includes('count') || n.includes('number') || n.includes('qty') ||
      n.includes('quantity') || n.includes('total') || n.includes('sum') ||
      e.includes('countrows') || e.includes('distinctcount') || e.includes('count(')) {
    return 'count';
  }
  if (n.includes('avg') || n.includes('average') || n.includes('mean') ||
      e.includes('average(') || e.includes('averagex(')) {
    return 'average';
  }
  if (n.includes('rank') || n.includes('index') || n.includes('position')) {
    return 'rank';
  }
  return 'numeric';
}

function isRatioMeasure(name, expression, formatString) {
  const n  = (name         || '').toLowerCase();
  const e  = (expression   || '').toLowerCase();
  const fs = (formatString || '').toLowerCase();

  return n.includes('%') || n.includes('rate') || n.includes('ratio') ||
    n.includes('pct') || n.includes('percent') || n.includes('share') ||
    n.includes('margin') || fs.includes('%') || fs.includes('0.0%') ||
    e.includes('divide(') || (e.includes('/') && !e.includes('//'));
}

function isTimeIntelligenceMeasure(name, expression) {
  const n = (name       || '').toLowerCase();
  const e = (expression || '').toLowerCase();

  return n.includes('ytd') || n.includes('mtd') || n.includes('qtd') ||
    n.includes('yoy') || n.includes('mom') || n.includes(' vs ') ||
    n.includes('prev') || n.includes('last year') || n.includes(' ly') ||
    n.includes('growth') || n.includes('change') ||
    e.includes('datesytd') || e.includes('datesmtd') || e.includes('datesqtd') ||
    e.includes('dateadd') || e.includes('sameperiodlastyear') ||
    e.includes('previousyear') || e.includes('previousmonth') ||
    e.includes('parallelperiod');
}

// ── Column inference ───────────────────────────────────────────────────────────

function isKeyColumn(colName) {
  const n = (colName || '').toLowerCase();
  return n.endsWith('_id') || n.endsWith('_key') || n === 'id' || n === 'key' ||
    n.endsWith('id') || n.endsWith('key');
}

function isDateColumn(colName, dataType) {
  const n  = (colName  || '').toLowerCase();
  const dt = (dataType || '').toLowerCase();
  return dt.includes('date') || dt.includes('datetime') ||
    n === 'date' || n === 'year' || n === 'month' || n === 'quarter' ||
    n === 'week' || n === 'day' || n.includes('date') || n.includes('_dt') ||
    n.includes('_year') || n.includes('_month') || n.includes('period');
}

function isCategoryColumn(colName, dataType) {
  const dt = (dataType || '').toLowerCase();
  return (dt === 'string' || dt === 'text' || dt === 'varchar' || dt === 'nvarchar' ||
          dt === '' || dt === 'unknown') &&
    !isKeyColumn(colName) &&
    !isDateColumn(colName, dataType);
}

function isGeographyColumn(colName) {
  const n = (colName || '').toLowerCase();
  return n.includes('city') || n.includes('country') || n.includes('region') ||
    n.includes('state') || n.includes('zip') || n.includes('postal') ||
    n.includes('lat') || n.includes('lon') || n.includes('location') ||
    n.includes('address') || n.includes('territory') || n.includes('province') ||
    n.includes('venue') || n.includes('stadium') || n.includes('ground');
}

function cleanColumnLabel(raw) {
  if (!raw) return '';
  const withoutTable = raw.includes('[')
    ? raw.split('[')[1].replace(']', '')
    : raw;
  return withoutTable
    .replace(/^(dim_|fact_|tbl_|fct_|stg_)/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

// ── Table inference ────────────────────────────────────────────────────────────

function inferTableType(tableName) {
  const n = (tableName || '').toLowerCase();
  if (n.startsWith('dim_') || n.startsWith('d_') || n.startsWith('dim ') ||
      n.startsWith('lookup') || n === 'date' || n === 'calendar') {
    return 'dimension';
  }
  if (n.startsWith('fact_') || n.startsWith('f_') || n.startsWith('fct_') ||
      n.startsWith('trans_')) {
    return 'fact';
  }
  if (n.includes('date') || n.includes('calendar') || n.includes('time')) {
    return 'date';
  }
  if (n.startsWith('_') || n.includes('measure') || n.includes('metric') ||
      n.includes('kpi') || n === 'measures') {
    return 'measure_group';
  }
  return 'unknown';
}

// ── Domain inference ───────────────────────────────────────────────────────────

function inferDomain(measures, tables) {
  const allNames = [
    ...measures.map(m => m.name),
    ...tables.map(t => t.tableName || t.name || ''),
  ].join(' ').toLowerCase();

  // Use word-boundary matching to avoid false positives like:
  // "run" inside "current", "over" inside "turnover", "match" inside "dispatch"
  function w(word) { return new RegExp(`\\b${word}\\b`).test(allNames) }

  // Sports: require specific terms that don't appear in business datasets
  if (w('wicket') || w('batting') || w('innings') || w('cricket') ||
      w('soccer') || w('basketball') || w('touchdown') || w('pitcher') ||
      (w('match') && (w('innings') || w('wicket') || w('bowl') || w('run'))) ||
      (w('run') && (w('wicket') || w('innings') || w('batting')))) return 'sports';

  if (w('revenue') || w('sales') || w('customer') || w('product') ||
      w('order') || w('sku') || w('reseller') || w('internet') && w('sales')) return 'retail';

  if (w('patient') || w('clinical') || w('diagnosis') || w('treatment') ||
      w('hospital') || w('prescription')) return 'healthcare';

  if (w('employee') || w('headcount') || w('attrition') || w('salary') ||
      w('hire') || w('payroll')) return 'hr';

  if (w('shipment') || w('supplier') || w('inventory') || w('warehouse') ||
      w('logistics') || w('freight')) return 'supply_chain';

  if (w('campaign') || w('impression') || w('ctr') || w('roas') ||
      w('conversion') && w('campaign')) return 'marketing';

  if (w('ticket') || w('incident') || w('sla') || w('escalation')) return 'operations';

  return 'general';
}

// ── Main builder ───────────────────────────────────────────────────────────────

/**
 * Build a rich model context object from enriched measures, dimension tables,
 * and relationships. All inputs come from in-memory data (already fetched from
 * Fabric — no network calls here).
 *
 * @param {Array} enrichedMeasures  - [{name, table, expression, formatString, description}]
 * @param {Array} dimensionTables   - [{tableName, columns: [{name, dataType}]}]
 * @param {Array} relationships     - [{fromTable, fromColumn, toTable, toColumn, cardinality, key}]
 */
function buildModelContext(enrichedMeasures, dimensionTables, relationships, rawModelBim) {
  const measures = (enrichedMeasures || []).map(m => ({
    name:              m.name,
    table:             m.table,
    expression:        m.expression   || null,
    formatString:      m.formatString || null,
    description:       m.description  || null,
    dataType:          inferMeasureType(m.name, m.expression),
    isRatio:           isRatioMeasure(m.name, m.expression, m.formatString),
    isTimeIntelligence: isTimeIntelligenceMeasure(m.name, m.expression),
  }));

  const tables = (dimensionTables || []).map(t => {
    const tName = t.tableName || t.name || '';
    const cols  = (t.columns  || []).map(col => {
      const colName = typeof col === 'string' ? col : (col.name || col.columnName || '');
      const colType = typeof col === 'string' ? 'unknown' : (col.dataType || 'unknown');
      return {
        name:           colName,
        dataType:       colType,
        isKey:          isKeyColumn(colName),
        isDate:         isDateColumn(colName, colType),
        isCategory:     isCategoryColumn(colName, colType),
        isGeography:    isGeographyColumn(colName),
        cleanLabel:     cleanColumnLabel(colName),
      };
    });
    return {
      name:      tName,
      tableType: inferTableType(tName),
      columns:   cols,
    };
  });

  const rels = (relationships || []).filter(r => r.fromTable && r.toTable);

  const factTables = tables.filter(t => t.tableType === 'fact').map(t => t.name);
  const dimTables  = tables.filter(t => t.tableType === 'dimension').map(t => t.name);
  const dateTables = tables.filter(t => t.tableType === 'date').map(t => t.name);

  const hasDates = dateTables.length > 0 ||
    tables.some(t => t.columns.some(c => c.isDate));

  const hasGeography = tables.some(t => t.columns.some(c => c.isGeography));

  const domain = inferDomain(enrichedMeasures || [], dimensionTables || []);

  const summary = {
    totalMeasures:    measures.length,
    totalTables:      tables.length,
    factTables,
    dimensionTables:  dimTables,
    dateTables,
    hasDates,
    hasGeography,
    domain,
    ratioMeasures:    measures.filter(m => m.isRatio).map(m => m.name),
    tiMeasures:       measures.filter(m => m.isTimeIntelligence).map(m => m.name),
  };

  console.log(`[modelContext] Built context: ${domain} domain, ${measures.length} measures, ${tables.length} tables, ${rels.length} relationships`);

  return { measures, tables, relationships: rels, summary, rawModelBim: rawModelBim || null };
}

module.exports = { buildModelContext };
