# Remaining Power BI renderer work

## Implemented in this cycle
Funnel, Waterfall, Heatmap, Ranked List, Chord, Sankey, Sunburst, Narrative and Insight reuse their existing React components through the isolated Power BI DOM adapter. Native adapter checks and package-boundary tests pass. These are current-app rendering contracts, not certification of chart semantics or every property.

Sankey currently shares the app Chord renderer; Sunburst currently renders one ring. These existing limitations are not corrected by export support. No DOM mark-selection callbacks are added by this adapter.

## Six types still gated
| Type | Required work before enabling |
|---|---|
| kpi | Host-bound time-series contract for optional sparkline; no window.semantica queries in a Power BI sandbox; retain title and scalar semantics. |
| sparkline_kpi | Required time-series binding and correct scalar total; never silently omit the sparkline or sum ratios/distinct counts. |
| nav_button | Power BI-specific page/URL/filter routing; modal navigation has no current host equivalent. |
| text_box | Bound measures for live tokens, safe rich-text rendering, no-data lifecycle. |
| image | No-data lifecycle, supported image loading in sandbox, PBIR mapping. |
| custom | Carry and validate declarative template in package/spec, retain parameters and interactions, use supported sandbox renderer. |

Shape and Divider now have verified no-data lifecycle and direct PBIR export. The generic package retains its data mapping; landing-page/empty-data capabilities allow static objects to receive formatting without measure fields. Legacy generated-measure mapping remains unchanged by default. Image/text/custom/navigation still need their own contracts before enablement.

## Implementation routes reviewed (2026-09-12)

- **Image:** reuse CompactImage for embedded images through the new no-data lifecycle. Remote images require declared WebAccess and permission handling, or explicit export-time embedding with size/type validation. Test contain/cover/fill, opacity, corners, broken URLs and resource persistence in Service and Desktop before enabling the whole type. Current component only lowers opacity on load failure; that is insufficient recovery feedback.
- **Text box:** separate rich-text rendering from the editor/query transport. Extract data-measure tokens into exported measure projections and inject host-evaluated scalar values; keep DOMPurify and existing formatting. Test repeated tokens, null/zero, filters and mixed styles. Static text alone does not establish live-token support.
- **KPI / Sparkline KPI:** inject host-provided time-series data into CompactKpi instead of calling window.semantica. Bind scalar totals independently from grouped series, particularly for ratios and distinct counts. Test chronological order, missing dates, comparison values and filter resets. Summing category values is not a valid general total implementation.
- **Navigation:** route URL actions through host.launchUrl; investigate native PBIR page/bookmark buttons for report navigation. Existing app modal and filter callbacks need separate contracts. A working URL button cannot be treated as complete navigation parity.
- **Custom:** serialize a validated declarative template and its parameters, then mount the existing renderer in the sandbox. Resolve stripped runtime template fields and test filtering, theme and resource dependencies before opening the export gate.

These are implementation routes, not verified support. Microsoft documents external-resource privileges and URL launching here:
- https://learn.microsoft.com/en-us/power-bi/developer/visuals/capabilities
- https://learn.microsoft.com/en-us/power-bi/developer/visuals/permissions-api
- https://learn.microsoft.com/en-au/power-bi/developer/visuals/launch-url
