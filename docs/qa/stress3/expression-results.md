# Round 3 expression exercise results

These are live Desktop-model queries and MCP tool results, followed by manual
inspection of the SSR PNG. They are **not Power BI Desktop rendering passes**.
The owned report contains the new `Stress3` page. The original PBIP/model was
not edited. Live connection: port 57149, process-workspace-port-file discovery.

| Visual | validate / explain / preview / commit | Inspected preview | Native |
|---|---|---|---|
| Marimekko | PASS, 18 grouped rows | PASS after bounded cell labels | Not verified |
| Mosaic | PASS, 18 grouped rows | PASS after bounded cell labels | Not verified |
| Violin | PASS, 130 sold SKUs | PASS after normalized paths and stroke fix | Not verified |
| Ridgeline | PASS, 130 sold SKUs | PASS after normalized paths and stroke fix | Not verified |
| Venn | PASS, 293 product rows | PASS, exact observed set counts | Not verified |
| Beeswarm | PASS, 130 sold SKUs | PASS | Not verified |
| Flame | PASS, 130 sold SKUs | PASS, small labels suppressed | Not verified |
| Word cloud | PASS, 130 sold SKUs | PASS after foreground contrast fix | Not verified |
| Hexbin | PASS, 130 sold SKUs / 10 occupied bins | PASS after axis/colorbar spacing correction | Not verified |
| Contour | PASS, 130 sold SKUs / 65 segments | PASS after axis/colorbar spacing correction | Not verified |
| Weighted Voronoi treemap | PASS, 18 rows / 24 parent and leaf cells | PASS, small labels suppressed | Not verified |

Venn circles are schematic; their areas do not encode set cardinalities.
Independent live DAX COUNTROWS/FILTER queries also verified all eight exclusive
membership counts: 73 outside, 28 Black only, 37 Unisex only, 21 Black/Unisex,
18 High-price only, 0 Black/High-price, 77 Unisex/High-price and 39 all three.
They total 293 products; no model changes were made.
Arbitrary exact area-proportional Euler fitting remains a separate limitation.
Contours encode KDE levels relative to peak density, not probability/confidence
regions. Hexagons use normalized price/cost coordinates. The Voronoi solver
requires positive sibling fractions at least 1e-7 and refuses results exceeding
0.1% relative area error or its fixed work budget.

All examples are newly authored in vilsem-mcp/scripts/round3-*-acceptance.mjs;
passing JSON examples are in vilsem-mcp/templates/stress3-*-expression.*.
Private evidence is under vilsem-mcp/test-results/stress3, including failed
before-fix images. Raw model schemas and data are not public release artifacts.

Native blocker: Desktop reports unsaved changes; reload was refused before any
page activation change. Computer Use's native pipe and browser host are
unavailable. A successful commit or SSR image does not resolve that blocker.
