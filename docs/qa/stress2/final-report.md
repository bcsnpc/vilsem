# Stress round 2 report

[All 120 PASS/refusal rows and native screenshots](results.md) | [Every format addition](format-additions.md) | [Acceptance scope](status.md)

## Results

111 native rendering PASS; nine category-(c) refusals. Every accepted visual was freshly authored, bound to actual get_schema fields, passed all four MCP operations, and was individually inspected in Desktop. No existing shipped template was used as the starting file. New accepted examples ship in the MCP templates directory.

Task1 implements query-only spec.measures with schema/reference/cycle guards, actual DAX-engine validation, DEFINE/EVALUATE explanation and preview, and context-correct inline PBIR NativeMeasure expressions. The live derived-margin chart displays real62.8%,44.3%,41.1% values. Model writes are not exposed. Ratio, time-intelligence and rank examples are in vilsem://docs/spec-format.

All discovered category-(a)/(b) format/shape gaps in this sweep were addressed and their cases retried. Bounded density, normal quantiles, hex bins, swarm collision layout and word packing are category-(b): trusted finite algorithms can return ordinary declarative series data. They do not need caller callbacks. Word packing uses fixed conservative label rectangles and graph labels, not an unshipped wordCloud plugin. No geometry or membership is invented for unsupported cases.

## Remaining category-(c) cases

| Cases | Capability | Exact primary refusal |
| --- | --- | --- |
|087,088|Marimekko, mosaic|custom series requires imperative renderItem; executable callbacks are not supported by the declarative format|
|111-114|Choropleth, bubble map, geo heatmap, flow map|geo/map rendering requires a shipped registered map asset; the current renderer ships none|
|117|Voronoi treemap|custom series requires imperative renderItem; executable callbacks are not supported by the declarative format|
|119|3D bar/surface|series type "bar3D" is not shipped by the current renderer; a bounded declarative transform or a sandboxed extension is required|
|120|Euler/Venn overlap|custom series requires imperative renderItem; executable callbacks are not supported by the declarative format|

Each had all four actual tools refuse precisely;36 calls total, with no container written. Maps are asset/environment-limited, not inherently callback-dependent; the supplied schema has no real latitude/longitude. No coordinates or external map assets were fabricated. Proposed bounded display-list/geometry/asset/GL boundaries and security implications are in the [MCP gap report](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/expressiveness-gaps.md). No category-(c) extension was implemented. A Web Worker or node:vm alone is not a security boundary.

## Verification and limitations

Private app/core956/956 and clean public app/core956/956; MCP167/167 with the final catalog against locally packed core0.4. Published-artifact acceptance is recorded separately in release-status.md. Earlier dependency setup failures and the single cold filesystem timeout are retained; the unchanged affected suite passed isolated and the complete single-worker suite then passed. App workspace audit45 unresolved (19moderate,21high,5critical); MCP0, including its published-core install.

Native renderer4.31 preserves authored opacity during selection. Desktop Filter interaction on the road word changed USA revenue7,938,999.42 to3,240,355.21; empty-area clear restored7,938,999.42. Native tooltips were read directly. Initial target mode was Highlight; Filter was explicitly selected temporarily for QA and discarded on close. This check targets another renderer visual, not a native slicer or Service report.

All19 model-definition hashes match before/after, including a read-only check after the final reopen; original supplied PBIP untouched. Desktop auto-detection used process-workspace-port-file (last isolated test port56276; ports are ephemeral). The isolated consumer starts and queries/renders real data with no Electron app checkout or VILSEM_APP_PATH.

This is rendering acceptance at900x600 plus documented interactions, not exhaustive all-formatting/all-resize/all-interaction/Service/Fabric/installer/certification coverage. Word/swarm/partition-label geometry requires its declared plot size. Population statistics are bounded by query windows; native categorical reduction is2000, preview defaults200 and accepts up to10000. Cohort105 explicitly uses50 real customer keys with91 returned rows/12 periods; CI081 discloses independent monthly observations. Resvg native failure is isolated, not eliminated. No new Electron installer is included.

Final published-core full-suite retry:167/167 PASS in408.30s; no source, assertion or timeout changes after the two isolated retries. Core core-v0.4.0 and MCP v0.4.0 are pushed to their public main histories. See release-status.md for artifact/install acceptance.
