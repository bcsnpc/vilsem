# Stress round 2 — visual-scoped measures + 120-visual expressiveness sweep

Power BI Desktop is open with a PBIP. Use desktop mode (fall back to the configured Fabric model only if Desktop is unreachable, and say so). Do every step yourself, in order. Do not ask whether a step is already done — check, and do it if not.

## Task 1 — Visual-scoped measures (do first; Task 2 depends on it)

Add the ability for a visual spec to declare its own measures as DAX expressions, compiled into a `DEFINE MEASURE` block in that visual's query, never written to the model.

- Spec shape: `"measures": { "Profit Margin": "DIVIDE([Profit],[Revenue])", "Prior Year": "CALCULATE([Revenue], SAMEPERIODLASTYEAR('Date'[Date]))" }`. Declared names are referenced in slots exactly like model measures.
- `explain_visual` returns the full DAX including the DEFINE block.
- `validate_spec` checks every visual-scoped measure parses, and references only tables/columns/measures that exist in the schema (or other visual-scoped measures in the same spec, with cycle detection).
- `preview_visual` and `commit_visual` carry the measures through; the renderer's runtime query must produce the same values as the SSR preview (add a test that compares both against the same fixture).
- Document in `vilsem://docs/spec-format` with three examples: a ratio, a time-intelligence measure, a ranking measure.
- Do NOT add any tool or code path that writes measures to the model (TMDL). In the README "What this does NOT do" section add: "persist measures to the model — declare a visual-scoped measure instead, or use Microsoft's Power BI Modeling MCP to add one to the model."
- Unit tests, plus one live Desktop pass: a visual with a derived margin measure committed and shown with real numbers.

## Task 2 — Expressiveness sweep

Method for EVERY visual below, exactly as the Expressiveness round: acting as the calling agent would, author a NEW `.vilsem-visual.json` from scratch (never reuse a shipped template as a starting file), bind to real fields from `get_schema` (use visual-scoped measures from Task 1 whenever a derived value is needed), run `validate_spec` → `explain_visual` → `preview_visual` → `commit_visual` to page `Stress2-<tier>` (one page per tier, max 12 visuals per page; create `Stress2-A1`, `Stress2-A2`, … as needed), accept the Desktop reload, and verify in Desktop. Every PASS requires a Desktop screenshot saved under `docs/qa/stress2/<nn>-<slug>.png`.

Classify every failure:
- **(a)** missing template token, formatter, option passthrough or layout feature
- **(b)** missing data-shaping capability (window/derived series, binning, percentiles, top-N+Other, pivot/unpivot, cross-join, cumulative, rolling, rank, previous period, percent-of-total, normalisation, sampling)
- **(c)** requires imperative logic (`renderItem` custom series, executable callbacks) or a capability outside ECharts' declarative option (geo without a shipped map, 3D/GL, streaming)

Fix EVERY (a) and (b) in `@vilsem/core` — add the token/transform, document it in `vilsem://docs/spec-format`, add a unit test, make the renderer support it at runtime — then re-run that visual until it passes. For (c), do NOT implement; append to `docs/expressiveness-gaps.md` with the exact refusal and what a sandboxed extension would need. If a visual is borderline (e.g. quartiles, bins, density, Voronoi), argue in the report whether it is (b) or (c) and act on your conclusion; prefer (b) when a bounded, declarative data transform would do it.

Save every passing template under `templates/` in vilsem-mcp as a shipped example with a one-line description. Keep model-definition files byte-identical; verify at the end.

### Tier A — ECharts-native series; expected to pass with little or no format change

1. Step line (start/middle/end step)
2. Spline line with area gradient fill
3. Multi-series line with 7-day rolling average overlay (rolling → (b) if missing)
4. Line with confidence band (upper/lower measures as filled area)
5. Fan chart (nested percentile bands around a median line)
6. Horizon chart (layered bands per row, small multiples)
7. Sparkline grid: 3×3 KPI tiles, each a sparkline from a date column
8. Stacked 100% column with inline percentage labels
9. Diverging stacked bar (Likert-style, centred at zero)
10. Population pyramid / butterfly (two measures, opposite directions)
11. Grouped + stacked combination (clustered by series, stacked by sub-series)
12. Lollipop with target markers
13. Dot plot (Cleveland) with two measures per category
14. Range bar with delta label
15. Wrapped bar (long category list split into columns)
16. Barcode / strip plot of raw values per category
17. Polar bar (radial column) with category labels
18. Nightingale rose
19. Semi-circle donut with centre KPI
20. Nested donut (two levels)
21. Pie with small slices grouped as "Other" (top-N → (b) if missing)
22. Pictogram with repeated icons (bounded repeat)
23. Waffle chart (10×10, percent of total)
24. Parliament / hemicycle seat chart
25. Bullet with target + three qualitative bands + delta text
26. Linear gauge with thresholds
27. Multi-ring progress (nested radial progress for three measures)
28. Gauge with bands driven by a visual-scoped target measure
29. Combo: column + line, dual axis, reference line from a measure
30. Pareto: sorted bars + cumulative % line + 80% reference line
31. Waterfall with subtotals at category boundaries
32. Double waterfall (two periods side by side)
33. Bridge chart (start value → deltas → end value) with connectors
34. Candlestick/OHLC from four measures by date, with volume bars below
35. Heikin-Ashi (derived OHLC → (b))
36. Heatmap matrix, two categories, diverging scale centred at zero
37. Calendar heatmap, one year, weekday rows, colour by visual-scoped measure
38. 1-D heatmap / heat strip by date
39. Lasagna plot (one heat strip per category, stacked)
40. Treemap two levels, colour by second measure
41. Treemap with drill (breadcrumb)
42. Sunburst three levels, size by measure
43. Icicle chart (partition)
44. Circle packing (nested bubbles)
45. Tree diagram (orthogonal) from parent/child columns
46. Radial tree
47. Indented tree / org chart from manager/employee columns
48. Dendrogram-style tree with leaf values
49. Sankey between two category levels
50. Sankey three levels with node ordering by value
51. Alluvial / parallel sets (categorical flows, multiple axes)
52. Chord diagram of flows between categories
53. Non-ribbon chord (arc links only)
54. Arc diagram (nodes on a line, arcs for links)
55. Force-directed network from a relationship table, node size by measure
56. Circular layout network
57. Adjacency matrix from a relationship table
58. Bipartite graph (two columns of nodes)
59. Radar with benchmark series overlaid
60. Radar small multiples (one per category)
61. Parallel coordinates across six measures
62. Scatter with quadrant lines at medians, outlier labels, bubble size by third measure (median → (b))
63. Connected scatter (points ordered by date, path drawn)
64. Scatter matrix / pair plot of four measures (facets)
65. Bubble chart with categorical colour and legend
66. Bump chart (rank over time; rank → (b) if missing)
67. Slope chart two periods, top-5 movers highlighted
68. Streamgraph (stacked area, wiggle offset, smoothing)
69. Stacked area with percent normalisation
70. Cumulative flow diagram (stacked area of states over time)
71. Gantt with start/duration, grouped by owner, today marker
72. Timeline of events with annotations from a text column
73. Funnel with conversion % between stages
74. Mirrored funnel (two segments compared)
75. Quadrant / BCG matrix with labelled quadrants
76. Dual-axis with independent zoom slider
77. Line with markArea bands for weekends/holidays
78. Column with error bars from min/max measures
79. Control chart (mean ± 3σ lines from a visual-scoped measure)
80. CUSUM / EWMA chart (cumulative or exponentially weighted → (b))
81. Forest plot (estimate + CI per category)
82. Dot-and-whisker plot
83. Small multiples of bar chart per category, shared y-axis
84. Small multiples of line chart per category, free y-axis
85. KPI card with sparkline, delta vs prior period, conditional colour
86. Ranked list with inline bars (table-like bar chart)
87. Marimekko (expected (c) — re-confirm after any new tokens)
88. Mosaic plot (expected (c) — same reason)

### Tier B — needs statistical/data shaping; decide (b) vs (c) and act

89. Histogram with auto bins from a numeric column
90. Histogram with manual bin width parameter
91. Box plot per category from a detail-level column (quartiles, whiskers, outliers)
92. Violin plot (density → likely (c))
93. Beeswarm / jitter plot (collision layout → likely (c))
94. Strip plot with mean marker
95. ECDF plot
96. Density / ridgeline plot (kernel density → likely (c))
97. Q-Q plot against normal (quantiles → decide)
98. Hexbin scatter (binning in 2-D → decide)
99. Contour / 2-D density heatmap (→ likely (c))
100. Top-N with "Other" bucket donut, N as a parameter
101. Percent-of-total by group with group subtotals
102. YoY comparison bars with variance labels and conditional colour
103. Month-over-month index chart (all series rebased to 100)
104. Running total vs same-period-last-year running total
105. Cohort retention heatmap (cohort × period from a date column)
106. Pivoted heatmap from long-format data (pivot → (b))
107. Correlogram / correlation heatmap across six measures (Pearson → decide)
108. Pareto 80/20 with category count annotation
109. Spike histogram by date
110. Radial histogram (polar bins)

### Tier C — expected (c) or environment-limited; attempt once, classify, do not force

111. Choropleth map (region column → shaded regions) — (c) unless a shipped map asset exists
112. Bubble map from lat/long columns
113. Geo heatmap from lat/long
114. Flow map (origin → destination lat/long)
115. Tile grid map (US states / EU countries as fixed grid; may be (a) if layout tokens suffice)
116. Word cloud from a text column weighted by measure
117. Voronoi treemap
118. Flame chart from a hierarchical call-stack-like column set
119. 3-D bar / surface
120. Venn / Euler of set overlaps

## Final report

1. PASS/FAIL table for all 120, with (a)/(b)/(c) and one-line reason per failure.
2. Every token, formatter, transform and layout feature added to the format, with doc links.
3. The (c) list with the exact refusal message each produced.
4. Confirmation that all model-definition files are byte-identical before and after.
5. Test counts for both repos; dependency audit result.
6. Cut `@vilsem/core` and `vilsem-mcp` releases (minor bump), merge to `main`, push both repos, and list the tags.
