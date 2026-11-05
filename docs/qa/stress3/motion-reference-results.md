# Group C motion and reference acceptance

Updated 2026-11-05. All entries below use actual Desktop-model queries and newly
authored templates. PASS means validate_spec, explain_visual, preview_visual
and commit_visual succeeded. It does not mean Power BI rendered the visual.
Evidence is private under vilsem-mcp/test-results/stress3; shipped JSON templates
contain bindings and declarative instructions, not model result snapshots.

| Motion exercise | Tool cycle | Motion evidence | Native |
|---|---|---|---|
| Bar race over months | PASS | Browser-clock APNG | Unverified |
| Line race with trailing labels | PASS | Browser-clock APNG | Unverified |
| Bubble race | PASS | Browser-clock APNG | Unverified |
| Racing treemap | PASS | Browser-clock APNG | Unverified |
| Timeline tile heatmap | PASS | Browser-clock APNG; axis/colorbar spacing corrected | Unverified |
| Reweighted Sankey | PASS | Browser-clock APNG | Unverified |
| KPI count-up and sparkline | PASS, final retry | Last browser APNG frame and settled PNG inspected: both show $24,914,587, model currency format and aggregate source IDs | Unverified |
| Bar/pie/scatter morph | PASS | Browser-clock APNG | Unverified |
| dataZoom autoplay | PASS, 911-row final retry | Browser-clock APNG; slider spacing corrected; inherited currency axes fixed and inspected in PNG/APNG | Unverified |
| Staggered 50-category entry | PASS | Browser-clock APNG | Unverified |

The browser uses a fresh sandboxed profile with outbound page/WebSocket traffic
blocked and credentials excluded. A controlled clock captures actual canvas
interpolation; it does not measure frame rate. The APNG is capped at three
seconds and two MiB; long timelines are explicitly marked truncated. Contact
sheets show sampled settled states independently of the motion capture.

| Reference exercise | Tool cycle | Interpretation and limits | Native |
|---|---|---|---|
| Official Tableau bar-chart reference | PASS | Chronological bars bound to actual available years, not copied reference numbers | Unverified |
| Authored Figma-style mockup | PASS | Original mockup, not an imported Figma document; six markets and palette matched, outer-card styling partial | Unverified |
| Licensed whiteboard photograph | PASS | Experiment-note layout adapted to revenue/profit cards; no claim that the model contains the photographed experiment | Unverified |

Tableau reference: https://help.tableau.com/current/pro/desktop/en-us/buildexamples_bar.htm
Whiteboard photograph: Steven (WMF), CC BY-SA 3.0,
https://commons.wikimedia.org/wiki/File:Data_analysis_notes,_Wikimedia_Foundation.jpg
No photographed values, invented business fields or raw model rows are shipped.

The 5,000-point performance requirement remains FAIL. Regular canvas measured
24.92 RAF fps, p95 72.2 ms. A QA-only batching prototype measured 55.95 fps,
p95 18.2 ms; the threshold is >=57 fps and <=20 ms p95. It is not enabled in the
product and neither measurement represents the Power BI host. See
[the engineering adoption gates](../../engineering/batch-motion.md).

Native checks remain blocked by unsaved Desktop state and unavailable Computer
Use capture. Reload refuses to discard unknown edits. No physical gesture,
bookmark, report-page tooltip or PDF/subscription behavior is inferred from
automated host stubs or SSR images.
