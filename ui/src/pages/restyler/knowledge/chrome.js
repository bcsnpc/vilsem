/**
 * Card chrome treatments — the 4 named styles a restyler can apply.
 *
 * "Chrome" = the visual container appearance: background fill, border,
 * border-radius, drop shadow, padding. Premium dashboards pick ONE chrome
 * pattern and apply it consistently — mixing creates noise.
 *
 * Each preset returns a set of property bags ready to write into theme JSON's
 * `visualStyles["*"]["*"]` block AND/OR per-visual `visualContainerObjects`.
 *
 * Source: Doc 3 chrome treatment table.
 */

// ── Chrome style definitions ─────────────────────────────────────────────────

/**
 * Each chrome preset returns the property bag for the wildcard `["*"]["*"]`
 * theme target (with light/dark variants for color tokens).
 *
 * `wallpaper` is the page background color.
 * `cardBg`    is the visual container background.
 * `border`    is { show, color, radius, weight }.
 * `shadow`    is the dropShadow card or null.
 * `padding`   is { top, right, bottom, left }.
 */
export const CHROME_PRESETS = {

  // ───────────────────────────────────────────────────────────────────────
  // 1. FLAT MODERN — most common premium baseline
  //    1px border, 8px radius, no shadow, 16px padding
  // ───────────────────────────────────────────────────────────────────────
  flat_modern: {
    label: 'Flat Modern',
    description: 'Crisp, professional. Slate-50 page + white cards with subtle shadow + 12px radius.',
    light: {
      wallpaper: '#F1F5F9',                                     // Slate-100 — distinct from white cards
      cardBg:    '#FFFFFF',
      border:    { show: true, color: '#E2E8F0', radius: 12, weight: 1 },  // Slate-200 visible border
      shadow:    {
        show: true, preset: 'Outer', color: '#0F172A',
        transparency: 92, blur: 6, distance: 1, angle: 90,      // Subtle shadow on flat-modern light
      },
      padding:   { top: 18, right: 18, bottom: 18, left: 18 },
    },
    dark: {
      wallpaper: '#0B0B14',
      cardBg:    '#111827',                                     // Slate-900 cards on near-black page
      border:    { show: true, color: '#1F2937', radius: 12, weight: 1 },
      shadow:    null,
      padding:   { top: 18, right: 18, bottom: 18, left: 18 },
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  // 2. ELEVATED CARDS — modern web-app feel
  //    No border, soft shadow, 8-12px radius, 16px padding
  // ───────────────────────────────────────────────────────────────────────
  elevated: {
    label: 'Elevated Cards',
    description: 'Modern web-app feel with subtle shadow. Best for executive dashboards.',
    light: {
      wallpaper: '#F7F9FC',
      cardBg:    '#FFFFFF',
      border:    { show: false, color: '#E5E7EB', radius: 12, weight: 0 },
      shadow:    {
        show: true, preset: 'Outer', color: '#000000',
        transparency: 88, blur: 8, distance: 2, angle: 90,
      },
      padding:   { top: 16, right: 16, bottom: 16, left: 16 },
    },
    dark: {
      wallpaper: '#0B0B14',
      cardBg:    '#1A1F2E',
      border:    { show: false, color: '#1E293B', radius: 12, weight: 0 },
      shadow:    {
        show: true, preset: 'Outer', color: '#000000',
        transparency: 70, blur: 12, distance: 2, angle: 90,
      },
      padding:   { top: 16, right: 16, bottom: 16, left: 16 },
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  // 3. SECTION DIVIDERS — flat editorial look
  //    No card chrome, only horizontal dividers between sections
  // ───────────────────────────────────────────────────────────────────────
  section_divider: {
    label: 'Section Dividers',
    description: 'Editorial, flat. No cards. Sections separated by thin horizontal rules. Best for narrative dashboards.',
    light: {
      wallpaper: '#FFFFFF',
      cardBg:    'transparent',
      border:    { show: false, color: '#E5E7EB', radius: 0, weight: 0 },
      shadow:    null,
      padding:   { top: 12, right: 0, bottom: 12, left: 0 },
      divider:   { show: true, color: '#E5E7EB', style: 'solid', width: 1 },
    },
    dark: {
      wallpaper: '#0B0B14',
      cardBg:    'transparent',
      border:    { show: false, color: '#1E293B', radius: 0, weight: 0 },
      shadow:    null,
      padding:   { top: 12, right: 0, bottom: 12, left: 0 },
      divider:   { show: true, color: '#1E293B', style: 'solid', width: 1 },
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  // 4. GLASS / DARK — premium dark with subtle glow
  //    Translucent cards over gradient page, light border, larger padding
  // ───────────────────────────────────────────────────────────────────────
  glass_dark: {
    label: 'Glass / Premium Dark',
    description: 'Translucent dark cards over gradient page. Best for executive presentations.',
    light: {
      // Glass works best on dark — fall back to elevated for light mode
      wallpaper: '#F1F5F9',
      cardBg:    '#FFFFFF',
      border:    { show: true, color: '#E5E7EB', radius: 12, weight: 1 },
      shadow:    { show: true, preset: 'Outer', color: '#0F172A', transparency: 92, blur: 12, distance: 4, angle: 90 },
      padding:   { top: 20, right: 20, bottom: 20, left: 20 },
    },
    dark: {
      wallpaper: '#0B0B14',
      cardBg:    '#1A1F2E',                    // Use solid dark; PBI doesn't support backdrop-filter
      cardBgTransparency: 10,                  // Slight translucency for layered feel
      border:    { show: true, color: '#FFFFFF1A', radius: 12, weight: 1 },
      shadow:    null,
      padding:   { top: 20, right: 20, bottom: 20, left: 20 },
    },
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the chrome bag for a preset + mode.
 *   getChrome('flat_modern', 'dark') → { wallpaper, cardBg, border, shadow, padding }
 */
export function getChrome(presetKey, mode = 'light') {
  const preset = CHROME_PRESETS[presetKey] || CHROME_PRESETS.flat_modern
  return preset[mode] || preset.light
}

/**
 * Build the theme JSON `visualStyles["*"]["*"]` block from a chrome preset.
 * The output is plain theme-JSON scalars (no PBIR envelope wrapping yet —
 * the styleApplier handles that layer).
 */
export function buildChromeVisualStyle(presetKey, mode = 'light') {
  const c = getChrome(presetKey, mode)
  const out = {}

  // background
  out.background = [{
    show:         true,
    color:        c.cardBg === 'transparent' ? null : { solid: { color: c.cardBg } },
    transparency: c.cardBg === 'transparent' ? 100 : (c.cardBgTransparency || 0),
  }]

  // border
  out.border = [{
    show:   c.border.show,
    color:  { solid: { color: c.border.color } },
    radius: c.border.radius,
    weight: c.border.weight,
  }]

  // dropShadow
  if (c.shadow) {
    out.dropShadow = [{
      show:         c.shadow.show,
      preset:       c.shadow.preset,
      color:        { solid: { color: c.shadow.color } },
      transparency: c.shadow.transparency,
      blur:         c.shadow.blur,
      distance:     c.shadow.distance,
      angle:        c.shadow.angle,
    }]
  } else {
    out.dropShadow = [{ show: false }]
  }

  // padding
  out.padding = [c.padding]

  // divider (only when defined — section_divider preset)
  if (c.divider) {
    out.divider = [c.divider]
  }

  return out
}

// ── Preset-specific exceptions ───────────────────────────────────────────────

/**
 * Some visual types need explicit chrome overrides because their internal
 * defaults add their own padding/border (Doc 3).
 *
 * Visuals listed here get padding zeroed OR specific overrides applied at
 * `visualStyles["<type>"]["*"]` to prevent double-padding or doubled chrome.
 */
export const CHROME_EXCEPTIONS = {
  slicer:                  { padding: { top: 8,  right: 12, bottom: 8,  left: 12 } },
  advancedSlicerVisual:    { padding: { top: 8,  right: 12, bottom: 8,  left: 12 } },
  textSlicer:              { padding: { top: 4,  right: 8,  bottom: 4,  left: 8  } },
  card:                    { padding: { top: 12, right: 16, bottom: 12, left: 16 } },
  cardVisual:              { padding: { top: 12, right: 16, bottom: 12, left: 16 } },
  basicShape:              { padding: { top: 0,  right: 0,  bottom: 0,  left: 0  } },
  shape:                   { padding: { top: 0,  right: 0,  bottom: 0,  left: 0  } },
  actionButton:            { padding: { top: 8,  right: 12, bottom: 8,  left: 12 } },
  textbox:                 { padding: { top: 0,  right: 0,  bottom: 0,  left: 0  } },
}
