# Local PBIR rendering investigation

## Findings (2026-09-07)

The working Service publisher (`ui/src/pages/powerbi/publishCustomVisualFlow.js`) writes PBIR-Legacy `report.json`: numeric resource types, nested `singleVisual`, `prototypeQuery`, and generated model measures. The local prototype writes enhanced `definition/report.json` plus per-page/per-visual definitions, string resource enums, `visual.query.queryState`, and direct existing-measure bindings. These are real differences; Service success does not validate this new serialization path.

Microsoft supports enhanced PBIR for externally authored report definitions. `definition.pbir` version 4.0 supports both legacy and enhanced definitions. Legacy report.json does not have a supported public editing contract. Therefore switching the local generator to legacy is not established as the correct fix.

Private custom visuals belong in CustomVisuals, with their package resources; this differs from AppSource/organizational-store registration. The generated artifact embeds renderer 4.12.0.0, not an organizational-store reference.

## Concrete serialization mismatch

Before Desktop Save, the local report resource item used `resources/<guid>.pbiviz.json`. After saving the isolated QA report through Desktop, Desktop rewrote that item path to `<guid>.pbiviz.json` while retaining the actual payload under `CustomVisuals/<guid>/resources/`. The working Service publisher also uses the basename in its resource item.

The local builder now matches this observed Desktop output. A regression test uses a realistic nested resource path and asserts the report item contains the basename. A fresh Desktop report with this correction renders the Bar visual successfully. The prior embedded 4.12.0.0 package is unchanged; the correction changes the resource registration path.

The same Desktop save upgraded report schema 3.2.0 to 3.3.0; that alone does not establish that 3.2.0 is unsupported. The current generated artifact passes all six published schemas.

## Verification

- 31 focused builder/writer tests passed after the path correction.
- Fresh report regenerated against an isolated copy of the model and opened in Desktop.
- Final screenshot `evidence/local-pbir-resource-fix.png` shows the loaded Bar chart with Accessories 57.8k, Bikes 13.9k, Clothing 12.4k, dark page and dark visual.
- Still required: interaction, Save/reopen, light-mode Desktop validation, other visuals and the public UI file-save workflow.
- No changes made to the Service publisher or original semantic model.

## Primary sources

- https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report (formats, model references, private visual folder)
- https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.2.0/schema.json (enhanced resource registration schema)
- https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualConfiguration/2.3.0/schema-embedded.json (query and formatting properties)

Search results suggesting publicCustomVisuals registration were treated as hypotheses. The field name alone does not prove that private bundled visuals should be registered as public; a Desktop-authored working specimen is the preferred comparison.
