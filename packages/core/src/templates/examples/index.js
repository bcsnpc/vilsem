// Playground Spike — the starter library, authored purely as `.vilsem-visual`
// templates (no per-visual React/JS). The first three (kpi_sparkline, bullet,
// lollipop) also feed the AI few-shot, so keep them first. The rest are the
// trial winners promoted to first-class starters.

import kpiSparkline from './kpi_sparkline.vilsem-visual.json' with { type: 'json' }
import bullet from './bullet.vilsem-visual.json' with { type: 'json' }
import lollipop from './lollipop.vilsem-visual.json' with { type: 'json' }
import radialBar from './radial_bar.vilsem-visual.json' with { type: 'json' }
import rose from './rose.vilsem-visual.json' with { type: 'json' }
import donut from './donut.vilsem-visual.json' with { type: 'json' }
import heatStrip from './heat_strip.vilsem-visual.json' with { type: 'json' }
import divergingBar from './diverging_bar.vilsem-visual.json' with { type: 'json' }
import dumbbell from './dumbbell.vilsem-visual.json' with { type: 'json' }
import rangeBar from './range_bar.vilsem-visual.json' with { type: 'json' }
import pictogram from './pictogram.vilsem-visual.json' with { type: 'json' }
import calendarHeatmap from './calendar_heatmap.vilsem-visual.json' with { type: 'json' }
import heatmap2d from './heatmap_2d.vilsem-visual.json' with { type: 'json' }
import kpiDelta from './kpi_delta.vilsem-visual.json' with { type: 'json' }

// Order matters: the AI few-shot destructures the first three.
export const EXAMPLE_TEMPLATES = [
  kpiSparkline, bullet, lollipop,
  radialBar, rose, donut, heatStrip, divergingBar, dumbbell, rangeBar, pictogram, calendarHeatmap, heatmap2d, kpiDelta,
]

export { kpiSparkline, bullet, lollipop, radialBar, rose, donut, heatStrip, divergingBar, dumbbell, rangeBar, pictogram, calendarHeatmap, heatmap2d, kpiDelta }
