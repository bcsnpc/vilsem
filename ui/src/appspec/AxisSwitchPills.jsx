/**
 * AxisSwitchPills — single source of truth for axis-switch pill buttons.
 *
 * Rendered at the top-right of a chart card's title header when
 * `config.axisOptions` has 2+ valid entries ({ label, groupBy: { table, column } }).
 *
 * USED BY (every render path must import this, never inline the JSX):
 *   1. AppSpecRenderer.jsx — GridLayout edit mode
 *   2. AppSpecRenderer.jsx — view mode, freeform layout branch
 *   3. AppSpecRenderer.jsx — view mode, section layout branch
 *   4. CanvasEditor.jsx    — freeform pixel-drag edit renderer
 *
 * Web export uses AppSpecRenderer so it inherits for free. PBI DAX mirrors the
 * HTML structure separately in ui/src/pages/powerbi/daxTemplateBuilder.js.
 *
 * If you add a new render path, import this component here — don't inline.
 */
export default function AxisSwitchPills({
  visual,
  axisOverride,
  onPick,
  colorVal,
  mutedColor,
  borderColor,
  fontFamily,
  /** stopPropagation on click — needed in edit mode to prevent card-select */
  stopClickPropagation = false,
}) {
  const rawAxisOpts = Array.isArray(visual?.config?.axisOptions) ? visual.config.axisOptions : []
  const validAxisOpts = rawAxisOpts.filter(o => o?.groupBy?.table && o?.groupBy?.column)
  if (validAxisOpts.length < 2) return null

  return (
    <div data-axis-switch-pills style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {validAxisOpts.map((opt, oi) => {
        const isActive = axisOverride
          ? (axisOverride.table === opt.groupBy?.table && axisOverride.column === opt.groupBy?.column)
          : (visual.data?.groupBy?.table === opt.groupBy?.table && visual.data?.groupBy?.column === opt.groupBy?.column)
        return (
          <button
            key={oi}
            data-axis-pill-idx={oi}
            onClick={(e) => {
              if (stopClickPropagation) e.stopPropagation()
              if (!isActive && opt.groupBy?.table && opt.groupBy?.column) {
                onPick(opt.groupBy)
              }
            }}
            style={{
              border: isActive ? `1px solid ${colorVal}66` : `1px solid ${borderColor}`,
              cursor: isActive ? 'default' : 'pointer',
              padding: '3px 10px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: isActive ? 600 : 500,
              background: isActive ? `${colorVal}22` : 'transparent',
              color: isActive ? colorVal : mutedColor,
              transition: 'all 0.15s',
              lineHeight: '18px',
              whiteSpace: 'nowrap',
              fontFamily: fontFamily || 'inherit',
            }}
          >
            {opt.label || opt.groupBy?.column || 'axis'}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Helper: returns the effective groupBy for a visual given the current
 * axisOverrides state. Use consistently so no path accidentally reads
 * the raw spec groupBy when an override is active.
 */
export function getEffectiveGroupBy(visual, axisOverrides) {
  const override = axisOverrides?.[visual?.id]
  if (override?.table && override?.column) return override
  return visual?.data?.groupBy
}
