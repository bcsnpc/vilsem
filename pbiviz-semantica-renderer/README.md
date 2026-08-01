# Semantica Renderer — Power BI custom visual

A minimal Power BI custom visual that renders a self-contained HTML string
supplied via a formatting property. Used by Semantica's Power BI Mode
publish flow to embed pre-rendered Semantica visuals inside published
Power BI reports with full editor fidelity.

## Why this exists

Microsoft's HTML Content visual from AppSource is purely data-driven — it
reads HTML from the **value** of a measure or column bound to its `content`
data role, not from a formatting property. To ship pre-rendered HTML via
Power BI's REST API (PBIR publishing), we'd have to first create a DAX
measure in the semantic model that returns the HTML string, which requires
XMLA endpoint writes that are out of scope for Semantica's publish pipeline.

This visual solves that by reading HTML directly from an `html.body`
formatting property. Semantica's `reportBuilder.js` writes the HTML
literal into `visual.objects.html.body` when generating PBIR parts. The
visual's `update()` method reads the string and sets it as its root
element's `innerHTML`. That's it — no DAX measures, no data role
contortions, full control over the output.

## Project layout

```
pbiviz-semantica-renderer/
├── pbiviz.json         # visual metadata, version, GUID
├── capabilities.json    # formatting objects, data roles
├── package.json         # powerbi-visuals-tools dep
├── tsconfig.json
├── src/
│   └── visual.ts        # the 60-line IVisual implementation
├── style/
│   └── visual.less      # root element reset
├── assets/
│   └── icon.png         # 20x20 panel icon (replace placeholder)
└── dist/
    └── *.pbiviz         # (generated) built visual package
```

## Build

Prerequisites:
- Node 18+ (Power BI Visual Tools requirement)
- No global install needed — we use the local devDependency

```bash
cd pbiviz-semantica-renderer
npm install
npx pbiviz package
```

Output: `dist/semanticaHtmlRenderer.1.0.0.0.pbiviz` (or similar, matching
the version in `pbiviz.json`).

## Local development / test

Power BI Visual Tools ships a dev server that hot-reloads your visual into
Power BI Desktop or Service via the "Developer Visual" slot:

1. Enable Developer Visual in Fabric Admin Portal → Tenant settings →
   Developer settings → "Enable developer mode" (tenant admins only)
2. Open a Power BI Desktop or Service report
3. Click the Developer Visual in the Visualizations panel (lightning bolt icon)
4. Back in your terminal: `npx pbiviz start`
5. The visual hot-reloads from `localhost:8080` on every save
6. Set `Format → HTML → Body` to test HTML like `<h1 style="color:teal">Hello</h1>`

## Org library upload (for published Semantica reports)

Semantica publishes reports that reference this visual by its GUID
(`semanticaHtmlRenderer`, from `pbiviz.json`). For those reports to render
in Power BI Service, the visual must be available in the tenant:

1. Build the `.pbiviz` file as above
2. Open [Fabric Admin Portal](https://app.fabric.microsoft.com/admin-portal)
3. Tenant settings → Organizational visuals
4. Click **Add visual from file** → upload `dist/semanticaHtmlRenderer.*.pbiviz`
5. Enable for your organization (or a specific security group)
6. Users can now view Semantica-published reports with Semantica visuals
   rendering correctly

**No Microsoft certification is required** for organizational visual
uploads. The visual remains internal to your tenant.

## Formatting properties

Defined in `capabilities.json` under `objects.html`:

| Property | Type | Description |
|---|---|---|
| `body`  | text | Self-contained HTML rendered via `innerHTML`. Set by Semantica at publish time. |
| `theme` | text | Theme hint (`dark` or `light`). Currently informational only. |

## Data binding (optional)

The visual declares a `content` data role that accepts either a measure or
a grouping column, mapped via a `table` dataViewMapping. Binding is
**optional** — if no data is bound, the visual renders the `html.body`
property as-is.

If data IS bound, the HTML can reference row values via a tiny `{{path}}`
interpolator:

```
{{rows[0].Total Orders}}      — value in the first row under the column named "Total Orders"
{{rows[0][0]}}                — value in the first row, first column (positional)
{{columns[0]}}                — name of the first column
{{rowCount}}                  — total rows in the binding
```

The interpolator uses safe dotted-path lookups — no `eval`, no
`Function` constructor.

## Security model

The visual runs inside Power BI's `visual-sandbox` iframe. CSP allows
`'unsafe-inline'` (inline styles, inline event handlers) and `'unsafe-eval'`
(eval/Function), but:

- We do NOT use `eval` or `Function` — the path interpolator is pure
  string parsing
- `<script>` tags inserted via `innerHTML` do NOT execute (HTML5 spec)
- Inline CSS, inline SVG, and inline event handlers DO work

This means any HTML Semantica generates can include styled layouts,
SVG charts, hover effects, and animations — but cannot execute JavaScript
via `<script>` tags written to innerHTML.

## Version history

- **1.0.0** — initial release. HTML body formatting property, optional
  data binding with `{{path}}` interpolation.
