# Round 3 expression exercise results

These are live Desktop-model queries and MCP tool results, followed by manual
inspection of the SSR PNG. A later native static-rendering check is recorded
separately below; it does not prove interaction or complete clipping behavior.
The owned report contains the new `Stress3` page. The original PBIP/model was
not edited. Initial connection57149; reopened Desktop62071, both discovered by
process-workspace-port-file.

| Visual | validate / explain / preview / commit | Inspected preview | Native static marks / full interactions |
|---|---|---|---|
| Marimekko | PASS, 18 grouped rows | PASS after bounded cell labels | Inspected / unverified |
| Mosaic | PASS, 18 grouped rows | PASS after bounded cell labels | Inspected / unverified |
| Violin | PASS, 130 sold SKUs | PASS after normalized paths and stroke fix | Inspected / unverified |
| Ridgeline | PASS, 130 sold SKUs | PASS after normalized paths and stroke fix | Inspected / unverified |
| Venn | PASS, 293 product rows | PASS, exact observed set counts | Inspected / unverified |
| Beeswarm | PASS, 130 sold SKUs | PASS | Inspected after capture retry / unverified |
| Flame | PASS, 130 sold SKUs | PASS, small labels suppressed | Inspected / unverified |
| Word cloud | PASS, 130 sold SKUs | PASS after foreground contrast fix | Inspected / unverified |
| Hexbin | PASS, 130 sold SKUs / 10 occupied bins | PASS after axis/colorbar spacing correction | Inspected / unverified |
| Contour | PASS, 130 sold SKUs / 65 segments | PASS after axis/colorbar spacing correction | Inspected / unverified |
| Weighted Voronoi treemap | PASS, 18 rows / 24 parent and leaf cells | PASS, small labels suppressed | Inspected / unverified |

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

Native follow-up: all11 examples have inspected marks/geometry in Desktop bridge
captures on individual owned detail pages. The first beeswarm capture timed out
and its retry succeeded. An Auto Recovery banner obscures headings; title/bounds
acceptance and physical filtering/selection are not verified. Computer Use still
fails with native pipe os error2. See [native follow-up](native-follow-up.md).
