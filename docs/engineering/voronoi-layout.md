# Bounded weighted Voronoi layout (Round3 development)

The expression interpreter draws polygons; a trusted core data transform must
compute them. This is a fixed numerical algorithm, not authored renderItem code.
Input is2..3 category levels and a nonnegative additive measure. Zero weights
are omitted. Each leaf/ancestor retains its original contributing row indexes.

For each sibling group, compute convex power cells by half-plane clipping.
Solve cell weights with a damped Newton method using shared-edge derivatives;
backtrack steps that empty a cell or increase residual error. Fix one weight
to remove the additive gauge. Deterministic interior sites and two centroid
relaxations make the layout repeatable without randomness. Solve each parent
in its normalized bounding box, then map its cells back to the report plane.

Limits:24 siblings,128 nodes,10000 input rows,80 Newton iterations per solve,
three relaxation passes and2000000 shared geometric work units. Fractions
below1e-7 of the root are refused rather than advertised as accurate invisible
polygons. Failure to converge is an explicit error. No partial layout is
returned or committed. Every returned node must meet0.1% relative area error
against its root-normalized weight; local solves use a tighter tolerance.

Output contains bounded numeric path strings, centroids, inscribed label boxes,
source identities and quantitative error diagnostics. Paths use common graphic
transforms so fitting each shape does not erase its location. Stroke widths
stay in screen pixels. Label rectangles fit inside an inscribed circle and
are clipped to their own cell. Tooltips retain full names; displayed names are
bounded. An empty/nonpositive input gets a separate empty-state datum.

Tests must verify weighted areas, disjoint cells, determinism, hierarchy/lineage,
empty/negative/precision-limit cases and actual SVG placement. Live acceptance
uses the owned Desktop model, then validate/explain/preview/commit on Stress3.
Native screenshots/interactions remain a separate gate.
