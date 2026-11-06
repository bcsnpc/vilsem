# Group C format additions (development, not a released contract)

All examples use `template.meta.formatVersion:4`, specVersion `0.7`, and native
renderer 4.40 or newer. Call validate_spec before preview. Exact field names
below are slot names, not DAX expressions. Transforms never rewrite the model.

## Expression geometry

An expression series uses `type:"custom"` and a renderItem JSON AST:
`{language:"vilsem-expression",version:1,root:{type:"rect",shape:{x:0,y:0,width:20,height:20},style:{fill:"$theme.textPrimary"}}}`.
See the expression-language resource for the full operation grammar and budgets.
No executable callback is accepted. Compilers operate on timeline baseOption
and options as well as root series, sharing one whole-visual resource budget.
Paths default to strokeNoScale:true. Use common x/y/scaleX/scaleY transforms to
place normalized paths; shape width/height fitting changes their meaning.

- `{as:"cells",mosaic:{x:"country",y:"category",value:"revenue",limit:200}}`
  gives `data` values `[left,bottom,width,height,weight,xIndex,yIndex,xName,yName]`.
  Joint weights determine area; this does not invent independence estimates.
- `{as:"curve",density:{by:"category",field:"price",layout:"violin",samples:32,expressionGeometry:true}}`
  adds geometryData `[left,top,width,height,index,path]` and geometryXMin/Max,
  geometryYMin/Max. Layout may instead be ridgeline. The path is an unused
  ordinal dimension; coordinate/scaling dimensions remain numeric.
- `{as:"packed",jitter:{by:"category",field:"price",method:"collision",expressionGeometry:true}}`
  adds expressionData `[price,packedY,radius,priceRange,packingWidth,packingHeight]`.
  Scale the radius for the actual plot dimensions; keep source rowIndexes.
- `{as:"labels",words:{text:"product",weight:"revenue",expressionGeometry:true}}`
  adds expressionData `[x,y,weight,fontSize,word,width,height]` without copying
  hidden legacy text styles. Label fonts must scale with the packed extent.
- `{as:"tree",hierarchy:{levels:["category","subcategory","product"],value:"revenue",layout:"partition",expressionGeometry:true}}`
  adds expressionData `[offset,depth,span,weight,name]` for a flame display.
- `{as:"bins",hexbin:{x:"price",y:"cost",bins:14,expressionGeometry:true}}`
  adds expressionData `[x,y,count,radiusX,radiusY,path]` and expressionX/YMin/Max.
  Cells are hexagonal in normalized data coordinates; affine pixel scaling can
  change their aspect. Counts and contributing row identities are preserved.
- `{as:"density",density2d:{x:"price",y:"cost",contourFractions:[0.2,0.4,0.6,0.8]}}`
  adds contourData `[x1,y1,x2,y2,threshold,levelIndex]`, contour bounds and levels.
  Marching squares uses an asymptotic saddle decider. Levels are fractions of
  peak KDE, **not probability/confidence regions**. Selection denotes local
  kernel contributors, not every entity geometrically inside a contour.
- `{as:"sets",setOverlaps:{value:"count",sets:[{name:"Black",field:"colour",equals:"Black"},{name:"Unisex",field:"style",equals:"U"}]}}`
  accepts two or three predicates and returns exact observed membership regions,
  inclusive set counts and schematic circle positions. Circle areas are not
  proportional to cardinalities; arbitrary exact Euler fitting is not provided.
- `{as:"cells",voronoi:{levels:["country","category"],value:"revenue",limit:80}}`
  returns weighted convex hierarchical cells with values
  `[cx,cy,weight,depth,colourIndex,isLeaf,path,label,labelWidth,labelHeight]`.
  Paths use unit-square coordinates with SVG Y inverted. Use numeric cx/cy for
  labels and common plot transforms for paths. Parent/leaf rowIndexes remain
  exact. At most 24 siblings, 128 nodes, two or three levels, sibling/root
  fractions at least 1e-7, 2 million geometric work units. Results exceeding
  0.1% relative area error are refused. Zero weights are omitted; negatives fail.

`$theme.readablePalette` is an opt-in palette adjusted toward at least 3:1
non-text contrast against a known opaque page background. `$theme.palette`
continues to preserve the report palette exactly. Unknown/translucent
backgrounds cannot guarantee contrast. `$theme.pageBackground` exposes the
known report background for explicit design decisions.

## Declarative motion and race frames

Animation lives alongside slots/transforms, outside the ECharts option:

```json
{"animation":{"enabled":true,"enter":{"duration":400,"easing":"cubicOut","delayByIndex":{"milliseconds":10,"max":500}},"update":{"duration":600,"easing":"cubicInOut"},"animationThreshold":5000}}
```

Durations are 0..30000 ms, stagger increments 0..1000 ms and stagger caps
0..30000 ms. Easing is a closed whitelist; see the expression/motion docs.
Animation and Reduce motion pane switches apply to nested timeline frames and
series, and the native renderer also observes prefers-reduced-motion.

`{as:"ranked",race:{time:"month",category:"country",value:"revenue",topN:10,history:12}}`
returns timeLabels, categories, maxValue and frames. Each frame contains name,
index, data, categories, timeLabels and line-history series. Marks have stable
id/name and source rowIndexes. Repeated time/category grains fail: ratios and
distinct counts must be computed by DAX, never silently summed. Missing history
observations remain null. Optional x/y slots must be supplied together; size
is optional and nonnegative. Frames <=120, topN <=100, history <=120, derived
points <=50000. Unknown transform settings fail validation.

Bind `baseOption.timeline.data:"$calc.ranked.timeLabels"` and
`options:{repeat:"$calc.ranked.frames",template:{yAxis:{data:"$item.categories"},series:[{id:"race",type:"bar",data:"$item.data"}]}}`.
For line history, repeat `$item.series`, using `$item.id`, `$item.name` and
`$item.data`. Bubble size can use a visualMap on dimension 2, not an arbitrary
symbolSize callback. Timeline and UniversalTransition modules are registered
in the web and native renderers. Live update retention, hidden-state behavior
and full motion acceptance remain under test; registration is not acceptance.

`preview_visual({...,frames:6})` returns a final timeline-state PNG, a bounded
APNG when feasible, and a sampled-state contact sheet. The APNG is <=3 seconds,
<=2 MiB and <=12 states / 12 million decoded pixels. These are discrete states,
**not captured browser interpolation**. Enter/update tween capture remains
unimplemented and is reported. Critique warns about sequences over 3 seconds
and timelines exceeding 60 states.

Tests: race-template-integration, race-transform, expression-geometry,
voronoi-layout, grid-geometry, expression-layout-data, set-overlaps,
animation-contract, animated-preview and MCP motion-preview. See regression
status for actual runs and native verification boundaries.
