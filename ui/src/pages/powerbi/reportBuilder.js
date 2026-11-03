/**
 * reportBuilder — produce a parts array in MODERN PBIR format
 * (the per-page/per-visual hierarchical layout Power BI Desktop uses).
 *
 * Output goes through pbiUpdateReportDefinition or pbiCreateReport. Each part
 * is { path, content } where content is a UTF-8 JSON string; the IPC handler
 * base64-encodes each one before sending.
 *
 * MODERN PBIR FILE LAYOUT
 * ───────────────────────
 *   .platform                                                — Fabric metadata
 *   definition.pbir                                          — datasetReference
 *   definition/version.json                                  — { version: "2.0.0" }
 *   definition/report.json                                   — theme, settings, publicCustomVisuals
 *   definition/pages/pages.json                              — { pageOrder, activePageName }
 *   definition/pages/{pageDir}/page.json                     — page-level config
 *   definition/pages/{pageDir}/visuals/{visualId}/visual.json — one file per visual
 *
 * Visual schema (modern PBIR):
 *   {
 *     name, position: {x,y,z,width,height,tabOrder},
 *     visual: {
 *       visualType,
 *       query: { queryState: { <Role>: { projections: [{field, queryRef, active}] } } },
 *       drillFilterOtherVisuals,
 *       vcObjects: { title, visualHeader }
 *     }
 *   }
 *
 * Differences from PBIR-Legacy this file used to write:
 *   • No more nested config strings — every value lives at its real path
 *   • SourceRef.Entity instead of SourceRef.Source alias
 *   • Custom visuals are declared in report.json's `publicCustomVisuals` array,
 *     NOT in resourcePackages (resourcePackages is for themes/images in modern PBIR)
 *   • Each visual is its own file under visuals/{id}/visual.json
 */

import { renderVisualToHtml } from './htmlTemplates/index.js'

// ── Schema URLs ─────────────────────────────────────────────────────────────

const SCHEMA = {
  // Back to 2.7.0 — 2.8.0 URL does not resolve as of 2026-04-15 (per codex
  // research). Power BI accepts both in the runtime, but 2.7.0 is the one
  // whose schema JSON is actually served by developer.microsoft.com right now.
  visual:    'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json',
  page:      'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
  pagesMeta: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json',
  report:    'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.2.0/schema.json',
  version:   'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json',
  pbir:      'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
  platform:  'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
}

// ─── vilsem Renderer custom visual — EMBEDDED per report ─────────────────
//
// Changed approach (2026-04-11): we now EMBED the .pbiviz binary directly in
// every published PBIR report instead of relying on the tenant's organizational
// visual library. Reason: Fabric Items API import path didn't reliably resolve
// org-library visuals ("This visual is no longer available" errors despite
// correct visualType/publicCustomVisuals/resourcePackages). Embedding removes
// the tenant dependency — every report is self-contained.
//
// Changes from the org-library approach:
//   • visualType uses the BASE GUID (no `_OrgStore` suffix) — private/embedded
//     visuals don't get the suffix
//   • publicCustomVisuals registers the base GUID
//   • resourcePackages includes a `RegisteredResources` entry (NOT `Organizational
//     StoreCustomVisual`) pointing to `definition/customVisuals/<guid>/package.pbiviz`
//   • The .pbiviz binary is added as a PBIR part: `definition/customVisuals/
//     <guid>/package.pbiviz` with InlineBase64 payload
//
// The actual GUID + base64 bytes are passed in via buildReportParts({ pbiviz })
// — the caller reads them from IPC `pbiGetBundledPbiviz()` at publish time.
// Reverted to vilsem Renderer org-library path after confirming the
// HTML Content visual pivot would require XMLA dataset mutation (PBIR schema
// doesn't support inline visual-level calcs). Org-library renders correctly
// in edit mode; view-mode-after-save behaves inconsistently on Fabric Trial
// (see session notes — tenant-side SKU limitation, not a code issue).
const SEMANTICA_VISUAL_GUID = 'semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
const SEMANTICA_VISUAL_RESOURCE_TYPE = 'OrganizationalStoreCustomVisual'

function orgStoreName(guid) { return `${guid}_OrgStore` }

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * @param {Object} args
 * @param {Array<{path:string,content:string}>|null} args.originalParts
 * @param {Array}  args.pages
 * @param {string} args.datasetId
 * @param {string} args.reportName
 * @param {string} [args.workspaceName] — display name, used to construct connectionString
 * @param {string} [args.datasetName]   — display name, used to construct connectionString
 * @param {'single'|'fullpage'|'multipage'} args.injectionScope
 * @param {'htmlcontent'|'semantica'} args.renderer
 * @param {Array<{name:string,table:string}>} [args.measuresList]
 * @returns {Array<{path:string,content:string}>}
 */
export function buildReportParts({
  originalParts,
  pages,
  datasetId,
  reportName,
  workspaceName,
  datasetName,
  injectionScope,
  renderer,
  measuresList = [],
  visualDataMap = null,    // Phase D — pre-fetched data per visual id
  canvasTheme = 'dark',    // Phase D — theme used for HTML render
  pbiviz = null,           // Embedded custom visual: { guid, base64, filename, version }
}) {
  const measureTableLookup = new Map()
  for (const m of measuresList) {
    if (m && m.name) measureTableLookup.set(m.name, m.table || '')
  }

  if (!pbiviz || !pbiviz.guid || !pbiviz.base64) {
    console.warn('[PBI Builder] no bundled .pbiviz passed; visual will fail to load in Service')
  }

  const ctx = { measureTableLookup, visualDataMap, canvasTheme, pbiviz }

  const parts = (Array.isArray(originalParts) && originalParts.length > 0)
    ? buildExistingReportParts({
        originalParts, pages, injectionScope, renderer, ctx,
      })
    : buildNewReportParts({
        pages, datasetId, reportName, workspaceName, datasetName, renderer, ctx,
      })

  // Org-library mode: no binary embedded — the .pbiviz lives in the tenant's
  // Organizational visual library. buildEmbeddedVisualParts/Items are kept
  // in this file for reference if we revisit embed-per-report later.
  // eslint-disable-next-line no-unused-expressions
  void buildEmbeddedVisualParts
  // eslint-disable-next-line no-unused-expressions
  void buildEmbeddedVisualItems

  // Debug logs — visible in renderer DevTools
  console.log('[PBI Builder] modern PBIR parts:', parts.map((p) => p.path))
  const reportJsonPart = parts.find((p) => p.path === 'definition/report.json' || p.path === 'report.json')
  if (reportJsonPart) {
    try {
      console.log('[PBI Builder] definition/report.json content:',
        JSON.stringify(JSON.parse(reportJsonPart.content), null, 2))
    } catch { /* ignore */ }
  }
  // Also dump the first visual.json so we can verify the query shape
  const firstVisualPart = parts.find((p) => /\/visuals\/[^/]+\/visual\.json$/.test(p.path))
  if (firstVisualPart) {
    try {
      console.log('[PBI Builder] sample visual.json (' + firstVisualPart.path + '):',
        JSON.stringify(JSON.parse(firstVisualPart.content), null, 2))
    } catch { /* ignore */ }
  }

  return parts
}

// ── Existing report path ────────────────────────────────────────────────────

/**
 * Modify an existing modern-PBIR report:
 *   • fullpage / multipage → drop all existing definition/pages/* parts and
 *     write fresh page directories with Semantica-only visuals
 *   • single → keep existing pages, append new visuals to the first page dir
 *
 * In all cases definition/report.json is updated to register the custom
 * visual via publicCustomVisuals, and definition/pages/pages.json is rewritten
 * to reflect the final page order.
 */
function buildExistingReportParts({
  originalParts, pages, injectionScope, renderer, ctx,
}) {
  // Pull the original report.json so we can preserve theme / objects / settings
  const reportJsonEntry = originalParts.find((p) => isReportJsonPath(p.path))
  let reportJson = reportJsonEntry ? safeParse(reportJsonEntry.content) : null
  if (!reportJson) reportJson = createDefaultReportJson(ctx)
  reportJson = ensureCustomVisualRegistered(reportJson, ctx)

  // Decide which pages we will publish
  const semanticaPagesPartList = (injectionScope === 'single')
    ? buildSinglePagePartList({ originalParts, pages, renderer, ctx })
    : buildFullPagePartList({ pages, renderer, ctx })

  // Build the new pages.json from the final page order
  const pageOrder = semanticaPagesPartList.pageOrder
  const newPagesMetaPart = {
    path: 'definition/pages/pages.json',
    content: JSON.stringify({
      $schema:        SCHEMA.pagesMeta,
      pageOrder,
      activePageName: pageOrder[0] || 'ReportSection',
    }, null, 2),
  }

  // Pass through everything that's not a page part, not pages.json, and not report.json
  const passThroughs = originalParts.filter((p) => {
    if (isReportJsonPath(p.path))    return false
    if (isPagesMetaPath(p.path))     return false
    // For fullpage we drop ALL existing page parts. For single we keep them
    // (semanticaPagesPartList.dropPaths controls which paths are dropped).
    if (semanticaPagesPartList.dropPaths.has(p.path)) return false
    return true
  }).map((p) => ({ ...p }))

  return [
    ...passThroughs,
    {
      path:    reportJsonEntry?.path || 'definition/report.json',
      content: JSON.stringify(reportJson, null, 2),
    },
    newPagesMetaPart,
    ...semanticaPagesPartList.parts,
  ]
}

/**
 * Fullpage / multipage strategy: replace all definition/pages/* with fresh
 * Semantica pages built from the editor's `pages` state.
 */
function buildFullPagePartList({ pages, renderer, ctx }) {
  const parts     = []
  const pageOrder = []

  pages.forEach((page, idx) => {
    const pageDir  = pageDirName(page.id, idx)
    pageOrder.push(pageDir)

    parts.push({
      path:    `definition/pages/${pageDir}/page.json`,
      content: JSON.stringify(buildPageJson(page, pageDir), null, 2),
    })

    const renderableVisuals = (page.visuals || []).filter(visualHasMeasures)
    for (const visual of renderableVisuals) {
      parts.push({
        path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(visual.id)}/visual.json`,
        content: JSON.stringify(buildVisualJson(visual, renderer, ctx), null, 2),
      })
    }
  })

  // dropPaths matches every existing definition/pages/* — we're wiping them all
  return { parts, pageOrder, dropPaths: makeAllPagePathsDropper() }
}

/**
 * Single-visual strategy: keep all existing pages and visuals, append new
 * Semantica visuals to the first existing page directory.
 *
 * If there are no existing pages we fall back to fullpage behavior.
 */
function buildSinglePagePartList({ originalParts, pages, renderer, ctx }) {
  // Find the first existing page directory in the original parts
  const firstPageEntry = originalParts.find((p) =>
    /\/?definition\/pages\/[^/]+\/page\.json$/i.test(p.path)
  )
  if (!firstPageEntry) {
    // Nothing to merge into — fall back to fullpage
    return buildFullPagePartList({ pages, renderer, ctx })
  }

  const targetDir = firstPageEntry.path.replace(/\/page\.json$/i, '')
    .replace(/^\/?(definition\/pages\/[^/]+).*/, '$1')

  // Compute existing page order from the original pages.json (if present),
  // otherwise from the page directories in the parts list.
  const pagesMetaEntry = originalParts.find((p) => isPagesMetaPath(p.path))
  const existingMeta   = pagesMetaEntry ? safeParse(pagesMetaEntry.content) : null
  let pageOrder = Array.isArray(existingMeta?.pageOrder)
    ? [...existingMeta.pageOrder]
    : []

  // Ensure the target page is in the order list at least once
  const targetDirName = targetDir.split('/').pop()
  if (!pageOrder.includes(targetDirName)) pageOrder.unshift(targetDirName)

  // Build new visual.json files into the target directory
  const parts = []
  const firstPage = pages[0]
  const renderableVisuals = (firstPage?.visuals || []).filter(visualHasMeasures)
  for (const visual of renderableVisuals) {
    parts.push({
      path:    `${targetDir.replace(/^\//, '')}/visuals/${visualIdSlug(visual.id)}/visual.json`,
      content: JSON.stringify(buildVisualJson(visual, renderer, ctx), null, 2),
    })
  }

  return { parts, pageOrder, dropPaths: new Set() }
}

// ── New report path ─────────────────────────────────────────────────────────

function buildNewReportParts({ pages, datasetId, reportName, workspaceName, datasetName, renderer, ctx }) {
  const parts = []

  // .platform
  parts.push({
    path:    '.platform',
    content: JSON.stringify({
      $schema: SCHEMA.platform,
      metadata: { type: 'Report', displayName: reportName },
      config:   { version: '2.0', logicalId: uuid() },
    }, null, 2),
  })

  // definition.pbir — modern PBIR schema (definitionProperties/2.0.0) requires
  // `byConnection` to contain ONLY `connectionString` (a String). Every other
  // field is rejected by the schema's `additionalProperties: false`.
  //
  // Fabric's importer also requires the dataset GUID to be present somewhere.
  // The error "InvalidConnectionInformation" tells us the canonical place is
  // a `semanticModelId=<GUID>` parameter inside the connection string itself
  // (since `pbiModelDatabaseName` is no longer allowed as a sibling field).
  //
  // Workspace name is percent-encoded; both display names are present so the
  // resulting string also functions as a valid XMLA endpoint reference for
  // tools that look at Data Source / Initial Catalog directly.
  const encodedWs = encodeURIComponent(workspaceName || '')
  const connectionString =
    `Data Source=powerbi://api.powerbi.com/v1.0/myorg/${encodedWs};` +
    `Initial Catalog=${datasetName || ''};` +
    `semanticModelId=${datasetId || ''};` +
    `Integrated Security=ClaimsToken`

  parts.push({
    path:    'definition.pbir',
    content: JSON.stringify({
      $schema: SCHEMA.pbir,
      version: '4.0',
      datasetReference: {
        byConnection: { connectionString },
      },
    }, null, 2),
  })

  // definition/version.json
  parts.push({
    path:    'definition/version.json',
    content: JSON.stringify({
      $schema: SCHEMA.version,
      version: '2.0.0',
    }, null, 2),
  })

  // definition/report.json
  const reportJson = ensureCustomVisualRegistered(createDefaultReportJson(ctx), ctx)
  parts.push({
    path:    'definition/report.json',
    content: JSON.stringify(reportJson, null, 2),
  })

  // Pages
  const pageOrder = []
  pages.forEach((page, idx) => {
    const pageDir = pageDirName(page.id, idx)
    pageOrder.push(pageDir)

    parts.push({
      path:    `definition/pages/${pageDir}/page.json`,
      content: JSON.stringify(buildPageJson(page, pageDir), null, 2),
    })

    const renderableVisuals = (page.visuals || []).filter(visualHasMeasures)
    for (const visual of renderableVisuals) {
      parts.push({
        path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(visual.id)}/visual.json`,
        content: JSON.stringify(buildVisualJson(visual, renderer, ctx), null, 2),
      })
    }
  })

  // definition/pages/pages.json
  parts.push({
    path:    'definition/pages/pages.json',
    content: JSON.stringify({
      $schema:        SCHEMA.pagesMeta,
      pageOrder,
      activePageName: pageOrder[0] || 'ReportSection',
    }, null, 2),
  })

  return parts
}

// ── Page / visual builders ──────────────────────────────────────────────────

function buildPageJson(page, pageDir) {
  return {
    $schema:       SCHEMA.page,
    name:          pageDir,
    displayName:   page.name || page.displayName || 'Page',
    displayOption: 'FitToPage',
    height:        Number(page.height) || 720,
    width:         Number(page.width)  || 1280,
    objects:       buildPageObjects(page.background || '#0F1117'),
  }
}

function buildPageObjects(backgroundColor) {
  const colorLit = (c) => ({
    solid: { color: { expr: { Literal: { Value: `'${c}'` } } } },
  })
  return {
    background: [{
      properties: {
        color:        colorLit(backgroundColor),
        transparency: { expr: { Literal: { Value: '0' } } },
      },
    }],
    outspace: [{
      properties: {
        color: colorLit(backgroundColor),
      },
    }],
  }
}

function buildVisualJson(visual, _renderer, ctx) {
  const { visualDataMap, canvasTheme, measureTableLookup, pbiviz } = ctx || {}

  // Org-library vilsem Renderer visual.
  const visualType = orgStoreName(SEMANTICA_VISUAL_GUID)

  const w = num(visual.width,  420)
  const h = num(visual.height, 280)
  const x = num(visual.x, 0)
  const y = num(visual.y, 0)
  const z = 2000

  // ──────────────────────────────────────────────────────────────────
  // Pre-rendered HTML snapshot from htmlTemplates/
  // ──────────────────────────────────────────────────────────────────
  // At publish time, ReportEditor.handlePublish pre-fetches the data for
  // every visual into `visualDataMap` and passes the map here. We call our
  // existing htmlTemplates/ dispatcher to turn the visual + data + theme
  // into a self-contained HTML string, then embed that string in the
  // vilsem Renderer's `html.body` formatting property.
  //
  // The custom visual's update() method reads dv.metadata.objects.html.body,
  // sets its root element's innerHTML, and the Semantica look lands in
  // Power BI exactly the way the editor preview showed it.
  let renderedHtml = ''
  if (visualDataMap && visualDataMap.has(visual.id)) {
    try {
      renderedHtml = renderVisualToHtml(
        visual,
        visualDataMap.get(visual.id),
        canvasTheme || 'dark',
      )
    } catch (e) {
      console.warn('[reportBuilder] HTML render failed for', visual.id, e?.message)
      renderedHtml = ''
    }
  }

  // Stub measure projection — required on PBIR-imported org visuals to
  // satisfy Power BI's instantiation gate (supportsLandingPage is ignored
  // on import). The visual.ts IGNORES the bound data and reads HTML from
  // objects.html.body.
  const stubMeasure = Array.isArray(visual.measures) && visual.measures.length > 0
    ? visual.measures[0]
    : null
  const stubTable   = stubMeasure && measureTableLookup
    ? (measureTableLookup.get(stubMeasure) || '')
    : ''

  const queryBlock = (stubMeasure && stubTable) ? {
    queryState: {
      content: {
        projections: [{
          field: {
            Measure: {
              Property:   stubMeasure,
              Expression: { SourceRef: { Entity: stubTable } },
            },
          },
          queryRef:       `${stubTable}.${stubMeasure}`,
          nativeQueryRef: stubMeasure,
          active:         true,
        }],
      },
    },
  } : undefined

  return {
    $schema: SCHEMA.visual,
    name:    visualIdSlug(visual.id),
    position: {
      x, y, z,
      width:    w,
      height:   h,
      tabOrder: z,
    },
    visual: {
      visualType,
      ...(queryBlock ? { query: queryBlock } : {}),
      drillFilterOtherVisuals: true,
      objects: {
        html: [{
          properties: {
            body:  { expr: { Literal: { Value: `'${escapeDaxLiteral(renderedHtml)}'` } } },
            theme: { expr: { Literal: { Value: `'${escapeDaxLiteral(canvasTheme || 'dark')}'` } } },
          },
        }],
      },
    },
  }
}

/**
 * Escape a string for embedding inside a single-quoted DAX Literal.Value.
 * Single quotes must be doubled ('' is the escape sequence). We also strip
 * control characters that Power BI's JSON parser and DAX tokenizer choke
 * on. Backslashes and double quotes are fine — only single quotes are
 * special inside single-quoted DAX strings.
 */
function escapeDaxLiteral(str) {
  if (str == null) return ''
  return String(str)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/'/g, "''")
}

// NOTE — buildVisualQuery (PBIR queryState + projections) was removed when
// we switched from Microsoft's HTML Content visual to our own Semantica
// Renderer custom visual. The new visual reads HTML from a formatting
// property, not from a data role binding, so no query projections are
// needed. The helpers resolveMeasureRef/parseDimension are kept for
// potential future use (e.g. {{rows[0].value}} live-data interpolation
// via a declared `content` data role binding).

// ── report.json template + custom-visual registration ──────────────────────

function createDefaultReportJson(ctx) {
  const reportJson = {
    $schema: SCHEMA.report,
    themeCollection: {
      baseTheme: {
        name: 'CY24SU06',
        // Required by report.json schema — pins the visual/report/page subschemas
        // the theme was authored against. These values are taken from the
        // Adventure-Works PBIP reference (known-good Fabric report).
        reportVersionAtImport: {
          visual: '1.8.79',
          report: '2.0.79',
          page:   '1.3.79',
        },
        type: 'SharedResources',
      },
    },
    objects: {
      section: [{
        properties: {
          verticalAlignment: { expr: { Literal: { Value: "'Top'" } } },
        },
      }],
    },
    publicCustomVisuals: [],
    resourcePackages: [
      {
        name: 'SharedResources',
        type: 'SharedResources',
        items: [{
          name: 'CY24SU06',
          path: 'BaseThemes/CY24SU06.json',
          type: 'BaseTheme',
        }],
      },
    ],
    settings: {
      useStylableVisualContainerHeader: true,
      exportDataMode:                   'AllowSummarized',
      defaultDrillFilterOtherVisuals:   true,
      allowChangeFilterTypes:           true,
      useEnhancedTooltips:              true,
      useDefaultAggregateDisplayName:   true,
    },
  }
  return ensureCustomVisualRegistered(reportJson, ctx)
}

/**
 * Register the embedded vilsem Renderer custom visual in report.json:
 *
 *   1. publicCustomVisuals[] — add the base GUID from pbiviz.json
 *   2. resourcePackages[] — add a `RegisteredResources` entry pointing to
 *      the embedded .pbiviz part at `definition/customVisuals/<guid>/package.pbiviz`
 *
 * No org-library dependency. Power BI reads the visual binary straight from
 * the report's own embedded part.
 */
function ensureCustomVisualRegistered(reportJson /*, ctx */) {
  const guid   = SEMANTICA_VISUAL_GUID
  const orgKey = orgStoreName(guid)

  if (!Array.isArray(reportJson.publicCustomVisuals)) {
    reportJson.publicCustomVisuals = []
  }
  if (!reportJson.publicCustomVisuals.includes(guid)) {
    reportJson.publicCustomVisuals.push(guid)
  }

  if (!Array.isArray(reportJson.resourcePackages)) {
    reportJson.resourcePackages = []
  }
  const hasRegistered = reportJson.resourcePackages.some(
    (rp) => rp && rp.type === SEMANTICA_VISUAL_RESOURCE_TYPE && rp.name === orgKey
  )
  if (!hasRegistered) {
    reportJson.resourcePackages.push({
      name:  orgKey,
      type:  SEMANTICA_VISUAL_RESOURCE_TYPE,
      items: [],
    })
  }
  return reportJson
}

// ── Embedded custom visual helpers ─────────────────────────────────────────

/**
 * Build the items[] array for the embedded CustomVisual resourcePackage in
 * report.json. One item per piece of the unzipped .pbiviz. The per-item
 * `type` must match the ResourcePackageItemType enum in the PBIR schema
 * (CustomVisualJavascript, CustomVisualsCss, CustomVisualIcon,
 * CustomVisualMetadata). Paths are relative to `definition/`.
 */
function buildEmbeddedVisualItems(pbiviz) {
  const cvName = pbiCvName(pbiviz.guid)
  const items  = []
  // All items share the same `name` (PBI_CV_<guid>) so the runtime groups
  // them. `path` is flat, relative to StaticResources/RegisteredResources/.
  if (pbiviz.pieces.metadata) {
    items.push({
      name: cvName,
      path: embeddedFileName(pbiviz, 'json'),
      type: 'CustomVisualMetadata',
    })
  }
  if (pbiviz.pieces.js) {
    items.push({
      name: cvName,
      path: embeddedFileName(pbiviz, 'visual.js'),
      type: 'CustomVisualJavascript',
    })
  }
  if (pbiviz.pieces.css) {
    items.push({
      name: cvName,
      path: embeddedFileName(pbiviz, 'visual.css'),
      type: 'CustomVisualsCss',
    })
  }
  if (pbiviz.pieces.icon) {
    items.push({
      name: cvName,
      path: embeddedFileName(pbiviz, `${pbiviz.guid}.png`),
      type: 'CustomVisualIcon',
    })
  }
  return items
}

/**
 * Produce the PBIR parts that carry the actual binary bytes of each
 * unzipped .pbiviz piece. Paths here are prefixed with `definition/`
 * (Power BI's resource base path).
 */
function buildEmbeddedVisualParts(pbiviz) {
  const parts = []
  const base  = 'StaticResources/RegisteredResources'
  if (pbiviz.pieces.metadata) {
    parts.push({
      path:        `${base}/${embeddedFileName(pbiviz, 'json')}`,
      content:     pbiviz.pieces.metadata.base64,
      payloadType: 'InlineBase64',
    })
  }
  if (pbiviz.pieces.js) {
    parts.push({
      path:        `${base}/${embeddedFileName(pbiviz, 'visual.js')}`,
      content:     pbiviz.pieces.js.base64,
      payloadType: 'InlineBase64',
    })
  }
  if (pbiviz.pieces.css) {
    parts.push({
      path:        `${base}/${embeddedFileName(pbiviz, 'visual.css')}`,
      content:     pbiviz.pieces.css.base64,
      payloadType: 'InlineBase64',
    })
  }
  if (pbiviz.pieces.icon) {
    parts.push({
      path:        `${base}/${embeddedFileName(pbiviz, pbiviz.guid + '.png')}`,
      content:     pbiviz.pieces.icon.base64,
      payloadType: 'InlineBase64',
    })
  }
  return parts
}

// ── Reference resolution ────────────────────────────────────────────────────
//
// resolveMeasureRef / parseDimension were used by the old buildVisualQuery
// path. They're now unused because vilsem Renderer reads HTML from a
// formatting property instead of binding measures/columns as data roles.
// If we later add live-data interpolation (a `content` role that the HTML
// references via {{rows[0].<col>}}), reintroduce them from git history.

// ── Path / id helpers ───────────────────────────────────────────────────────

function isReportJsonPath(path) {
  // Modern PBIR: definition/report.json. Also tolerate the legacy bare report.json.
  if (!path) return false
  return /(^|\/)report\.json$/i.test(path) && !/\/pages\/.*\/report\.json$/i.test(path)
}

function isPagesMetaPath(path) {
  if (!path) return false
  return /\/?definition\/pages\/pages\.json$/i.test(path)
}

/**
 * Returns a Set-like object whose `.has()` always returns true for paths
 * matching definition/pages/{anything} — used to drop ALL existing page
 * parts in fullpage / multipage mode.
 */
function makeAllPagePathsDropper() {
  return {
    has: (path) => /\/?definition\/pages\/[^/]+\/(page\.json|visuals\/.+)/i.test(path),
  }
}

/**
 * Convert a (possibly UUID) page id into a stable directory name. Power BI's
 * convention is alphanumeric (no hyphens) — we strip hyphens but keep the
 * id otherwise to preserve identity across publishes.
 */
function pageDirName(pageId, fallbackIdx) {
  if (!pageId) return `ReportSection${fallbackIdx > 0 ? fallbackIdx : ''}`
  const cleaned = String(pageId).replace(/-/g, '').replace(/[^A-Za-z0-9]/g, '')
  if (!cleaned) return `ReportSection${fallbackIdx > 0 ? fallbackIdx : ''}`
  // Always start with a letter so it can also serve as a section name
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `s${cleaned}`
}

function visualIdSlug(visualId) {
  if (!visualId) return `v${Math.random().toString(36).slice(2, 10)}`
  return String(visualId).replace(/-/g, '').replace(/[^A-Za-z0-9]/g, '')
}

function visualHasMeasures(v) {
  return Array.isArray(v?.measures) && v.measures.length > 0
}

function safeParse(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  try { return JSON.parse(text) } catch { return null }
}

function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
