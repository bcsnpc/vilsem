# Bounded expression series (GroupC development)

Status: implemented core interpreter/validator with focused/fuzz and real ECharts SVG tests; MCP/native integration and live stress acceptance are in progress. Not in published core/MCP0.6. Arbitrary JavaScript, renderItem strings/functions and registered third-party renderers remain prohibited.

## Envelope and authoring

Use template.meta.formatVersion4 and a custom series whose renderItem is:

```json
{"language":"vilsem-expression","version":1,"root":{"type":"circle","shape":{"cx":{"op":"at","args":[{"op":"coord","args":[[{"op":"value","args":[0]},{"op":"value","args":[1]}]]},0]},"cy":40,"r":5},"style":{"fill":{"op":"visual","args":["color"]}}}}
```

Bind real fields through the normal template slots and explicit series.data; use encode/dimensions to identify coordinates and tooltip values. Never copy query-result rows into a reusable template. Native identity comes from the series datum/dataIndex and contributing rowIndexes, not an arbitrary host object in this language. Transforms that lose source provenance need an explicit interaction warning.

An expression is a finite JSON scalar, an array (at most256items), or {op,args}. The op name is a literal from the table below. Arrays construct vectors/polygon points; they are not loops. The renderer envelope and element/property names are literal and allowlisted. $param.name and $theme.path resolve before execution; all data access during execution is through the listed API operations. $slot/$calc values belong in series.data/transforms, not in the expression's execution environment.

Strings beginning with a dollar sign need an explicit literal wrapper when they are text rather than tokens:

```json
{"op":"formatNumber","args":[{"op":"value","args":[1]},{"op":"literal","args":["$#,0.00"]}]}
```

The literal operation wraps one JSON scalar and never resolves its content as a token or source code. This removes ambiguity between currency/text and theme/parameter paths.

## Operations

Examples below use ordinary JSON; value(i) in descriptions means {op:"value",args:[i]}.

| Operation | Example args / result |
| --- | --- |
| literal | ["$not-a-token"] -> inert text |
| add | [2,3] ->5;2..16numeric operands |
| sub | [8,3] ->5 |
| mul | [2,3,4] ->24;2..16operands |
| div | [9,3] ->3;zero divisor is an error |
| mod | [9,4] ->1;zero divisor is an error |
| pow | [2,3] ->8;absolute exponent at most32 |
| neg | [3] ->-3 |
| abs | [-3] ->3 |
| sqrt | [16] ->4;negative input fails |
| floor | [2.7] ->2 |
| ceil | [2.1] ->3 |
| round | [2.6] ->3 |
| sin | [0] ->0;radians |
| cos | [0] ->1;radians |
| min | [2,1,3] ->1;1..16operands |
| max | [2,1,3] ->3;1..16operands |
| clamp | [10,0,5] ->5;reversed bounds fail |
| eq | [1,1] ->true;strict equality |
| ne | [1,2] ->true |
| lt | [1,2] ->true;numeric comparison |
| lte | [2,2] ->true |
| gt | [2,1] ->true |
| gte | [2,2] ->true |
| and | [true,false] ->false;short-circuit,2..16operands |
| or | [true,false] ->true;short-circuit,2..16operands |
| not | [false] ->true |
| if | [true,1,2] ->1;only the chosen branch executes;branch types must agree |
| coalesce | [null,0] ->0;first non-null value,2..8compatible operands |
| concat | ["Value ",42] ->"Value42";1..32scalar operands |
| string | [42] ->"42";objects never stringify into executable/implicit methods |
| number | ["42"] ->42;null/empty remain null;conversion must be explicit |
| length | [[1,2,3]] ->3;array/string only |
| at | [[10,20],1] ->20;integer indexes0..255, bounds checked;no object-property access |
| format | [1234,"#,0"] ->"1,234";alias for formatNumber |
| formatNumber | [0.2345,"0.00%"] ->"23.45%";bounded literal/parameter format |
| formatDate | ["2025-01-12","yyyy-MM-dd"] ->UTC date text |
| colorInterpolate | ["#000000","#ffffff",0.5] ->rgba midpoint;t clamps0..1 |
| colorScale | [5,0,10,["#000000","#ffffff"]] ->midpoint;palette1..32hex/rgb/rgba colours |
| dataIndex | [] ->params.dataIndex;no other params property is exposed |
| viewportWidth | [] ->api.getWidth();current visual width in logical pixels,0..1000000 |
| viewportHeight | [] ->api.getHeight();current visual height in logical pixels,0..1000000 |
| value | [0] ->api.value(0);integer dimensions0..255 |
| coord | [[x,y]] ->api.coord([x,y]);finite output pair |
| size | [[w,h]] or [[w,h],[x,y]] ->api.size range/optional anchor |
| visual | ["color"] ->api.visual("color");no other visual lookup is permitted |
| style | [] ->a filtered copy of api.style();no host object/reference escapes |

Use nested operation objects rather than textual arithmetic. Conditional branches are statically checked even when unreachable. API values are runtime checked because their types depend on real data; wrong types, division by zero, invalid coordinates and unknown tokens produce errors rather than invented zero values.

Viewport dimensions require core0.7.1 / renderer4.41 and are read again on each
render, including resize. They expose only bounded numbers, never a window,
DOM node, host object or additional property access. For a responsive inset
panel, use `min(25, viewportWidth/4, viewportHeight/4)` for its inset and subtract
twice that inset from each dimension. The shipped reference Figma example
contains the complete JSON AST. Keep decorative series `silent:true`, disable
their tooltip, and put them below data marks. The panel does not supply data
or change the plot's axes, values, identities or field bindings.

## Graphic elements

Output types: rect(x,y,width,height,optional r);circle(cx,cy,r);polygon(points);polyline(points,optional smooth);path(pathData,optional x/y/width/height);text;group(children). Shapes use the shape object. Required shape fields are checked. Width/height/radius must be nonnegative. Each coordinate/transform is finite and bounded in absolute value by1,000,000.

Common properties: x,y,scaleX,scaleY,originX,originY,rotation,z2,silent,invisible,ignore,id,name. Optional when is a boolean expression that omits the element when false. A clipPath may be a rect/circle/polygon/path;it is counted toward the element budget. Text roles label(default),title,annotation or mark determine which common pane overrides apply. Manual label visibility/font/format settings win;series selection/highlight opacity is multiplied into leaf styles even when authored opacity is1. An explicit api.style() does not double-apply dimming.

Allowed styles:fill,stroke,lineWidth,opacity,fontFamily,fontSize,fontWeight,text,x,y,width,height,lineHeight,align,verticalAlign,overflow,backgroundColor,lineDash,lineCap,lineJoin. Style.base may use api.style(). Images, URLs, HTML/foreign objects, event handlers, filters and shadows are not output capabilities. Text remains escaped text, including strings resembling HTML. Font size1..200, bounded dash patterns and finite style numbers are enforced. Interpolated colours require hex/rgb/rgba;ordinary colour styles may use safe CSS colour names too.

SVG paths are parsed before reaching the drawing engine:must begin with M/m,match command arities (M/L/H/V/C/S/Q/T/A/Z),use finite bounded coordinates and legal arc flags. Paths contain no markup,URLs or executable content. Invalid or incomplete commands fail.

## Resource and security limits

- JSON nesting32;16,000preflight nodes;keys at most128characters;aggregate key/string content at most1,048,576UTF-16code units. Transport/JSON parsing still has its own process-level resource cost.
- At most2,000graphic elements per datum,50,000potential elements across all expression series. Clip shapes count. The whole-visual check conservatively multiplies static maximum output by data count;conditional hiding does not bypass the bound.
-50,000evaluation steps per datum;whole-visual conservative estimated cost2,000,000. Trusted callers can lower the per-item step ceiling, never raise it. The language cannot request larger budgets.
- Strings8,192characters;display text2,048;paths8,192with at most512commands/2,048numbers;arrays256except bounded group child lists. Paths/text are charged in conservative cost estimates.
- Explicit bounded series.data arrays are required. Dataset indirection and arbitrary callbacks are not expression input surfaces. Every execution is stateless;resize/filter renders cannot accumulate a mutable program state.

There are no variable bindings,assignment,loops,recursive calls,closures,imports,eval,Function constructor,DOM,network,filesystem,credentials or model-connection capabilities. Structural traversal in trusted code is bounded;it does not create user recursion. Arrays support construction and indexed lookup,not map/reduce over arbitrary input. Prototype names,accessors,custom array methods,cycles and non-JSON objects are rejected. Validated ASTs are copied and frozen so later caller mutation cannot change executed instructions.

This is a closed interpreter inside the existing renderer,not an operating-system isolation boundary. A compromised trusted renderer/ECharts dependency or malicious host API is outside the language's guarantee. Bounded work does not promise every permitted chart achieves60fps;performance must be measured separately. Report bindings/policies remain Power BI's responsibility. There is no claim that arbitrary literals in a visual cannot reveal data intentionally selected for display.

The shared interpreter serves SSR and native rendering. ECharts manages graphic drawing/identity from each custom series datum;see the [Apache custom-series contract](https://github.com/apache/echarts-doc/blob/master/en/option/series/custom.md). Native screenshots/interactions and lifecycle completion remain separate acceptance gates.

## Paths, coordinates and screen-pixel strokes

An axis-mapped ECharts dimension is numeric storage: put textual path data in
an unused ordinal dimension, after the numeric coordinates/ranges. Mapping
the path string to an axis producesNaN and is rejected at runtime. For a
normalized path use common x/y/scaleX/scaleY transforms instead of fitting
every group's path to a full-plot shape.width/height rectangle; fitting each
path separately loses its actual group placement.

Strokes default to strokeNoScale:true so lineWidth remains a screen-pixel
width when unit-square geometry scales to the plot. A boolean
style.strokeNoScale:false explicitly requests geometric scaling. Other values
are rejected. This avoids a1.5-unit outline becoming hundreds of pixels wide.
Actual ECharts tests assert separate group positions and transformed bounds,
not merely a successful setOption call.

Templates use text-only richText tooltips. Model strings resembling HTML are
painted as text; an explicit HTML tooltip renderer is refused with a pointer.
Native Power BI tooltipService still receives plain text and selection IDs.
Trusted composition tooltip implementations are a separate existing surface.
