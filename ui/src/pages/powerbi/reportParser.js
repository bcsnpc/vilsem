/**
 * reportParser — turn a Fabric Items API parts array into the editor's
 * page/visual model.
 *
 * Input: parts from window.semantica.pbiGetReportDefinitionV2
 *   [{ path: 'report.json',     content: '{...}' },
 *    { path: 'definition.pbir', content: '{...}' },
 *    { path: '.platform',       content: '{...}' }]
 *
 * The PBIR-Legacy format puts the entire report in a single `report.json`
 * containing `sections[].visualContainers[]`. Each `config` field is a
 * JSON-encoded string we have to double-parse to get to `singleVisual`.
 *
 * The modern PBIR format spreads pages and visuals across many files
 * (`definition/pages/{name}/page.json`, `.../visuals/{id}/visual.json`).
 * The parser handles both shapes so it doesn't matter which format the
 * tenant returns.
 *
 * Always returns an object — never throws.
 */

/**
 * @param {Array<{path:string, content:string}>} parts
 * @returns {{ pages: object[], datasetId: string|null, format: 'pbir'|'legacy', parts: any[], error?: string }}
 */
export function parseReportParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { pages: [], datasetId: null, format: 'pbir', parts: [], error: 'No parts provided' }
  }

  // Pull out the dataset id from definition.pbir if present
  const datasetId = extractDatasetId(parts)

  // ── MODERN PBIR FIRST ──────────────────────────────────────────────
  // Look for any part matching: definition/pages/<dir>/page.json
  // (the .Report folder layout used by Power BI Desktop / Fabric API).
  const hasModernPages = parts.some((p) =>
    /\/?definition\/pages\/[^/]+\/page\.json$/i.test(p.path)
  )

  if (hasModernPages) {
    const modernPages = parseModernPbir(parts)
    if (modernPages.length > 0) {
      return { pages: modernPages, datasetId, format: 'pbir', parts }
    }
    // Fell through — modern detected but produced nothing usable
  }

  // ── LEGACY FALLBACK ───────────────────────────────────────────────
  // Single report.json (or definition/report.json) containing sections[]
  // with inline visualContainers — the old in-zip Layout schema.
  const legacyEntry = parts.find((p) => isLegacyReportJsonPath(p.path))
  if (legacyEntry) {
    const layout = safeParse(legacyEntry.content)
    if (layout && Array.isArray(layout.sections) && layout.sections.length > 0) {
      const pages = layout.sections.map((s, i) => sectionToPage(s, i))
      return { pages, datasetId, format: 'legacy', parts }
    }
  }

  return {
    pages: [],
    datasetId,
    format: hasModernPages ? 'pbir' : 'legacy',
    parts,
    error: hasModernPages
      ? 'Modern PBIR detected but page parsing produced no pages'
      : legacyEntry
        ? 'report.json had no sections'
        : 'No report.json or definition/pages/*/page.json found in parts',
  }
}

// ── PBIR-Legacy: section → page ─────────────────────────────────────────────

function sectionToPage(section, idx) {
  const cfg        = safeParse(section?.config) || {}
  const background = extractBackgroundColor(cfg) || '#0F1117'

  const visuals = Array.isArray(section?.visualContainers)
    ? section.visualContainers.map((vc, i) => containerToVisual(vc, i)).filter(Boolean)
    : []

  return {
    id:          section?.name || `section-${idx}`,
    name:        section?.displayName || section?.name || `Page ${idx + 1}`,
    displayName: section?.displayName || section?.name || `Page ${idx + 1}`,
    width:       Number(section?.width)  || 1280,
    height:      Number(section?.height) || 720,
    background,
    visuals,
    settings: {
      hideHeaders: true,
      hideNav:     false,
      gridlines:   false,
    },
  }
}

function containerToVisual(vc, idx) {
  if (!vc) return null
  const cfg = safeParse(vc?.config) || {}

  const visualType = cfg?.singleVisual?.visualType || 'unknown'
  const id         = cfg?.name || vc?.name || `visual-${idx}`
  const layoutPos  = cfg?.layouts?.[0]?.position || {}

  return {
    id,
    type:        visualType,
    title:       cfg?.singleVisual?.title || '',
    x:           num(vc?.x ?? layoutPos.x, 0),
    y:           num(vc?.y ?? layoutPos.y, 0),
    width:       num(vc?.width  ?? layoutPos.width,  400),
    height:      num(vc?.height ?? layoutPos.height, 300),
    z:           num(vc?.z ?? layoutPos.z, 0),
    isSemantica: visualType === 'htmlContent' || visualType === 'org.semantica.renderer',
  }
}

// ── Modern PBIR: walk per-page hierarchy ────────────────────────────────────

function parseModernPbir(parts) {
  // 1. Find every page.json — definition/pages/{dir}/page.json
  const pageEntries = parts.filter((p) =>
    /\/?definition\/pages\/[^/]+\/page\.json$/i.test(p.path)
  )
  if (pageEntries.length === 0) return []

  // 2. Optional pages.json — gives us the canonical pageOrder + activePage
  const pagesMetaEntry = parts.find((p) => /\/?definition\/pages\/pages\.json$/i.test(p.path))
  const pagesMeta      = pagesMetaEntry ? safeParse(pagesMetaEntry.content) : null
  const orderHint      = Array.isArray(pagesMeta?.pageOrder) ? pagesMeta.pageOrder : null

  // 3. Optional definition/report.json — gives us the canvas defaults (theme, settings)
  //    We don't pull width/height from here; per-page.json wins.
  //    (Reserved for future use — currently we just ignore it.)

  // 4. Build pageDir → page object map
  const pageMap = new Map()
  for (const entry of pageEntries) {
    const dir  = entry.path.replace(/\/page\.json$/i, '')
    const raw  = safeParse(entry.content) || {}
    pageMap.set(dir, { raw, dir, visuals: [] })
  }

  // 5. Walk every visual.json and assign it to its parent page dir
  for (const part of parts) {
    const m = part.path.match(/(\/?definition\/pages\/[^/]+)\/visuals\/[^/]+\/visual\.json$/i)
    if (!m) continue
    const dir    = m[1]
    const target = pageMap.get(dir)
    if (!target) continue
    const v = safeParse(part.content) || {}
    target.visuals.push(modernVisualToVisual(v))
  }

  // 6. Sort visuals within each page by visualContainerOrder if present,
  //    falling back to z-index, then to position.tabOrder.
  for (const page of pageMap.values()) {
    const orderHint = Array.isArray(page.raw?.visualContainerOrder)
      ? page.raw.visualContainerOrder
      : null
    if (orderHint && orderHint.length > 0) {
      const idxOf = (name) => {
        const i = orderHint.indexOf(name)
        return i === -1 ? Number.MAX_SAFE_INTEGER : i
      }
      page.visuals.sort((a, b) => idxOf(a.id) - idxOf(b.id))
    } else {
      page.visuals.sort((a, b) => (a.z || 0) - (b.z || 0))
    }
  }

  // 7. Compose final pages array — sort by ordinal first, then apply orderHint
  //    (pages.json::pageOrder takes precedence when present).
  let ordered = []

  if (orderHint) {
    for (const name of orderHint) {
      const found = [...pageMap.values()].find(
        (p) => (p.raw?.name || p.dir.split('/').pop()) === name
      )
      if (found) ordered.push(found)
    }
    // Append any pages not mentioned in pageOrder
    for (const p of pageMap.values()) {
      if (!ordered.includes(p)) ordered.push(p)
    }
  } else {
    ordered = [...pageMap.values()].sort((a, b) => {
      const oa = num(a.raw?.ordinal, Number.MAX_SAFE_INTEGER)
      const ob = num(b.raw?.ordinal, Number.MAX_SAFE_INTEGER)
      return oa - ob
    })
  }

  return ordered.map((p, idx) => modernPageToPage(p, idx))
}

function modernPageToPage(p, idx) {
  const raw = p.raw || {}
  const background = extractBackgroundFromObjects(raw?.objects) || '#0F1117'
  return {
    id:          raw.name || p.dir.split('/').pop() || `page-${idx}`,
    name:        raw.displayName || raw.name || `Page ${idx + 1}`,
    displayName: raw.displayName || raw.name || `Page ${idx + 1}`,
    width:       Number(raw.width)  || 1280,
    height:      Number(raw.height) || 720,
    background,
    ordinal:     num(raw.ordinal, idx),
    visuals:     p.visuals || [],
    settings: {
      hideHeaders: true,
      hideNav:     false,
      gridlines:   false,
    },
  }
}

function modernVisualToVisual(v) {
  // Modern PBIR visual.json schema:
  //   { name, position: {x,y,z,width,height,tabOrder}, visual: { visualType, query, ... } }
  const visualType = v?.visual?.visualType || v?.visualType || 'unknown'
  return {
    id:    v?.name || `visual-${Math.random().toString(36).slice(2, 8)}`,
    type:  visualType,
    title: '',
    x:     num(v?.position?.x, 0),
    y:     num(v?.position?.y, 0),
    width: num(v?.position?.width,  400),
    height:num(v?.position?.height, 300),
    z:     num(v?.position?.z, 0),
    isSemantica: visualType === 'htmlContent' || visualType === 'org.semantica.renderer',
  }
}

function extractBackgroundFromObjects(objects) {
  if (!objects) return null
  try {
    const bgArr = objects.background || objects.wallpaper
    const lit   = bgArr?.[0]?.properties?.color?.solid?.color?.expr?.Literal?.Value
    if (typeof lit === 'string') return lit.replace(/^'(.*)'$/, '$1')
  } catch { /* ignore */ }
  return null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isLegacyReportJsonPath(path) {
  if (!path) return false
  // Match either bare report.json or definition/report.json (PBIR-Legacy returns the bare one).
  // Exclude any nested report.json buried inside a page directory.
  return /(^|\/)report\.json$/i.test(path) && !/\/pages\/.*\/report\.json$/i.test(path)
}

function extractDatasetId(parts) {
  const pbirEntry = parts.find((p) => /(^|\/)definition\.pbir$/i.test(p.path))
  if (!pbirEntry) return null
  const pbir = safeParse(pbirEntry.content) || {}
  const byConn = pbir?.datasetReference?.byConnection || {}
  return byConn.pbiModelDatabaseName || byConn.pbiServiceModelId || null
}

function extractBackgroundColor(pageConfig) {
  try {
    const objects = pageConfig?.objects || pageConfig?.singlePage?.objects || {}
    const bgArr   = objects?.background || objects?.wallpaper
    const lit     = bgArr?.[0]?.properties?.color?.solid?.color?.expr?.Literal?.Value
    if (typeof lit === 'string') {
      // Power BI literals are wrapped in quotes: "'#0F1117'"
      return lit.replace(/^'(.*)'$/, '$1')
    }
  } catch { /* ignore */ }
  return null
}

function safeParse(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  try { return JSON.parse(text) } catch { return null }
}

function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
