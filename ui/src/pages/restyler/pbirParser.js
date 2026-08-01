/**
 * PBIR + PBIR-Legacy parser.
 *
 * Takes the raw `parts[]` returned by Fabric `getDefinition` and produces a
 * normalized structure that both formats can be audited and restyled through:
 *
 *   {
 *     format:     'PBIR' | 'PBIR-Legacy',
 *     version:    '1.0' | '4.0' | …,
 *     reportLevel: { theme, settings, themeCollection },
 *     pages: [
 *       {
 *         id:        'ReportSection',
 *         name:      'Overview',
 *         displayName: 'Overview',
 *         width, height, displayOption,
 *         page_objects:           {...}      // page-level objects (page.json / sections[].config.objects)
 *         visuals: [
 *           {
 *             id:                    'visual_xxx',
 *             visualType:            'barChart',
 *             position:              { x, y, z, width, height, tabOrder },
 *             objects:               {...}   // data-bound (visual.objects / singleVisual.objects)
 *             visualContainerObjects:{...}   // chrome (visual.visualContainerObjects / singleVisual.vcObjects)
 *             fields:                {       // best-effort field extraction
 *                                     category: [{ table, column, displayName }],
 *                                     values:   [{ table, measure, displayName }],
 *                                     series:   [...],
 *                                     y, y2, x: [...]
 *                                    },
 *             rawPath:               'definition/pages/.../visual.json'
 *                                    OR 'report.json#sections[i].visualContainers[j]'
 *           }
 *         ]
 *       }
 *     ],
 *     resources: [...],     // StaticResources/RegisteredResources entries (passed through)
 *     bookmarks: [...],     // bookmark structures (PBIR only — legacy bookmarks live in config)
 *     unparsedParts: [...]  // anything we didn't recognize — preserved for round-trip
 *   }
 *
 * Sources: Doc 3 (most authoritative on legacy ↔ PBIR translation table),
 *          Microsoft Learn PBIR docs, Deneb PBIR Implementation Guide.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeJsonParse(s, fallback = null) {
  if (typeof s !== 'string' || !s.trim()) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}

function findPart(parts, predicate) {
  return (parts || []).find(p => predicate(p))
}

function findPartByPath(parts, exactPath) {
  return findPart(parts, p => p.path === exactPath)
}

function findPartsByPathPrefix(parts, prefix) {
  return (parts || []).filter(p => p.path?.startsWith(prefix))
}

function findPartsByPathSuffix(parts, suffix) {
  return (parts || []).filter(p => p.path?.endsWith(suffix))
}

// ── Format detection ─────────────────────────────────────────────────────────

/**
 * Decide whether this set of parts is PBIR or PBIR-Legacy.
 *
 * PBIR-Legacy:
 *   - has `report.json` at root (or near root)
 *   - `definition.pbir` has version "1.0"
 *
 * PBIR:
 *   - has `definition/report.json` and many `definition/pages/.../*.json` files
 *   - `definition.pbir` has version "4.0+"
 */
export function detectFormat(parts) {
  const definitionPbir = findPartByPath(parts, 'definition.pbir')
                       || findPart(parts, p => p.path?.endsWith('.pbir'))
                       || findPart(parts, p => p.path === '.pbir')
  let version = null
  if (definitionPbir) {
    const obj = safeJsonParse(definitionPbir.content)
    version = obj?.version || obj?.fileFormatVersion || null
  }

  // Modern PBIR signature: definition/pages/ subtree
  const hasPbirPages = parts.some(p => /^definition\/pages\/[^/]+\/page\.json$/.test(p.path || ''))
  if (hasPbirPages) {
    return { format: 'PBIR', version: version || '4.0' }
  }

  // Legacy: a top-level report.json
  const legacyReportJson = findPartByPath(parts, 'report.json')
                         || findPart(parts, p => p.path?.endsWith('/report.json') && !p.path?.includes('definition/'))
  if (legacyReportJson) {
    return { format: 'PBIR-Legacy', version: version || '1.0' }
  }

  // Definition root might also indicate PBIR even without page subtree
  const pbirRoot = findPartByPath(parts, 'definition/report.json')
  if (pbirRoot) {
    return { format: 'PBIR', version: version || '4.0' }
  }

  return { format: 'unknown', version }
}

// ── PBIR-Legacy parser ───────────────────────────────────────────────────────

function parseLegacy(parts) {
  // Find the main report.json. Prefer exact root match.
  const reportPart = findPartByPath(parts, 'report.json')
                  || findPart(parts, p => p.path?.endsWith('/report.json') && !p.path.includes('definition/'))
  if (!reportPart) {
    return { format: 'PBIR-Legacy', error: 'report.json not found in parts', pages: [] }
  }

  const report = safeJsonParse(reportPart.content)
  if (!report) {
    return { format: 'PBIR-Legacy', error: 'report.json is not valid JSON', pages: [] }
  }

  // Report-level config is itself a string — parse if present
  const reportConfig = safeJsonParse(report.config) || {}
  const reportLevel = {
    theme:           reportConfig.theme           || null,
    themeCollection: reportConfig.themeCollection || null,
    settings:        reportConfig.settings        || null,
    objects:         reportConfig.objects         || null,
    activeSectionIndex: report.activeSectionIndex,
    layoutOptimization: report.layoutOptimization,
  }

  // Parse pages (sections[])
  const pages = []
  for (const section of (report.sections || [])) {
    const pageConfig = safeJsonParse(section.config) || {}
    const pageVisuals = []

    for (const vc of (section.visualContainers || [])) {
      const vcConfig = safeJsonParse(vc.config) || {}
      const sv  = vcConfig.singleVisual || vcConfig.singleVisualGroup || null
      if (!sv) continue   // skip group containers we can't introspect

      // Position: prefer outer fields, fall back to inner layouts[0].position
      const innerPos = vcConfig.layouts?.[0]?.position || {}
      const position = {
        x:        Number(vc.x        ?? innerPos.x        ?? 0),
        y:        Number(vc.y        ?? innerPos.y        ?? 0),
        z:        Number(vc.z        ?? innerPos.z        ?? 0),
        width:    Number(vc.width    ?? innerPos.width    ?? 0),
        height:   Number(vc.height   ?? innerPos.height   ?? 0),
        tabOrder: Number(vc.tabOrder ?? innerPos.tabOrder ?? 0),
      }

      // Field extraction from projections
      const fields = extractFieldsFromLegacy(sv, vc)

      pageVisuals.push({
        id:                     vcConfig.name || `visual_${pageVisuals.length}`,
        visualType:             sv.visualType || 'unknown',
        position,
        objects:                sv.objects   || {},
        visualContainerObjects: sv.vcObjects || {},
        fields,
        rawPath:                `report.json#sections[${pages.length}].visualContainers[${pageVisuals.length}]`,
        _isGroup:               !!vcConfig.singleVisualGroup,
      })
    }

    pages.push({
      id:           section.name || `section_${pages.length}`,
      name:         section.displayName || section.name || `Page ${pages.length + 1}`,
      displayName:  section.displayName || section.name,
      width:        Number(section.width)  || null,
      height:       Number(section.height) || null,
      displayOption: section.displayOption,
      page_objects: pageConfig.objects || null,
      visuals:      pageVisuals,
    })
  }

  // Resources are passed through unchanged
  const resources = parts.filter(p => p.path?.startsWith('StaticResources/')).map(p => ({
    path:    p.path,
    content: p.content,
  }))

  // Anything else we don't classify
  const recognized = new Set([reportPart.path, 'definition.pbir', '.platform'])
  const unparsedParts = parts.filter(p => !recognized.has(p.path) && !p.path?.startsWith('StaticResources/'))

  return {
    format: 'PBIR-Legacy',
    reportLevel,
    pages,
    resources,
    unparsedParts,
    sourceParts: parts,
    sourceReportPath: reportPart.path,
  }
}

function extractFieldsFromLegacy(sv, vc) {
  // Projections are role → array of {queryRef}
  // Resolution to {table, column} requires the prototypeQuery From clause.
  const projections = sv.projections || {}
  const proto       = sv.prototypeQuery || safeJsonParse(vc.query) || {}
  const fromMap = {}
  for (const f of (proto.From || [])) {
    fromMap[f.Name] = f.Entity
  }
  const selectByName = {}
  for (const s of (proto.Select || [])) {
    selectByName[s.Name] = s
  }

  const out = {}
  for (const [role, entries] of Object.entries(projections)) {
    out[role] = []
    for (const entry of entries) {
      const ref = entry.queryRef || entry?.field?.Column?.Property
      const sel = selectByName[ref]
      if (sel?.Column) {
        const src   = sel.Column.Expression?.SourceRef?.Source
        out[role].push({ kind: 'column',  table: fromMap[src] || src, column: sel.Column.Property, displayName: sel.NativeReferenceName || sel.Column.Property })
      } else if (sel?.Measure) {
        const src   = sel.Measure.Expression?.SourceRef?.Source
        out[role].push({ kind: 'measure', table: fromMap[src] || src, measure: sel.Measure.Property, displayName: sel.NativeReferenceName || sel.Measure.Property })
      } else if (typeof ref === 'string') {
        // Fall back: split "Table.Column" if possible
        const m = ref.match(/^(.+)\.(.+)$/)
        if (m) out[role].push({ kind: 'unknown', table: m[1], column: m[2], displayName: m[2] })
        else   out[role].push({ kind: 'unknown', queryRef: ref })
      }
    }
  }
  return out
}

// ── Modern PBIR parser ───────────────────────────────────────────────────────

function parsePbir(parts) {
  const reportJsonPart = findPartByPath(parts, 'definition/report.json')
                      || findPart(parts, p => /^definition\/report\.json$/.test(p.path || ''))
  const report = reportJsonPart ? safeJsonParse(reportJsonPart.content) : null

  const reportLevel = {
    theme:           report?.theme           || null,
    themeCollection: report?.themeCollection || null,
    settings:        report?.settings        || null,
    objects:         report?.objects         || null,
  }

  // Page order
  const pagesJson = findPartByPath(parts, 'definition/pages/pages.json')
  const pageOrder = safeJsonParse(pagesJson?.content)?.pageOrder || []

  // Discover all page directories
  const pagePartRegex = /^definition\/pages\/([^/]+)\/page\.json$/
  const pageNames = []
  for (const p of parts) {
    const m = p.path?.match(pagePartRegex)
    if (m) pageNames.push(m[1])
  }
  // Order: respect pageOrder if present, otherwise discovery order
  const orderedPageNames = pageOrder.length
    ? [...pageOrder].filter(n => pageNames.includes(n)).concat(pageNames.filter(n => !pageOrder.includes(n)))
    : pageNames

  const pages = []
  for (const pageName of orderedPageNames) {
    const pageJsonPart = findPartByPath(parts, `definition/pages/${pageName}/page.json`)
    const pageJson = safeJsonParse(pageJsonPart?.content) || {}

    // Find every visual.json under this page
    const visualsPrefix = `definition/pages/${pageName}/visuals/`
    const visualParts = parts.filter(p =>
      p.path?.startsWith(visualsPrefix) && p.path.endsWith('/visual.json')
    )

    const pageVisuals = []
    for (const vp of visualParts) {
      const visualJson = safeJsonParse(vp.content)
      if (!visualJson) continue
      const v = visualJson.visual || {}
      const position = visualJson.position || {}

      const fields = extractFieldsFromPbir(v)

      pageVisuals.push({
        id:                     visualJson.name || `visual_${pageVisuals.length}`,
        visualType:             v.visualType || 'unknown',
        position: {
          x:        Number(position.x)        || 0,
          y:        Number(position.y)        || 0,
          z:        Number(position.z)        || 0,
          width:    Number(position.width)    || 0,
          height:   Number(position.height)   || 0,
          tabOrder: Number(position.tabOrder) || 0,
        },
        objects:                v.objects                || {},
        visualContainerObjects: v.visualContainerObjects || {},
        fields,
        rawPath:                vp.path,
        howCreated:             visualJson.howCreated,
        isHiddenInViewMode:     !!visualJson.isHiddenInViewMode,
      })
    }

    pages.push({
      id:            pageName,
      name:          pageJson.displayName || pageName,
      displayName:   pageJson.displayName,
      width:         Number(pageJson.width)  || null,
      height:        Number(pageJson.height) || null,
      displayOption: pageJson.displayOption,
      page_objects:  pageJson.objects || null,
      visuals:       pageVisuals,
    })
  }

  // Bookmarks
  const bookmarkParts = findPartsByPathSuffix(parts, '.bookmark.json')
  const bookmarks = bookmarkParts.map(bp => ({
    path: bp.path,
    bookmark: safeJsonParse(bp.content),
  }))

  const resources = parts.filter(p => p.path?.startsWith('StaticResources/')).map(p => ({
    path:    p.path,
    content: p.content,
  }))

  // Anything we didn't recognize
  const recognized = new Set([
    'definition.pbir', '.platform', 'definition/report.json',
    'definition/pages/pages.json', 'definition/version.json',
    'definition/reportExtensions.json', 'definition/bookmarks/bookmarks.json',
    reportJsonPart?.path,
  ])
  const unparsedParts = parts.filter(p =>
    !recognized.has(p.path)
    && !p.path?.startsWith('StaticResources/')
    && !pagePartRegex.test(p.path || '')
    && !p.path?.includes('/visuals/') && !p.path?.endsWith('/visual.json')
    && !p.path?.endsWith('.bookmark.json')
  )

  return {
    format: 'PBIR',
    reportLevel,
    pages,
    resources,
    bookmarks,
    unparsedParts,
    sourceParts: parts,
  }
}

function extractFieldsFromPbir(v) {
  const queryState = v?.query?.queryState || {}
  const out = {}
  for (const [role, def] of Object.entries(queryState)) {
    out[role] = []
    for (const proj of (def.projections || [])) {
      const f = proj.field
      if (f?.Column) {
        out[role].push({
          kind: 'column',
          table:  f.Column.Expression?.SourceRef?.Entity,
          column: f.Column.Property,
          displayName: proj.queryRef || f.Column.Property,
        })
      } else if (f?.Measure) {
        out[role].push({
          kind: 'measure',
          table:   f.Measure.Expression?.SourceRef?.Entity,
          measure: f.Measure.Property,
          displayName: proj.queryRef || f.Measure.Property,
        })
      } else if (proj.queryRef) {
        const m = proj.queryRef.match(/^(.+)\.(.+)$/)
        if (m) out[role].push({ kind: 'unknown', table: m[1], column: m[2], displayName: m[2] })
      }
    }
  }
  return out
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Parse the result of Fabric `getDefinition` into a normalized report object.
 *
 *   parsePbir(parts)  →  { format, reportLevel, pages: [...], resources, ... }
 *
 * Always returns an object with `format` set, even if parsing fails; check
 * `result.error` for failure.
 */
export function parseReportDefinition(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { format: 'unknown', error: 'No parts provided', pages: [] }
  }
  const detected = detectFormat(parts)
  try {
    if (detected.format === 'PBIR-Legacy') {
      return { ...parseLegacy(parts), version: detected.version }
    }
    if (detected.format === 'PBIR') {
      return { ...parsePbir(parts), version: detected.version }
    }
    return { format: 'unknown', version: detected.version, error: 'Format not detected', pages: [] }
  } catch (err) {
    return { format: detected.format, error: err.message, pages: [], stack: err.stack }
  }
}

// ── Quick summary for UI ─────────────────────────────────────────────────────

/**
 * Compact summary for display in the audit screen header.
 */
export function summarize(parsed) {
  if (!parsed) return null
  const totalVisuals = (parsed.pages || []).reduce((n, p) => n + (p.visuals?.length || 0), 0)
  const visualTypes  = {}
  for (const p of parsed.pages || []) {
    for (const v of p.visuals || []) {
      visualTypes[v.visualType] = (visualTypes[v.visualType] || 0) + 1
    }
  }
  // Top-3 visual types by count
  const top3 = Object.entries(visualTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => ({ type: t, count: n }))

  return {
    format:         parsed.format,
    pageCount:      parsed.pages?.length || 0,
    totalVisuals,
    top3VisualTypes: top3,
    resourceCount:  parsed.resources?.length || 0,
    hasTheme:       !!parsed.reportLevel?.themeCollection,
    error:          parsed.error || null,
  }
}
