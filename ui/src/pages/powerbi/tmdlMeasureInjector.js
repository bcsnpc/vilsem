/**
 * TMDL Measure Injector
 * ─────────────────────
 * Produces the contents of `definition/tables/_SemanticaGenerated.tmdl` —
 * a dedicated table that holds auto-generated `_SemanticaHtml_<slug>`
 * measures returning pre-rendered HTML strings as DAX string literals.
 *
 * Used by the HTML-Content-via-XMLA publish path (separate from the
 * Semantica Renderer org-library path). Nothing in this file is imported
 * by the existing reportBuilder.js or Semantica Renderer code.
 *
 * Output format mirrors what Power BI writes in real TMDL:
 *
 *   table _SemanticaGenerated
 *       lineageTag: <uuid>
 *
 *       measure _SemanticaHtml_<slug> = ```
 *               "<escaped html string>"
 *               ```
 *           lineageTag: <uuid>
 *
 *       partition _SemanticaGenerated-<uuid> = m
 *           mode: import
 *           source = <empty single-column stub, same as Power BI's calc tables>
 *
 *       annotation PBI_ResultType = Table
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Fast deterministic 32-bit hash of a string (djb2-variant).
 * Used to append uniqueness to truncated visual IDs so duplicates don't
 * collapse into the same measure name.
 */
function hashShort(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0
  }
  return h.toString(36).padStart(7, '0').slice(0, 8)
}

/**
 * Build the measure name for a given visual id. Must be a valid DAX
 * identifier — alphanumerics + underscore, start with letter or underscore.
 *
 * Uses clean-prefix + hash-of-full-id so duplicate visuals with similar IDs
 * (e.g. "visual_1_copy_12345" and "visual_1_copy_12345_copy_67890") don't
 * collide when the clean prefix gets truncated.
 */
export function measureNameForVisual(visualId) {
  const raw = String(visualId || '')
  const clean = raw.replace(/-/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16)
  if (!clean) return `_SemanticaHtml_v${hashShort(raw || String(Math.random()))}`
  return `_SemanticaHtml_${clean}_${hashShort(raw)}`
}

/**
 * Measure name for a visual's tooltip-page HTML. Phase 9a (Report Page Tooltips):
 * each published visual gets a second measure returning a smaller tooltip view.
 */
export function tooltipMeasureNameForVisual(visualId) {
  const raw = String(visualId || '')
  const clean = raw.replace(/-/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16)
  if (!clean) return `_SemanticaTooltipHtml_v${hashShort(raw || String(Math.random()))}`
  return `_SemanticaTooltipHtml_${clean}_${hashShort(raw)}`
}

/**
 * Phase 5.3 — secondary/tertiary measure names for primitive-covered visuals
 * with multi-measure data shapes (stacked/grouped bar, scatter+secondary, bubble).
 * Each measure gets a distinct name so PBI can bind it to the renderer's
 * secondary/tertiary data role separately. Suffix encodes the role index.
 */
export function secondaryMeasureNameForVisual(visualId) {
  return `${measureNameForVisual(visualId)}_S`
}
export function tertiaryMeasureNameForVisual(visualId) {
  return `${measureNameForVisual(visualId)}_T`
}
// Table visuals bind ALL N measures to the content role. Each gets a distinct
// name suffixed by its index (_M0, _M1, …) so PBI can route them as separate
// value columns in dv.categorical.values[].
export function tableMeasureNameForVisual(visualId, index) {
  return `${measureNameForVisual(visualId)}_M${index}`
}

/**
 * Escape a raw HTML string for embedding inside a DAX string literal
 * that is wrapped in triple-backticks. Only double-quotes need doubling
 * because the DAX string itself uses double-quote delimiters. Backticks
 * would terminate the triple-backtick block — we conservatively strip
 * standalone backtick runs from the HTML (HTML doesn't need them).
 *
 * Control characters (< 0x20 except tab/lf/cr) are stripped — they break
 * TMDL parsing in rare edge cases.
 */
function escapeForDaxInTmdl(html) {
  if (html == null) return ''
  return String(html)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/```/g, "'''")      // kill triple-backticks that would close the block
    .replace(/"/g, '""')          // DAX string escape
}

/**
 * Build a single measure block (indented with tabs to match TMDL style).
 * If `isRawDax` is true, the body is a raw DAX expression (not a string
 * literal) — used by the live-DAX cross-filter path.
 */
function renderMeasureBlock(name, html, isRawDax = false) {
  if (isRawDax) {
    // Raw DAX expression — no wrapping quotes, no escaping. The caller
    // (daxTemplateBuilder) already built a valid DAX expression.
    return [
      `\tmeasure ${name} = \`\`\``,
      `\t\t\t`,
      ...html.split('\n').map((line) => `\t\t\t${line}`),
      `\t\t\t`,
      `\t\t\t\`\`\``,
      `\t\tlineageTag: ${uuidv4()}`,
      ``,
    ].join('\n')
  }
  const body = escapeForDaxInTmdl(html)
  return [
    `\tmeasure ${name} = \`\`\``,
    `\t\t\t`,
    `\t\t\t"${body}"`,
    `\t\t\t`,
    `\t\t\t\`\`\``,
    `\t\tlineageTag: ${uuidv4()}`,
    ``,
  ].join('\n')
}

/**
 * Merge arbitrary named measures (raw DAX or HTML) into the existing
 * _SemanticaGenerated table WITHOUT rebuilding it — every measure already in the
 * table (previously-injected visuals) is preserved; only names that collide with
 * a new measure are overwritten. This is the inject-SAFE path (unlike the
 * rewrite/replace builders which drop the whole table).
 *
 * @param {Array<{path,content}>} originalParts
 * @param {Array<{name:string, body:string, isRawDax?:boolean}>} namedMeasures
 * @returns {{ parts: Array<{path,content}>, tableName: string }}
 */
export function mergeNamedMeasuresIntoTmdlParts(originalParts, namedMeasures) {
  const tableName = '_SemanticaGenerated'
  const tablePath = `definition/tables/${tableName}.tmdl`
  const clean     = (namedMeasures || []).filter(m => m && m.name && typeof m.body === 'string' && m.body.trim())
  const newBlocks = clean.map(m => renderMeasureBlock(m.name, m.body, !!m.isRawDax))
  const newNames  = clean.map(m => m.name)
  const existing  = (originalParts || []).find((p) => p.path === tablePath)

  const partitionStub = () => [
    `\tpartition ${tableName}-${uuidv4()} = m`,
    `\t\tmode: import`,
    `\t\tsource =`,
    `\t\t\t\tlet`,
    `\t\t\t\t    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i44FAA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [Column1 = _t]),`,
    `\t\t\t\t    #"Changed Type" = Table.TransformColumnTypes(Source,{{"Column1", type text}}),`,
    `\t\t\t\t    #"Removed Columns" = Table.RemoveColumns(#"Changed Type",{"Column1"})`,
    `\t\t\t\tin`,
    `\t\t\t\t    #"Removed Columns"`,
    ``,
    `\tannotation PBI_ResultType = Table`,
    ``,
  ].join('\n')
  const buildFresh = () => [`table ${tableName}`, `\tlineageTag: ${uuidv4()}`, ``, ...newBlocks, partitionStub()].join('\n')

  // First-ever inject into this report — no table to preserve, build fresh.
  if (!existing) {
    return { parts: [...(originalParts || []), { path: tablePath, content: buildFresh() }], tableName }
  }
  if (newBlocks.length === 0) return { parts: originalParts, tableName }

  const partitionMarker = `\tpartition ${tableName}-`
  const splitIdx = existing.content.indexOf(partitionMarker)
  if (splitIdx < 0) {
    // Malformed file — safer to rebuild than risk corruption.
    const parts = (originalParts || []).map(p => p.path === tablePath ? { ...p, content: buildFresh() } : p)
    return { parts, tableName }
  }
  let beforePartition = existing.content.slice(0, splitIdx)
  const fromPartition = existing.content.slice(splitIdx)
  // Drop only the existing measures whose names collide with the new ones.
  for (const name of newNames) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const blockRe = new RegExp(`\\tmeasure\\s+${esc}\\s*=\\s*\`\`\`[\\s\\S]*?\`\`\`\\s*\\n\\s*\\tlineageTag:\\s*[a-f0-9-]+\\s*\\n+`, 'g')
    beforePartition = beforePartition.replace(blockRe, '')
  }
  const merged = beforePartition.replace(/\s+$/, '') + '\n\n' + newBlocks.join('') + fromPartition
  const parts  = (originalParts || []).map(p => p.path === tablePath ? { ...p, content: merged } : p)
  return { parts, tableName }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Produce the full TMDL file for `_SemanticaGenerated` given an array of
 * { visualId, html } pairs. Includes one measure per pair plus an empty
 * partition so Power BI accepts the table in the model.
 *
 * @returns {{ path: string, content: string, tableName: string, measuresByVisualId: Object<string,string> }}
 */
/**
 * Build the TMDL table with LIVE DAX expressions per visual (not static
 * HTML strings). Used by the cross-filter publish path so measures re-evaluate
 * when Power BI slicers/filters change.
 *
 * @param {Object<string,string>} daxByVisualId — visualId → raw DAX expression
 * @returns {same shape as buildSemanticaGeneratedTable}
 */
export function buildSemanticaGeneratedTableLiveDax(daxByVisualId, secondaryDaxByVisualId = {}, tertiaryDaxByVisualId = {}, tableMeasureListsByVisualId = {}) {
  const tableName = '_SemanticaGenerated'
  const measuresByVisualId = {}
  const secondaryMeasuresByVisualId = {}
  const tertiaryMeasuresByVisualId = {}
  // {visualId: [name0, name1, ...nameN]} — one entry per measure for table visuals
  const tableMeasureNamesByVisualId = {}
  const measureBlocks = []

  for (const [visualId, dax] of Object.entries(daxByVisualId || {})) {
    const name = measureNameForVisual(visualId)
    measuresByVisualId[visualId] = name
    measureBlocks.push(renderMeasureBlock(name, dax, true))
  }
  // Phase 5.3 — secondary/tertiary measures for primitive multi-measure visuals.
  // Same _SemanticaGenerated table, distinct measure names via the _S/_T suffix.
  for (const [visualId, dax] of Object.entries(secondaryDaxByVisualId || {})) {
    const name = secondaryMeasureNameForVisual(visualId)
    secondaryMeasuresByVisualId[visualId] = name
    measureBlocks.push(renderMeasureBlock(name, dax, true))
  }
  for (const [visualId, dax] of Object.entries(tertiaryDaxByVisualId || {})) {
    const name = tertiaryMeasureNameForVisual(visualId)
    tertiaryMeasuresByVisualId[visualId] = name
    measureBlocks.push(renderMeasureBlock(name, dax, true))
  }
  // Table visuals — all N measures bound to the content role (_M0.._MN-1).
  for (const [visualId, daxList] of Object.entries(tableMeasureListsByVisualId || {})) {
    const names = daxList.map((dax, i) => {
      const name = tableMeasureNameForVisual(visualId, i)
      measureBlocks.push(renderMeasureBlock(name, dax, true))
      return name
    })
    tableMeasureNamesByVisualId[visualId] = names
  }

  const partitionStub = [
    `\tpartition ${tableName}-${uuidv4()} = m`,
    `\t\tmode: import`,
    `\t\tsource =`,
    `\t\t\t\tlet`,
    `\t\t\t\t    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i44FAA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [Column1 = _t]),`,
    `\t\t\t\t    #"Changed Type" = Table.TransformColumnTypes(Source,{{"Column1", type text}}),`,
    `\t\t\t\t    #"Removed Columns" = Table.RemoveColumns(#"Changed Type",{"Column1"})`,
    `\t\t\t\tin`,
    `\t\t\t\t    #"Removed Columns"`,
    ``,
    `\tannotation PBI_ResultType = Table`,
    ``,
  ].join('\n')

  const content = [
    `table ${tableName}`,
    `\tlineageTag: ${uuidv4()}`,
    ``,
    ...measureBlocks,
    partitionStub,
  ].join('\n')

  return {
    path: `definition/tables/${tableName}.tmdl`,
    content,
    tableName,
    measuresByVisualId,
    secondaryMeasuresByVisualId,
    tertiaryMeasuresByVisualId,
    tableMeasureNamesByVisualId,
    tooltipMeasuresByVisualId: {},
  }
}

/**
 * Rewrite TMDL parts with live DAX measures (cross-filter mode).
 * Phase 5.3 — accepts optional secondary/tertiary DAX maps for multi-measure
 * primitive visuals; returns parallel measuresByVisualId maps for each role.
 */
export function rewriteTmdlPartsWithLiveDax(originalParts, daxByVisualId, secondaryDaxByVisualId = {}, tertiaryDaxByVisualId = {}, tableMeasureListsByVisualId = {}) {
  const gen = buildSemanticaGeneratedTableLiveDax(daxByVisualId, secondaryDaxByVisualId, tertiaryDaxByVisualId, tableMeasureListsByVisualId)
  const filtered = (originalParts || []).filter((p) => p.path !== gen.path)
  filtered.push({ path: gen.path, content: gen.content })
  return {
    parts:                       filtered,
    measuresByVisualId:          gen.measuresByVisualId,
    secondaryMeasuresByVisualId: gen.secondaryMeasuresByVisualId,
    tertiaryMeasuresByVisualId:  gen.tertiaryMeasuresByVisualId,
    tableMeasureNamesByVisualId: gen.tableMeasureNamesByVisualId,
    tableName:                   gen.tableName,
  }
}

/**
 * MERGE live-DAX measures into the existing _SemanticaGenerated table instead of
 * replacing it (the fix for: publishing a new report wiped the measures that
 * OTHER already-published reports on the same dataset still reference, breaking
 * them with "field not found"). Same signature + return shape as
 * rewriteTmdlPartsWithLiveDax, but every existing measure is preserved — only
 * measures whose names collide with this report's are overwritten (a re-publish
 * of the SAME report updates its own measures; other reports' names never collide
 * because each visual id carries a per-report hash suffix).
 */
export function mergeTmdlPartsWithLiveDax(originalParts, daxByVisualId, secondaryDaxByVisualId = {}, tertiaryDaxByVisualId = {}, tableMeasureListsByVisualId = {}) {
  const measuresByVisualId = {}
  const secondaryMeasuresByVisualId = {}
  const tertiaryMeasuresByVisualId = {}
  const tableMeasureNamesByVisualId = {}
  const named = []

  for (const [visualId, dax] of Object.entries(daxByVisualId || {})) {
    const name = measureNameForVisual(visualId)
    measuresByVisualId[visualId] = name
    named.push({ name, body: dax, isRawDax: true })
  }
  for (const [visualId, dax] of Object.entries(secondaryDaxByVisualId || {})) {
    const name = secondaryMeasureNameForVisual(visualId)
    secondaryMeasuresByVisualId[visualId] = name
    named.push({ name, body: dax, isRawDax: true })
  }
  for (const [visualId, dax] of Object.entries(tertiaryDaxByVisualId || {})) {
    const name = tertiaryMeasureNameForVisual(visualId)
    tertiaryMeasuresByVisualId[visualId] = name
    named.push({ name, body: dax, isRawDax: true })
  }
  for (const [visualId, daxList] of Object.entries(tableMeasureListsByVisualId || {})) {
    const names = (daxList || []).map((dax, i) => {
      const name = tableMeasureNameForVisual(visualId, i)
      named.push({ name, body: dax, isRawDax: true })
      return name
    })
    tableMeasureNamesByVisualId[visualId] = names
  }

  const { parts, tableName } = mergeNamedMeasuresIntoTmdlParts(originalParts, named)
  return {
    parts,
    measuresByVisualId,
    secondaryMeasuresByVisualId,
    tertiaryMeasuresByVisualId,
    tableMeasureNamesByVisualId,
    tableName,
    tooltipMeasuresByVisualId: {},
  }
}

export function buildSemanticaGeneratedTable(htmlByVisualId, tooltipHtmlByVisualId = null) {
  const tableName = '_SemanticaGenerated'
  const measuresByVisualId        = {}
  const tooltipMeasuresByVisualId = {}

  const measureBlocks = []
  for (const [visualId, html] of Object.entries(htmlByVisualId || {})) {
    const name = measureNameForVisual(visualId)
    measuresByVisualId[visualId] = name
    measureBlocks.push(renderMeasureBlock(name, html))
  }

  // Phase 9a — tooltip measures (optional; only when caller provides them)
  if (tooltipHtmlByVisualId) {
    for (const [visualId, tooltipHtml] of Object.entries(tooltipHtmlByVisualId)) {
      if (!tooltipHtml) continue
      const name = tooltipMeasureNameForVisual(visualId)
      tooltipMeasuresByVisualId[visualId] = name
      measureBlocks.push(renderMeasureBlock(name, tooltipHtml))
    }
  }

  // Same base64-compressed empty-table M source that Power BI uses for its
  // auto-generated calc-group stubs. Yields a single-column empty table.
  const partitionStub = [
    `\tpartition ${tableName}-${uuidv4()} = m`,
    `\t\tmode: import`,
    `\t\tsource =`,
    `\t\t\t\tlet`,
    `\t\t\t\t    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i44FAA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [Column1 = _t]),`,
    `\t\t\t\t    #"Changed Type" = Table.TransformColumnTypes(Source,{{"Column1", type text}}),`,
    `\t\t\t\t    #"Removed Columns" = Table.RemoveColumns(#"Changed Type",{"Column1"})`,
    `\t\t\t\tin`,
    `\t\t\t\t    #"Removed Columns"`,
    ``,
    `\tannotation PBI_ResultType = Table`,
    ``,
  ].join('\n')

  const content = [
    `table ${tableName}`,
    `\tlineageTag: ${uuidv4()}`,
    ``,
    ...measureBlocks,
    partitionStub,
  ].join('\n')

  return {
    path:    `definition/tables/${tableName}.tmdl`,
    content,
    tableName,
    measuresByVisualId,
    tooltipMeasuresByVisualId,
  }
}

/**
 * Rewrite a TMDL parts array to include the freshly-built
 * _SemanticaGenerated.tmdl — replacing any previous version.
 *
 * @param {Array<{path,content}>} originalParts — from pbismGetDefinition
 * @param {Object<string,string>} htmlByVisualId — visualId -> HTML string
 * @returns {{ parts: Array, measuresByVisualId: Object, tableName: string }}
 */
export function rewriteTmdlPartsWithSemanticaTable(originalParts, htmlByVisualId, tooltipHtmlByVisualId = null) {
  const gen = buildSemanticaGeneratedTable(htmlByVisualId, tooltipHtmlByVisualId)

  // Replace or append. All other parts pass through verbatim.
  const filtered = (originalParts || []).filter((p) => p.path !== gen.path)
  filtered.push({ path: gen.path, content: gen.content })

  return {
    parts:                     filtered,
    measuresByVisualId:        gen.measuresByVisualId,
    tooltipMeasuresByVisualId: gen.tooltipMeasuresByVisualId,
    tableName:                 gen.tableName,
  }
}

/**
 * MERGE the HTML-string _SemanticaGenerated measures into the existing table
 * instead of replacing it — same retain-other-reports fix as
 * mergeTmdlPartsWithLiveDax, for the HTML-content publish path.
 */
export function mergeTmdlPartsWithSemanticaTable(originalParts, htmlByVisualId, tooltipHtmlByVisualId = null) {
  const measuresByVisualId = {}
  const tooltipMeasuresByVisualId = {}
  const named = []
  for (const [visualId, html] of Object.entries(htmlByVisualId || {})) {
    const name = measureNameForVisual(visualId)
    measuresByVisualId[visualId] = name
    named.push({ name, body: html, isRawDax: false })
  }
  if (tooltipHtmlByVisualId) {
    for (const [visualId, tooltipHtml] of Object.entries(tooltipHtmlByVisualId)) {
      if (!tooltipHtml) continue
      const name = tooltipMeasureNameForVisual(visualId)
      tooltipMeasuresByVisualId[visualId] = name
      named.push({ name, body: tooltipHtml, isRawDax: false })
    }
  }
  const { parts, tableName } = mergeNamedMeasuresIntoTmdlParts(originalParts, named)
  return { parts, measuresByVisualId, tooltipMeasuresByVisualId, tableName }
}

/**
 * Inject mode (PBI Injector): MERGE new measures into an existing
 * _SemanticaGenerated table instead of replacing it. Preserves any
 * measures already in the dataset from prior injects/publishes.
 *
 * If the table doesn't exist yet, falls back to full create.
 * If a new measure name collides with an existing one, the existing
 * block is removed (overwrite semantics).
 */
export function appendMeasuresToTmdlParts(originalParts, htmlByVisualId) {
  const tableName = '_SemanticaGenerated'
  const tablePath = `definition/tables/${tableName}.tmdl`
  const existing  = (originalParts || []).find((p) => p.path === tablePath)

  // No existing table → full create path
  if (!existing) {
    return rewriteTmdlPartsWithSemanticaTable(originalParts, htmlByVisualId)
  }

  // Build new measure blocks
  const measuresByVisualId = {}
  const newBlocks = []
  for (const [visualId, html] of Object.entries(htmlByVisualId || {})) {
    const name = measureNameForVisual(visualId)
    measuresByVisualId[visualId] = name
    newBlocks.push(renderMeasureBlock(name, html))
  }
  if (newBlocks.length === 0) {
    return { parts: originalParts, measuresByVisualId, tableName }
  }

  // Split existing TMDL at the partition stub.
  // Everything before = table header + existing measures.
  // Everything from partition onward = partition + annotations (preserved as-is).
  const partitionMarker = `\tpartition ${tableName}-`
  const splitIdx = existing.content.indexOf(partitionMarker)
  if (splitIdx < 0) {
    // Malformed file — safer to fall back to full rebuild than risk corruption.
    console.warn('[appendMeasuresToTmdlParts] partition marker not found, rebuilding _SemanticaGenerated.tmdl')
    return rewriteTmdlPartsWithSemanticaTable(originalParts, htmlByVisualId)
  }
  let beforePartition = existing.content.slice(0, splitIdx)
  const fromPartition = existing.content.slice(splitIdx)

  // Overwrite semantics: drop any existing measure whose name matches a new one.
  const newNames = new Set(Object.values(measuresByVisualId))
  for (const name of newNames) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match the full block we emit in renderMeasureBlock: opening header,
    // multi-line body, closing ```, indented lineageTag, trailing blank line.
    const blockRe = new RegExp(
      `\\tmeasure\\s+${esc}\\s*=\\s*\`\`\`[\\s\\S]*?\`\`\`\\s*\\n\\s*\\tlineageTag:\\s*[a-f0-9-]+\\s*\\n+`,
      'g',
    )
    beforePartition = beforePartition.replace(blockRe, '')
  }

  // Stitch: existing-prefix + new measure blocks + partition stub
  const merged = beforePartition.replace(/\s+$/, '') + '\n\n' + newBlocks.join('') + fromPartition

  const updatedParts = originalParts.map((p) =>
    p.path === tablePath ? { ...p, content: merged } : p,
  )
  return { parts: updatedParts, measuresByVisualId, tableName }
}
