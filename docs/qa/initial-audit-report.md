# Initial audit findings

Vilsem has a substantial working foundation, but this audit does **not** establish production readiness. No product code was rewritten or fixed during this checkpoint.

## Evidence established

- Real Electron startup and Service Principal tab interaction succeeded with an isolated profile.
- Desktop UI, standalone and Fabric renderer production bundles build successfully in separate audit output directories.
- Existing tests: **428 pass, 4 fail**. Failures are retained and need classification, not automatic assertion updates.
- **41 registry IDs**, including aliases and bare objects, plus **14 custom starter templates**. ECharts, DOM/SVG and active Recharts paths coexist.
- **369 synthetic leaf-renderer cases** executed. Runtime errors are present; all-visual functional coverage is not established.
- Initial property discovery: **98 literal inspector keys**, **223 runtime-attached schema entries**. Conditional/manual/dynamic controls remain to be reconciled and tested.

## Highest-priority findings

1. **Line/Area/Stacked Area/Bump hook failures** on populated→empty data transitions.
2. **Funnel fabricates sample values** when the query result is empty.
3. **Dimension-only tables disappear** under non-freeform layout normalization despite valid specs.
4. **Custom visual types are rejected** by the general App Spec validator despite registry support.
5. **Conflicting packaging configuration**, including a YAML `.env` inclusion rule; effective package contents remain unverified.
6. **Clipping/overflow candidates** in multiple DOM/SVG families require reproduction through actual editor/viewer containers.

Architecturally, the document state is chiefly React-local, with pub/sub shell bridges; editor and viewer independently assemble queries/config. Primitive schemas, manual controls, defaults, validator types and AI hints are separate contracts. Some visual names describe intended richer behavior than the current implementation: sankey/chord use arcs, sunburst is a donut approximation, and bump uses an inverted line.

## Handoff map

- [Architecture](../architecture.md), [product workflow](../product-flow.md), [visual construction](../visual-architecture.md).
- [Every registry ID and template](../visual-inventory.md), [consistency matrix](../visual-consistency-matrix.md), [AI/UI parity discovery](../ai-ui-parity-matrix.md).
- [Bug log](bug-log.md), [enhancements](enhancement-log.md), [priorities](priority-plan.md).
- [Test strategy](test-strategy.md), [per-visual matrix](test-matrix.md), [actual status](regression-status.md), [work log](work-log.md).

Outstanding: complete control enumeration and behavior assertions; real authoring/field assignment, save/reopen, filtering and drill; host clipping and readable screenshots; valid object/template variants; deterministic AI operation mapping and live provider acceptance; effective release configuration; systematic fixes and retests. These are explicitly **not completed** by the initial checkpoint.
