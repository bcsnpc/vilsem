// Shared chart chrome only. Value-card typography remains owned by its renderer.
// Keep existing chart defaults; explicit saved formatting wins in every host.
export function chartTitleStyle(config = {}, defaultColor) {
  return {
    fontSize: config.titleFontSize || 12,
    fontWeight: config.titleFontWeight ?? 600,
    color: config.titleColor || defaultColor,
    fontFamily: config.titleFontFamily || 'inherit',
    textTransform: config.titleUppercase ? 'uppercase' : 'none',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}
