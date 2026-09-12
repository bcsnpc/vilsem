# AdventureWorks local PBIP connection test

Source: `pbip folder/AdventureWorks Report_FINAL.pbip`. Report definition resolves byPath to `AdventureWorks Report_FINAL.SemanticModel`, TMDL format. A local cache.abf is present.

Copied157 files to an isolated cache/qa-local-pbip directory and opened that copy in installed Power BI Desktop. Source hashes captured before launch and rechecked after all queries:157files unchanged, no additions/removals. Evidence: local-pbip-source-manifest.json and local-pbip-integrity.json. These are integrity manifests, not a backup of the source contents.

## Read-only connection verification

Loaded the installed Desktop ADOMD client and connected to the QA Desktop analysis engine using Windows integrated authentication. No cloud calls, refresh commands, source writes or model mutations were requested.

Four checks passed:
- Local analysis engine connection.
- Existing measures evaluated: Quantity Sold84174; Total Orders25164.
- Product category grouping returned Bikes13929, Clothing12436, Accessories57809.
- Bikes filter returned13929, matching the corresponding grouped row.

Evidence: local-pbip-connection.json. Reusable QA script: scripts/qa/local-pbip-connect.ps1, requiring explicit Port/Catalog arguments. These session identifiers are temporary and must be rediscovered after Desktop restarts. The QA copy remains open in Desktop for inspection.

Initial protocol attempts: system OLE DB provider was unavailable; SELECT against DBSCHEMA_CATALOGS was rejected. ADOMD GetSchemaDataSet catalog discovery and DAX evaluation then succeeded. Do not confuse these attempts with an application connection failure.

## Preservation rule for implementation

Keep existing tables, columns, partitions, relationships, hierarchies, cultures, expressions, lineage tags and measures intact. Future generated measures must be necessary for specific Vilsem visuals, uniquely named, tracked and added without replacing existing measures. Prepare and verify additions in a copy before any source write. No generated measures were needed or added during this test.

This proves a real local query route against this model's cached data. It does not yet integrate that route into Vilsem's Home/canvas/query provider or complete the local report exporter. No source refresh or Desktop save/reopen acceptance was performed.
