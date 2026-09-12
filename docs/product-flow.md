# Product workflow

Initial audit, 2026-09-07. **Executed** means the real desktop UI was exercised; **traced** means source inspection only.

| Step | Current flow | Evidence level |
|---|---|---|
| Start | Electron startup initializes local state and routes an unconfigured profile to Microsoft/Service Principal sign-in | Executed; startup screenshot |
| Choose auth | Microsoft button or Service Principal tab with credential inputs | Tab switch executed; authentication not submitted |
| AI onboarding | After auth, getAiStatus decides whether optional provider setup is shown | Traced |
| Start project | Home → Create Project → name/workspace/dataset selection → AppGenerator | Traced |
| Discover fields | Main metadata context supplies measures, dimensions and relationships; editor offers field lists/search | Traced |
| Create visual | Palette/add handlers create positioned spec records; custom gallery adds template definitions and bindings | Traced; leaf output exercised separately |
| Assign fields | Inspector updateData edits measures, groupBy/dimensions and ordering/limits | Traced |
| Query/render | Editor/viewer call preload query APIs, normalize returned rows, dispatch registry component | Traced; synthetic normalized rows exercised |
| Format | Manual controls plus attached schema fields → updateConfig → editSpec → rerender | Traced; control enumeration still incomplete |
| Move/resize | Canvas pointer handlers and numeric position controls update grid positions with zoom conversion | Traced; leaf sizes tested independently |
| Select/filter/drill | Edit selection differs from view cross-filter/drill/axis switching | Traced; actual pointer flows pending |
| AI edit | Chat refine or inspector scoped refine → patchAppSpec → validation/sanitization → page merge | Traced; provider operation pending |
| Save | saveAppSpec(name,datasetId,spec) stores spec plus retained chat messages | Traced |
| Reopen | Home lists saved specs; App passes initialSpec to AppGenerator and restores document/chat state | Traced |
| Duplicate/delete | Visual and project actions alter document/database; test recovery and duplicate names | Not exercised |
| Output | Web export/preview, Power BI injection/publish, Fabric deployment | Traced; builds tested separately, deployment not performed |
| Other work | Report restyling with plans/backups; visual playground/templates; page navigation/modals | Traced, incomplete |

The desktop synthetic test uses a new profile under cache/qa-profile and never reads the developer .env. Live data remains a separate test layer. Renderer fixture data is generated in ui/qa/renderer-audit.jsx, not loaded from client data.

Expected product behaviors to validate: field edits show the data actually requested; missing fields produce actionable empty states; failed queries never fabricate values; formatting controls reflect effective defaults; save failures remain visible; destructive changes have a recovery path; AI feedback describes accepted supported operations.
