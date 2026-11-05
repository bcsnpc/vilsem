const axios=require('axios');
const {getToken}=require('./auth.cjs');
let relationshipsCache=[];
function extractTableName(tmdl) {
  const match = tmdl.match(/^table\s+(.+)/m);
  if (!match) return 'Unknown';
  return match[1].trim().replace(/^'|'$/g, '').replace(/''/g,"'");
}

/** Returns the number of leading whitespace characters (spaces or tabs). */
function indentLen(line) {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

// TMDL quotes the entire text property only when needed, and doubles quotes
// inside that wrapper. Quotes belonging to an unwrapped format literal (e.g.
// 0.0,,"M") must remain part of the format string.
function decodeTextProperty(value) {
  const text=value.trim();
  return /^"(?:[^"]|"")*"$/.test(text) ? text.slice(1,-1).replace(/""/g,'"') : text;
}

/**
 * Collect a measure's multi-line expression, formatString, and description.
 * Based on the _collect_expression pattern from the reference TMDL parser.
 *
 * headerIndent = indent of the "measure Name =" line
 * inlineExpr   = the part after "=" on the same line (may be empty)
 */
function collectMeasureBlock(lines, startIdx, headerIndent, inlineExpr) {
  let formatString = null;
  let description  = null;
  let displayFolder = null;
  let isHidden = false;
  const exprLines  = [];
  let expressionDone = false;
  let idx = startIdx;

  while (idx < lines.length) {
    const line    = lines[idx];
    const stripped = line.trim();
    const il      = indentLen(line);

    if (!stripped) {
      // Empty line: preserve inside multi-line expression
      if (!expressionDone && exprLines.length > 0) exprLines.push('');
      idx++;
      continue;
    }

    // Sibling or parent indent → stop entirely
    if (il <= headerIndent) break;

    // Property line (formatString:, description:, lineageTag:, annotation, …)
    // Pattern: identifier followed immediately by colon
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(stripped) || stripped.startsWith('annotation ') || /^(isHidden|formatStringDefinition)\b/.test(stripped)) {
      expressionDone = true; // everything after first property is metadata, not DAX
      const fmtMatch  = stripped.match(/^formatString:\s*(.+)/);
      const descMatch = stripped.match(/^description:\s*(.+)/);
      if (fmtMatch)  formatString = decodeTextProperty(fmtMatch[1]);
      if (descMatch) description  = decodeTextProperty(descMatch[1]);
      const folderMatch = stripped.match(/^displayFolder:\s*(.*)/);
      if (folderMatch) displayFolder = decodeTextProperty(folderMatch[1]);
      if (/^isHidden(?:\s*:\s*true)?$/i.test(stripped)) isHidden = true;
      idx++;
      continue;
    }

    // Another object header → stop
    if (/^(table|column|measure|relationship)\s/.test(stripped)) break;

    // DAX expression line
    if (!expressionDone) exprLines.push(stripped);
    idx++;
  }

  // Trim trailing empty lines from expression
  while (exprLines.length > 0 && exprLines[exprLines.length - 1] === '') exprLines.pop();

  const allExpr = [...(inlineExpr && inlineExpr.trim() ? [inlineExpr.trim()] : []), ...exprLines];
  const expr = allExpr.length ? allExpr.join('\n') : null;

  return { expr, formatString, description, displayFolder, isHidden, nextIdx: idx };
}

/**
 * Parse a single table TMDL part into measures and columns.
 * Extracts DAX expressions, format strings, descriptions, and data types.
 */
function parseTmdlPart(tmdl) {
  const tableName = extractTableName(tmdl);
  const measures  = [];
  const columns   = [];
  const lines     = tmdl.split(/\r?\n/);
  let idx = 0;

  while (idx < lines.length) {
    const line     = lines[idx];
    const stripped = line.trim();
    const indent   = indentLen(line);

    if (!stripped) { idx++; continue; }

    // ── Measure ──────────────────────────────────────────────────────────────
    const measureMatch = stripped.match(/^measure\s+('(?:[^']|'')*'|[^=\r\n]+?)\s*=\s*(.*)$/);
    if (measureMatch) {
      const name       = measureMatch[1].trim().replace(/^'|'$/g,'').replace(/''/g,"'");
      const inlineExpr = measureMatch[2]; // may be empty string
      if (!name) { idx++; continue; }

      const { expr, formatString, description, displayFolder, isHidden, nextIdx } =
        collectMeasureBlock(lines, idx + 1, indent, inlineExpr);

      measures.push({ name, table: tableName, expression: expr, formatString, description, displayFolder, isHidden });
      idx = nextIdx;
      continue;
    }

    // ── Column (data columns only — no inline "= expr") ───────────────────
    const colMatch = stripped.match(/^column\s+('(?:[^']|'')*'|[^=\r\n]+?)(?:\s*=\s*.*)?$/);
    if (colMatch) {
      const name = colMatch[1].trim().replace(/^'|'$/g,'').replace(/''/g,"'");
      if (!name) { idx++; continue; }

      let dataType = '';
      let isHidden = false, isKey = false;
      let j = idx + 1;
      while (j < lines.length) {
        const cl = lines[j];
        if (!cl.trim()) { j++; continue; }
        if (indentLen(cl) <= indent) break;
        const dtMatch = cl.trim().match(/^dataType:\s*(\S+)/);
        if (dtMatch) dataType = dtMatch[1].trim();
        if (/^isHidden(?:\s*:\s*true)?$/i.test(cl.trim())) isHidden = true;
        if (/^isKey(?:\s*:\s*true)?$/i.test(cl.trim())) isKey = true;
        j++;
      }
      columns.push({ name, dataType, isHidden, isKey });
      idx = j;
      continue;
    }

    idx++;
  }

  return { tableName, measures, columns };
}

/**
 * Parse relationship definitions from a model.tmdl TMDL part.
 * Handles: fromColumn / toColumn / cardinality / crossFilteringBehavior / isActive
 */
function parseRelationshipsPart(tmdl) {
  const relationships = [];
  const lines = tmdl.split(/\r?\n/);
  let idx = 0;

  while (idx < lines.length) {
    const line     = lines[idx];
    const stripped = line.trim();
    const indent   = indentLen(line);

    if (!stripped) { idx++; continue; }

    const relMatch = stripped.match(/^relationship\s+(.+?)\s*$/);
    if (relMatch) {
      const name = relMatch[1].trim().replace(/^'|'$/g, '');
      let fromTable = null, fromColumn = null;
      let toTable   = null, toColumn   = null;
      let cardinality  = null;
      let fromCardinality = 'many', toCardinality = 'one';
      let crossFilter  = null;
      let isActive     = true;

      let j = idx + 1;
      while (j < lines.length) {
        const cl = lines[j];
        const cs = cl.trim();
        if (!cs) { j++; continue; }
        if (indentLen(cl) <= indent) break;

        const fromMatch   = cs.match(/^fromColumn:\s*(.+)/);
        const toMatch     = cs.match(/^toColumn:\s*(.+)/);
        const cardMatch   = cs.match(/^cardinality:\s*(.+)/);
        const cfMatch     = cs.match(/^crossFilteringBehavior:\s*(.+)/);
        const activeMatch = cs.match(/^isActive:\s*(true|false)/i);

        if (fromMatch) {
          const ep = parseRelEndpoint(fromMatch[1].trim());
          fromTable  = ep.table;
          fromColumn = ep.column;
        }
        if (toMatch) {
          const ep = parseRelEndpoint(toMatch[1].trim());
          toTable  = ep.table;
          toColumn = ep.column;
        }
        if (cardMatch)   cardinality = cardMatch[1].trim();
        if (/^fromCardinality:/.test(cs)) fromCardinality = cs.split(':')[1].trim();
        if (/^toCardinality:/.test(cs)) toCardinality = cs.split(':')[1].trim();
        if (cfMatch)     crossFilter = cfMatch[1].trim();
        if (activeMatch) isActive    = activeMatch[1].toLowerCase() === 'true';
        j++;
      }

      if (fromTable && fromColumn && toTable && toColumn) {
        relationships.push({
          name, fromTable, fromColumn, toTable, toColumn,
          cardinality:cardinality || `${fromCardinality}_to_${toCardinality}`, fromCardinality, toCardinality, crossFilter:crossFilter || 'oneDirection', direction:crossFilter || 'oneDirection', isActive,
          key: `${fromTable}[${fromColumn}] → ${toTable}[${toColumn}]`,
        });
      }
      idx = j;
      continue;
    }

    idx++;
  }

  return relationships;
}

function parseRelEndpoint(endpoint) {
  // "TableName.ColumnName" or "'Table Name'.ColumnName"
  const match = endpoint.match(/^('(?:[^']|'')*'|[^.]+)\s*\.\s*('(?:[^']|'')*'|.+)$/);
  if (!match) return { table: null, column: null };
  const table = match[1].trim().replace(/^'|'$/g,'').replace(/''/g,"'");
  const column = match[2].trim().replace(/^'|'$/g,'').replace(/''/g,"'");
  return { table, column };
}

// ── TMSL (model.bim) parsing ──────────────────────────────────────────────────

let rawModelBimCache = null

/**
 * Parse a model.bim TOM JSON into { measures, tables, relationships }.
 * This is the deterministic alternative to TMDL regex parsing.
 */
function parseTmslModelBim(modelBim) {
  const model = modelBim?.model || modelBim
  const measures      = []
  const tableMap      = new Map()
  const relationships = []

  // ── Measures + Columns from tables[] ────────────────────────────────────────
  for (const table of (model.tables || [])) {
    const tableName = table.name
    if (!tableName) continue

    for (const m of (table.measures || [])) {
      if (!m.name) continue
      // TMSL expressions can be a string or an array of strings (multiline DAX)
      const expr = Array.isArray(m.expression)
        ? m.expression.join('\n')
        : (m.expression || null)
      measures.push({
        name:         m.name,
        table:        tableName,
        expression:   expr,
        formatString: m.formatString || null,
        description:  m.description  || null,
        displayFolder:m.displayFolder || null,
        isHidden:     m.isHidden     || false,
      })
    }

    const columns = (table.columns || [])
      .filter(c => c.name)
      .map(c => ({
        name:         c.name,
        dataType:     c.dataType     || 'unknown',
        isHidden:     c.isHidden     || false,
        dataCategory: c.dataCategory || null,
        isKey:        c.isKey        || false,
      }))

    tableMap.set(tableName, columns)
  }

  // ── Relationships ────────────────────────────────────────────────────────────
  for (const rel of (model.relationships || [])) {
    if (!rel.fromTable || !rel.fromColumn || !rel.toTable || !rel.toColumn) continue
    relationships.push({
      name:         rel.name || `${rel.fromTable}[${rel.fromColumn}]->${rel.toTable}[${rel.toColumn}]`,
      fromTable:    rel.fromTable,
      fromColumn:   rel.fromColumn,
      toTable:      rel.toTable,
      toColumn:     rel.toColumn,
      cardinality:  `${rel.fromCardinality || 'many'}_to_${rel.toCardinality || 'one'}`,
      crossFilter:  rel.crossFilteringBehavior || 'oneDirection',
      direction:    rel.crossFilteringBehavior || 'oneDirection',
      isActive:     rel.isActive !== false,
      key:          `${rel.fromTable}[${rel.fromColumn}] → ${rel.toTable}[${rel.toColumn}]`,
    })
  }

  const tables = [...tableMap.entries()].map(([name, columns]) => ({ name, columns }))
  return { measures, tables, relationships }
}

async function discoverViaTmsl(workspaceId, datasetId, token) {
  if (!token) token = await getToken()
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  console.error('[metadata] Fabric Item Definition API: requesting TMSL (model.bim)...')
  const res = await axios.post(
    `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/semanticModels/${datasetId}/getDefinition?format=TMSL`,
    {},
    { headers, timeout: 30000, validateStatus: s => s < 500 }
  )

  if (res.status === 401) throw Object.assign(new Error('Token lacks required scope'), { code: 'UNAUTHORIZED' })
  if (res.status === 403) throw Object.assign(new Error('Permission denied for Item Definition API'), { code: 'FORBIDDEN' })
  if (res.status === 404) throw Object.assign(new Error('Dataset not found'), { code: 'NOT_FOUND' })

  let parts
  if (res.status === 200) {
    parts = res.data.definition?.parts || []
  } else if (res.status === 202) {
    const operationUrl = res.headers['location']
    if (!operationUrl) throw new Error('Item Definition API returned 202 but no Location header')
    console.error('[metadata] TMSL: async operation, polling...')
    parts = await pollOperation(operationUrl, token)
  } else {
    throw new Error(`TMSL request returned ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`)
  }

  if (!parts || parts.length === 0) throw new Error('TMSL returned no parts')

  // Find model.bim part
  const bimPart = parts.find(p => p.path === 'model.bim')
  if (!bimPart?.payload) throw new Error('model.bim not found in TMSL parts')

  const modelBim = JSON.parse(Buffer.from(bimPart.payload, 'base64').toString('utf8'))
  rawModelBimCache = modelBim

  const { measures, tables, relationships } = parseTmslModelBim(modelBim)
  console.error(`[metadata] TMSL: found ${measures.length} measures, ${tables.length} tables, ${relationships.length} relationships`)
  return { measures, tables, relationships, rawModelBim: modelBim }
}

// ── Item Definition API discovery ─────────────────────────────────────────────

async function pollOperation(operationUrl, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await axios.get(operationUrl, { headers, timeout: 15000 });
    const status = res.data.status;
    console.error(`[metadata] Item Definition API: operation status = ${status}`);
    if (status === 'Succeeded') {
      // Result URL is in the response or in a separate result endpoint
      const resultUrl = res.headers['location'] || res.data.resourceLocation;
      if (resultUrl) {
        const resultRes = await axios.get(resultUrl, { headers, timeout: 15000 });
        return resultRes.data.definition?.parts || [];
      }
      return res.data.definition?.parts || [];
    }
    if (status === 'Failed') throw new Error('Item Definition API operation failed: ' + (res.data.error?.message || 'unknown'));
  }
  throw new Error('Item Definition API timed out after 60s');
}

async function discoverViaItemDefinition(workspaceId, datasetId, token) {
  if (!token) token = await getToken();

  // ── Primary: TMSL (model.bim JSON — deterministic, has all relationships) ──
  try {
    const result = await discoverViaTmsl(workspaceId, datasetId, token);
    relationshipsCache = result.relationships;
    return result;
  } catch (tmslErr) {
    console.error('[metadata] TMSL failed, falling back to TMDL:', tmslErr.message?.split('\n')[0]);
    // Re-throw auth/permission errors immediately — TMDL would fail too
    if (tmslErr.code === 'UNAUTHORIZED' || tmslErr.code === 'FORBIDDEN' || tmslErr.code === 'NOT_FOUND') {
      throw tmslErr;
    }
  }

  // ── Fallback: TMDL (regex parsing) ──────────────────────────────────────────
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  console.error('[metadata] Fabric Item Definition API: requesting TMDL (fallback)...');
  const res = await axios.post(
    `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/semanticModels/${datasetId}/getDefinition?format=TMDL`,
    {},
    { headers, timeout: 30000, validateStatus: s => s < 500 }
  );

  if (res.status === 401) throw Object.assign(new Error('Token lacks required scope'), { code: 'UNAUTHORIZED' });
  if (res.status === 403) throw Object.assign(new Error('Permission denied for Item Definition API'), { code: 'FORBIDDEN' });
  if (res.status === 404) throw Object.assign(new Error('Dataset not found or not a semantic model'), { code: 'NOT_FOUND' });

  let parts;
  if (res.status === 200) {
    parts = res.data.definition?.parts || [];
  } else if (res.status === 202) {
    const operationUrl = res.headers['location'];
    if (!operationUrl) throw new Error('Item Definition API returned 202 but no Location header');
    console.error('[metadata] TMDL fallback: async operation, polling...');
    parts = await pollOperation(operationUrl, token);
  } else {
    throw new Error(`Item Definition API returned ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
  }

  if (!parts || parts.length === 0) throw new Error('Item Definition API returned no parts');

  console.error(`[metadata] TMDL fallback: received ${parts.length} parts`);

  const measures      = [];
  const tableMap      = new Map();
  const relationships = [];

  for (const part of parts) {
    if (!part.payload) continue;
    const tmdl = Buffer.from(part.payload, 'base64').toString('utf8');

    // Parse relationships from model.tmdl or relationships.tmdl
    if (part.path?.includes('model.tmdl') || part.path?.includes('relationships.tmdl')) {
      const rels = parseRelationshipsPart(tmdl);
      relationships.push(...rels);
    }

    if (!part.path?.startsWith('definition/tables/')) continue;
    const { tableName, measures: tMeasures, columns } = parseTmdlPart(tmdl);
    for (const m of tMeasures) measures.push(m);
    if (tableName) {
      if (!tableMap.has(tableName)) tableMap.set(tableName, []);
      tableMap.get(tableName).push(...columns);
    }
  }

  const tables = [...tableMap.entries()].map(([name, columns]) => ({ name, columns }));
  relationshipsCache = relationships;
  console.error(`[metadata] TMDL fallback: found ${measures.length} measures, ${tables.length} tables, ${relationships.length} relationships`);
  return { measures, tables, relationships };
}

// ── Scanner API discovery ─────────────────────────────────────────────────────

async function discoverViaScanner(workspaceId, datasetId, token) {
  if (!token) token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };

  console.error('[metadata] Scanner API: triggering scan for workspace', workspaceId);
  const triggerRes = await axios.post(
    'https://api.powerbi.com/v1.0/myorg/admin/workspaces/getInfo?datasetSchema=true&datasetExpressions=true',
    { workspaces: [workspaceId] },
    { headers, timeout: 20000 }
  );
  const scanId = triggerRes.data.id;
  if (!scanId) throw new Error('Scanner API returned no scan ID');

  let succeeded = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(
      `https://api.powerbi.com/v1.0/myorg/admin/workspaces/scanStatus/${scanId}`,
      { headers, timeout: 10000 }
    );
    const status = statusRes.data.status;
    console.error(`[metadata] Scanner API: scan status = ${status}`);
    if (status === 'Succeeded') { succeeded = true; break; }
    if (status === 'Failed') throw new Error(`Scanner scan failed: ${statusRes.data.error || 'unknown'}`);
  }
  if (!succeeded) throw Object.assign(new Error('Scanner API timed out after 30s'), { code: 'TIMEOUT' });

  const resultRes = await axios.get(
    `https://api.powerbi.com/v1.0/myorg/admin/workspaces/scanResult/${scanId}`,
    { headers, timeout: 20000 }
  );

  const workspace = (resultRes.data.workspaces || [])[0];
  if (!workspace) throw Object.assign(new Error('Workspace not found in scanner results'), { code: 'NOT_FOUND' });

  const dataset = (workspace.datasets || []).find(d => d.id === datasetId);
  if (!dataset) {
    const ids = (workspace.datasets || []).map(d => d.id).join(', ');
    throw Object.assign(new Error(`Dataset ${datasetId} not found. Available: [${ids}]`), { code: 'NOT_FOUND' });
  }

  const measures = [];
  const tables   = [];
  for (const table of (dataset.tables || [])) {
    for (const measure of (table.measures || [])) {
      if (measure.isHidden || !measure.name || measure.name.startsWith('__')) continue;
      measures.push({ name: measure.name, table: table.name });
    }
    const columns = (table.columns || [])
      .filter(c => !c.isHidden && c.name && !c.name.startsWith('RowNumber') && !c.name.startsWith('__'))
      .map(c => ({ name: c.name, dataType: c.dataType || '' }));
    if (columns.length > 0) tables.push({ name: table.name, columns });
  }

  console.error(`[metadata] Scanner API: found ${measures.length} measures, ${tables.length} tables`);
  return { measures, tables };
}

// ── Main fetch ────────────────────────────────────────────────────────────────


module.exports={parseTmdlPart,parseTmslModelBim,parseRelationshipsPart,discoverViaTmsl,discoverViaItemDefinition,discoverViaScanner};
