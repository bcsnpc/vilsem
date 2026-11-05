import { getThemeTokens } from '../../dist/theme.js'
import { contrastingText } from './colourContrast.js'

// Shared by the sandboxed visual and headless preview. No filesystem or host
// globals: report-file discovery lives in the separate PBIR adapter.
export const DEFAULT_REPORT_THEME = Object.freeze({
  background: '#ffffff', foreground: '#252423', fontFamily: 'Segoe UI',
  dataColors: ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300', '#D64550', '#197278', '#1AAB40'],
})
const colour = value => typeof value === 'string' && /^(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|rgba?\(\s*[\d.%]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+(?:\s*,\s*[\d.%]+)?\s*\)|transparent)$/i.test(value) ? value : undefined
const hostColour = value => colour(value?.value ?? value)
function darkBackground(value) {
  return contrastingText(value,'') === '#ffffff'
}
export function reportThemeFromHost(host = {}) {
  const p = host.colorPalette || {}
  const foreground = hostColour(p.foreground) || DEFAULT_REPORT_THEME.foreground
  const background = hostColour(p.background) || DEFAULT_REPORT_THEME.background
  const dataColors = []
  for (let i = 0; i < 12; i++) {
    try { const value = hostColour(p.getColor?.(String(i))); if (value) dataColors.push(value) } catch { break }
  }
  return { foreground, background, foregroundNeutralTertiary: p.isHighContrast ? foreground : hostColour(p.foregroundNeutralTertiary), dataColors: p.isHighContrast ? [foreground] : dataColors.length ? dataColors : DEFAULT_REPORT_THEME.dataColors }
}
export function resolveReportTheme(spec = {}, context = {}) {
  const explicit = context.useReportTheme !== true && ['light', 'dark'].includes(spec.canvasTheme) ? spec.canvasTheme : null
  const requested = explicit || context.theme || 'light'
  const json = typeof requested === 'object' && requested !== null ? requested : {}
  const background = colour(json.background) || (requested === 'dark' ? '#0b0b12' : DEFAULT_REPORT_THEME.background)
  const mode = requested === 'dark' || darkBackground(background) ? 'dark' : 'light'
  const base = getThemeTokens(mode)
  const foreground = colour(json.foreground) || (mode === 'dark' ? '#f2f2f2' : DEFAULT_REPORT_THEME.foreground)
  const font = json.fontFamily || json.textClasses?.label?.fontFace || json.textClasses?.callout?.fontFace || DEFAULT_REPORT_THEME.fontFamily
  const fontFamily = typeof font === 'string' && font.length < 200 && !/[;{}<>]/.test(font) ? font : DEFAULT_REPORT_THEME.fontFamily
  const supplied = Array.isArray(json.dataColors) ? json.dataColors.filter(colour).slice(0, 64) : []
  const palette = supplied.length ? supplied : DEFAULT_REPORT_THEME.dataColors
  const grid = colour(json.foregroundNeutralTertiary) || (mode === 'dark' ? '#555555' : '#dddddd')
  return { mode, background, foreground, fontFamily, palette, explicit: !!explicit, tokens: {
    ...base, canvasBg: explicit ? background : 'transparent', echartsBg: explicit ? background : 'transparent', textPrimary: foreground, textSecondary: foreground,
    textMuted: foreground, echartsTextColor: foreground, echartsLegendText: foreground,
    gridStroke: grid, gridStrokeOn: grid, axisLine: grid, axisTick: foreground, splitLine: grid,
    echartsAxisColor: grid, echartsSplitColor: grid,
  } }
}

// Fill missing structural styles, never overwrite a deliberate user colour.
// Composers receive the same tokens before this step, so their built-in defaults
// are already report-aware. Caller-owned spec/option objects are not mutated.
export function applyReportTheme(option, theme, { palette = false } = {}) {
  if (!option) return option
  const out = { ...option, backgroundColor: option.backgroundColor == null || option.backgroundColor === 'transparent' ? (theme.explicit ? theme.background : 'transparent') : option.backgroundColor,
    textStyle: { color: theme.foreground, fontFamily: theme.fontFamily, ...option.textStyle },
    color: option.color ?? theme.palette }
  const styleAxis = axis => ({ ...axis, axisLabel: { color: theme.foreground, ...axis.axisLabel },
    nameTextStyle: { color: theme.foreground, ...axis.nameTextStyle },
    axisLine: { ...axis.axisLine, lineStyle: { color: theme.tokens.axisLine, ...axis.axisLine?.lineStyle } },
    splitLine: { ...axis.splitLine, lineStyle: { color: theme.tokens.gridStroke, ...axis.splitLine?.lineStyle } } })
  for (const key of ['xAxis', 'yAxis', 'singleAxis', 'radiusAxis', 'angleAxis']) {
    if (out[key]) out[key] = Array.isArray(out[key]) ? out[key].map(styleAxis) : styleAxis(out[key])
  }
  for (const key of ['title', 'legend']) if (out[key]) {
    const style = item => ({ ...item, textStyle: { color: theme.foreground, fontFamily: theme.fontFamily, ...item.textStyle } })
    out[key] = Array.isArray(out[key]) ? out[key].map(style) : style(out[key])
  }
  if (Array.isArray(out.series)) out.series = out.series.map(s => {
    // Attached in-mark labels use ECharts/zrender's actual path-fill contrast
    // calculation when colour is unspecified. Forcing the page foreground here
    // makes dark text disappear on dark cells, even on a white report page.
    const inside=String(s.label?.position || '').startsWith('inside') || ['heatmap','treemap','sunburst','funnel'].includes(s.type)
    let label=inside ? {...s.label} : { color: theme.foreground, ...s.label }
    let upperLabel=s.upperLabel
    // Treemap supplies its own white default, even on bright cyan nodes. Its
    // formatter receives the actual post-mapping node colour; do not duplicate
    // ECharts' hierarchical colour interpolation or guess from series indexes.
    if(s.type==='treemap' && label.color==null && typeof label.formatter!=='string'
      && (label.position==null || label.position==='insideTopLeft')
      && (label.align==null || label.align==='left') && (label.verticalAlign==null || label.verticalAlign==='top')
      && !s.levels?.some(level=>level.label?.color!=null)
      && !Object.hasOwn(label.rich || {},'vilsemContrastLight') && !Object.hasOwn(label.rich || {},'vilsemContrastDark')) {
      const original=label.formatter
      const formatter=(p,modelFormatter)=>{
        const text=typeof original==='function'?original(p,modelFormatter):original==null?String(p?.name ?? ''):null
        // Preserve authored rich text, formatter strings and per-node colours.
        if(text==null || /[{}]/.test(text) || p?.data?.label?.color!=null)return text ?? original
        const foreground=contrastingText(p?.color,'')
        return foreground?`{${foreground==='#000000'?'vilsemContrastLight':'vilsemContrastDark'}|${text}}`:text
      }
      formatter.vilsemFormatter=true
      // Rich labels use the node-sized text box assigned by ECharts. Put these
      // default plain labels at the padded top-left; do not change an authored
      // centred/aligned layout or depend on private chart geometry callbacks.
      label={position:'insideTopLeft',align:'left',verticalAlign:'top',...label,formatter,rich:{...label.rich,vilsemContrastLight:{color:'#000000'},vilsemContrastDark:{color:'#ffffff'}}}
      // Upper headers inherit the normal formatter in ECharts, but not its
      // rich styles. Keep their pre-contrast text contract and authored styles.
      upperLabel={...s.upperLabel,formatter:s.upperLabel?.formatter ?? original ?? (p=>String(p?.name ?? ''))}
    }
    return { ...s, label, ...(upperLabel?{upperLabel}:{}) }
  })
  if (palette && Array.isArray(out.series)) out.series = out.series.map((s, i) => {
    // Composition defaults are replaced only when the caller has not selected
    // an explicit colour scheme. Preserve datum-level conditional colours.
    const color = theme.palette[i % theme.palette.length]
    return { ...s, itemStyle: { ...s.itemStyle, color }, ...(s.lineStyle ? { lineStyle: { ...s.lineStyle, color } } : {}) }
  })
  if(option.baseOption)out.baseOption=applyReportTheme(option.baseOption,theme,{palette})
  if(Array.isArray(option.options)){const inherited=out.baseOption??out;out.options=option.options.map(frame=>applyReportTheme({backgroundColor:inherited.backgroundColor,color:inherited.color,...frame,textStyle:{...inherited.textStyle,...frame.textStyle}},theme,{palette}))}
  return out
}
