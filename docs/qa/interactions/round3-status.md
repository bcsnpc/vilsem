# Round3 native interaction checks

Private QA report only; original supplied PBIP/model untouched. These checks do not certify Service or every visual family.

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Vilsem bar to native card | PASS | `round3-custom-bar-native-card.png`: Bikes selects, other marks dim, card changes from $25M to $24M. Real model Bikes revenue is 23,642,495.0952. |
| Additive selection to native card | PASS (keyboard); mouse Ctrl-click not yet tested | `round3-exact-multi-sum.png`: Bikes plus Accessories displays24,549,168.20 in the unscaled native card, matching23,642,495.0952 +906,673.107. Initial modern card rounded both sum and total to25M; replacing the QA-only native card with an unscaled legacy card resolved the evidence ambiguity. Ctrl+Left/Ctrl+Enter targeted the second source row. Earlier Ctrl+Right selected the already-selected Bikes row and cleared selection; that was an automation assumption about source/display order, not a host aggregation failure. |
| Native slicer to Vilsem | PASS with follow-up | `round3-native-slicer-filter.png`: Clothing reduces Vilsem to one category and card to $365K. A dim surviving bar prompted the stale-highlight investigation; rebuilt transition check remains pending. |
| Native bar to Vilsem cross-highlight | PASS | `round3-native-bar-highlight.png`: Accessories remains opaque, Bikes/Clothing dim while all categories remain. |
| Edit interactions None | PASS | Used Desktop Format > Edit interactions > None on the Vilsem target. `round3-slicer-none-changed.png`: Accessories filters native card/bar ($907K) while Vilsem retains all three categories. Saved PBIR confirms `NoFilter`. |
| Native formatted tooltip | PASS for percentage fixtures | `../stress3/native-format-acceptance.md`: actual host tooltips observed as 23.45% and 62.84%; labels and axes captured separately. |
| Configured drill-through | PASS | Right-click Bikes in the Vilsem bar > Drill through > Stress3 Category Detail. Native card shows24M and Desktop Filters pane explicitly shows CategoryName is Bikes. `round3-drillthrough.png`; no model changes. |
| Report-page tooltip | PASS | Assigned Category Tooltip using native Properties > Tooltips. Hover Bikes in Vilsem: native report-page overlay shows revenue23,642,495, profit9,726,168, orders13,929, returns427, rate3.08% and weekly trend. `round3-report-page-tooltip.png` is a native-window capture cropped only to omit the account/title strip; provenance JSON retained. The bridge-only configured-canvas capture omits this overlay. |
| Bookmark recall | PASS | Captured native Bookmark6 with Bikes selected (23,642,495.10); changed to Accessories (906,673.11), then recalled Bookmark6. Native card returns23,642,495.10 and Bikes opacity/other-mark dimming restores. `round3-bookmark-changed.png` and `round3-bookmark-restored.png`. Existing bookmarks untouched. |

Host automation: SDK `powerbi-visuals-utils-testutils` categorical builders now drive composition and template fixtures. Click/Ctrl/clear, source identities after sorting, highlights, native tooltip, context menu, keyboard, bookmark callback, filtered-empty and resize-without-requery are exercised in `tests/power-bi-selection-runtime.test.ts`. Expression-series coverage is deferred until Group C implements that layer.

STRESS3-INT-001: stale IDs plus a positive highlight reproduced opacity0.25 instead of1 in both composition/template tests (`cache/round3-stale-highlight-before.log`). The source fix branches on visible matching identities; 92 targeted tests pass (`cache/round3-stale-highlight-after.log`). Native verification remains distinct from this unit result.
