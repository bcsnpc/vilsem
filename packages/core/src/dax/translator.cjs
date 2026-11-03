/**
 * Translates Semantica filter syntax + measures into DAX EVALUATE query.
 * Pure function — no I/O or side effects.
 */

function parseFilterKey(key) {
  const match = key.match(/^([^[]+)\[([^\]]+)\]$/);
  if (!match) {
    throw Object.assign(
      new Error(`INVALID_FILTER: Cannot parse filter key "${key}". Expected format: TableName[ColumnName]`),
      { code: 'INVALID_FILTER', details: { key } }
    );
  }
  return { table: match[1], column: match[2] };
}

function buildColumnReference(key) {
  const { table, column } = parseFilterKey(key);
  return `'${table}'[${column}]`;
}

function escapeDaxString(value) {
  return String(value).replace(/"/g, '""');
}

function formatDaxLiteral(value) {
  if (value === null || value === undefined || value === '') return 'BLANK()';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'BLANK()';
  if (typeof value === 'boolean') return value ? 'TRUE()' : 'FALSE()';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `DATEVALUE("${escapeDaxString(value)}")`;
    return `"${escapeDaxString(value)}"`;
  }
  return `"${escapeDaxString(JSON.stringify(value))}"`;
}

function normaliseFilterValue(value) {
  if (typeof value === 'string' && value.includes('|')) {
    const [from, to] = value.split('|');
    if (from || to) return { from: from || null, to: to || null };
  }
  return value;
}

function buildFilterExpression(key, value) {
  const { table } = parseFilterKey(key);
  const ref = buildColumnReference(key);
  const normalisedValue = normaliseFilterValue(value);

  if (Array.isArray(normalisedValue)) {
    const values = normalisedValue.filter(v => v !== null && v !== undefined && v !== '');
    if (!values.length) return null;
    return `FILTER('${table}', ${ref} IN { ${values.map(formatDaxLiteral).join(', ')} })`;
  }

  if (normalisedValue && typeof normalisedValue === 'object') {
    const rangeLike = Object.prototype.hasOwnProperty.call(normalisedValue, 'from') ||
      Object.prototype.hasOwnProperty.call(normalisedValue, 'to');
    if (rangeLike) {
      const clauses = [];
      if (normalisedValue.from !== null && normalisedValue.from !== undefined && normalisedValue.from !== '') {
        clauses.push(`${ref} >= ${formatDaxLiteral(normalisedValue.from)}`);
      }
      if (normalisedValue.to !== null && normalisedValue.to !== undefined && normalisedValue.to !== '') {
        clauses.push(`${ref} <= ${formatDaxLiteral(normalisedValue.to)}`);
      }
      if (!clauses.length) return null;
      return `FILTER('${table}', ${clauses.join(' && ')})`;
    }

    const op = String(normalisedValue.op || normalisedValue.type || 'eq').toLowerCase();
    const scalarValue = Object.prototype.hasOwnProperty.call(normalisedValue, 'value')
      ? normalisedValue.value
      : normalisedValue;
    if (op === 'in' && Array.isArray(normalisedValue.values)) {
      const values = normalisedValue.values.filter(v => v !== null && v !== undefined && v !== '');
      if (!values.length) return null;
      return `FILTER('${table}', ${ref} IN { ${values.map(formatDaxLiteral).join(', ')} })`;
    }
    const opMap = {
      eq: '=',
      ne: '<>',
      gt: '>',
      gte: '>=',
      ge: '>=',
      lt: '<',
      lte: '<=',
      le: '<=',
    };
    const symbol = opMap[op] || '=';
    return `FILTER('${table}', ${ref} ${symbol} ${formatDaxLiteral(scalarValue)})`;
  }

  return `FILTER('${table}', ${ref} = ${formatDaxLiteral(normalisedValue)})`;
}

function translateToDAX(measures, filters = {}) {
  if (!measures || measures.length === 0) {
    throw Object.assign(
      new Error('VALIDATION_ERROR: At least one measure is required'),
      { code: 'VALIDATION_ERROR' }
    );
  }

  const filterKeys = Object.keys(filters);
  const filterParts = filterKeys.map((key) => buildFilterExpression(key, filters[key])).filter(Boolean);
  const measureParts = measures.map((m) => `"${m}", [${m}]`);

  const args = [...filterParts, ...measureParts];

  return `EVALUATE SUMMARIZECOLUMNS(\n  ${args.join(',\n  ')}\n)`;
}

module.exports = { translateToDAX, parseFilterKey, buildFilterExpression, buildColumnReference, formatDaxLiteral };
