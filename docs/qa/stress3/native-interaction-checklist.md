# Native interaction acceptance: prepared, not verified

The owned Stress3 Theme Light QA report now contains these dedicated fixtures.
They were prepared outside MCP. MCP still authors/validates Vilsem visuals only.
All new page/visual JSON passes the Microsoft schemas, all visual bounds fit,
and interaction references resolve. Existing pages/visuals/report settings and
all21 semantic-model baseline files are unchanged. Desktop's clean report-only
reload accepted them. Schema/reload acceptance does not prove native rendering.

| Page | Purpose |
|---|---|
| QA Interactions - composition | Vilsem bar, native country bar, revenue card and country slicer |
| QA Interactions - template | Responsive reference template with the same native targets |
| QA Interactions - expression | Expression bars; explicit report-page tooltip assignment |
| QA Interactions - none | Slicer interaction with Vilsem explicitly set to NoFilter |
| QA Country Drillthrough | Country drill filter/binding, native card and Back action |
| QA Country Tooltip | Hidden tooltip page bound to Country, with a native revenue card |

The first three source pages explicitly configure Vilsem -> card/bar DataFilter
and native bar -> Vilsem HighlightFilter. Slicer -> Vilsem is DataFilter except
on the none page. All bindings refer to real existing fields; no model objects
or business values are embedded. The drillthrough parameter references its
matching filter.19new visuals comprise4Vilsem and15native fixture visuals.

## Required live checks

Repeat the first seven checks on composition, template and expression pages
where applicable. Start each test with the slicer cleared and selections reset.
Capture current baseline values from the model, not an old screenshot.

| Check | Expected result | Current status |
|---|---|---|
| Click one Vilsem country | Native card/bar match that country filter | BLOCKED: native input unavailable |
| Ctrl-click another | Card reflects the selected country set; both marks stay selected | BLOCKED |
| Empty-area click/Escape | Selection clears; native targets return to the appropriate slicer context | BLOCKED |
| Native country slicer | Vilsem receives the filtered rows, updates and restores on clear | BLOCKED |
| Native country bar | Other Vilsem marks remain present and dim; selected mark is highlighted | BLOCKED |
| Right-click -> drillthrough -> Back | Country reaches the target card and Back returns to the source | BLOCKED |
| Standard native tooltip | Country and model-formatted revenue are correct on hover | BLOCKED |
| Expression report-page tooltip | The configured country tooltip card receives the mark's context | BLOCKED |
| Bookmark with Data enabled | Real captured selection restores after selecting another country | BLOCKED; no fabricated bookmark state written |
| NoFilter page slicer | Native targets filter; Vilsem retains its unfiltered baseline | BLOCKED |
| Tab/arrows/Enter/Space/Escape | Focus, selection, modifiers and clear work in the native host | BLOCKED |
| Resize/extreme aspect ratios | Marks, titles, axes and tooltips remain usable/in bounds | BLOCKED |
| Hidden/reopened motion and PDF | Complete final geometry, including right Sankey label; no entry clip | BLOCKED |

The expression tooltip page is intentionally different from the standard
tooltip pages. A successful tooltip-service mock does not verify report-page
tooltip behavior. Bookmarks must be captured by the host with actual selection
identities; handwritten fake state is not acceptance.

Both available built-in computer-use interfaces currently fail with native pipe
os error2. Bridge captures previously returned partial/blank surfaces and could
destabilize Desktop; they are not substituted for physical checks. No user
foreground action can repair the missing automation pipe. The checked report
files can remain ready while this environment issue is unresolved.

Private evidence: cache/round3-f-native-fixtures-result.json, the guarded
preparation script/draft, saved pages.json before-state and clean reload result.
Raw report/model artifacts are not included in public releases.

Source references: [Microsoft page schema](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json),
[authoring workflows](https://github.com/microsoft/skills-for-fabric/blob/main/skills/powerbi-report-cli/references/authoring/authoring-workflows.md)
and [Back action](https://github.com/microsoft/skills-for-fabric/blob/main/skills/powerbi-report-cli/references/authoring/button-part-03.md).
