/**
 * Color theory utilities for premium dashboard restyling.
 *
 * Functions:
 *   - HSL ↔ RGB ↔ Hex conversions
 *   - Relative luminance + WCAG contrast ratio
 *   - K-means dominant color extraction (for logo input — runs in browser)
 *   - Generate sequential, diverging, and categorical palettes from an accent
 *   - Generate semantic colors (good / neutral / bad) with consistent saturation
 *   - 60-30-10 color discipline rule helpers
 *
 * Sources: Doc 1 design-rules section, WCAG 2.1 contrast spec,
 *          Material Design / IBM Carbon palette generation patterns.
 */

// ── Color conversions ────────────────────────────────────────────────────────

export function hexToRgb(hex) {
  const safe = String(hex).replace(/^#/, '')
  const full = safe.length === 3
    ? safe.split('').map(c => c + c).join('')
    : safe
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

export function rgbToHex({ r, g, b }) {
  const toHex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break
      case gn: h = (bn - rn) / d + 2; break
      case bn: h = (rn - gn) / d + 4; break
    }
    h *= 60
  }
  return { h, s, l }
}

export function hslToRgb({ h, s, l }) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hh = h / 360
  return {
    r: hue2rgb(p, q, hh + 1 / 3) * 255,
    g: hue2rgb(p, q, hh) * 255,
    b: hue2rgb(p, q, hh - 1 / 3) * 255,
  }
}

export function hexToHsl(hex)   { return rgbToHsl(hexToRgb(hex)) }
export function hslToHex(hsl)   { return rgbToHex(hslToRgb(hsl)) }

// ── WCAG contrast ────────────────────────────────────────────────────────────

/**
 * Relative luminance per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const channel = c => {
    const cn = c / 255
    return cn <= 0.03928 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Contrast ratio between two colors per WCAG 2.1.
 * Returns a number 1.0 (no contrast) to 21.0 (max contrast).
 *
 *   AA  normal text:  4.5+
 *   AA  large text:   3.0+
 *   AAA normal text:  7.0+
 *   AAA large text:   4.5+
 *   UI components:    3.0+ (for non-text UI)
 */
export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

export function meetsWcagAA(fg, bg, large = false) {
  return contrastRatio(fg, bg) >= (large ? 3.0 : 4.5)
}

export function meetsWcagAAA(fg, bg, large = false) {
  return contrastRatio(fg, bg) >= (large ? 4.5 : 7.0)
}

// ── Color manipulation ───────────────────────────────────────────────────────

/**
 * Lighten or darken a color by a percentage of its current lightness.
 *   shade('#3B82F6', -0.2) → 20% darker
 *   shade('#3B82F6',  0.3) → 30% lighter
 */
export function shade(hex, amount) {
  const hsl = hexToHsl(hex)
  hsl.l = Math.max(0, Math.min(1, hsl.l + amount))
  return hslToHex(hsl)
}

export function saturate(hex, amount) {
  const hsl = hexToHsl(hex)
  hsl.s = Math.max(0, Math.min(1, hsl.s + amount))
  return hslToHex(hsl)
}

export function desaturate(hex, amount) {
  return saturate(hex, -amount)
}

/**
 * Mix two colors at a given ratio. ratio=0 returns hex1, ratio=1 returns hex2.
 */
export function mix(hex1, hex2, ratio = 0.5) {
  const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2)
  return rgbToHex({
    r: c1.r * (1 - ratio) + c2.r * ratio,
    g: c1.g * (1 - ratio) + c2.g * ratio,
    b: c1.b * (1 - ratio) + c2.b * ratio,
  })
}

/**
 * Get complementary hue (180° opposite).
 */
export function complement(hex) {
  const hsl = hexToHsl(hex)
  hsl.h = (hsl.h + 180) % 360
  return hslToHex(hsl)
}

// ── Palette generation ───────────────────────────────────────────────────────

/**
 * Generate a 5-stop sequential palette (single-hue gradient) from a base color.
 * Good for choropleth maps, heatmaps, sequential conditional formatting.
 */
export function sequentialPalette(accent, steps = 5) {
  const out = []
  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1)
    out.push(mix('#FFFFFF', accent, 0.2 + ratio * 0.8))
  }
  return out
}

/**
 * Generate a diverging palette: accent → neutral → complement.
 */
export function divergingPalette(accent, neutral = '#F3F4F6', steps = 5) {
  const half = Math.floor(steps / 2)
  const comp = complement(accent)
  const left  = []
  const right = []
  for (let i = 0; i < half; i++) {
    const ratio = i / half
    left.push(mix(accent, neutral, ratio))
    right.push(mix(neutral, comp, ratio + (1 / half)))
  }
  return [...left, neutral, ...right].slice(0, steps)
}

/**
 * Generate a categorical palette (8 colors) by rotating hue around the wheel.
 * Each subsequent color drops slightly in saturation to prevent "rainbow" look.
 */
export function categoricalPalette(accent, count = 8) {
  const baseHsl = hexToHsl(accent)
  const out = []
  // Hue spacing — golden-ratio-like rotation gives best perceptual separation
  const goldenStep = 137.5
  for (let i = 0; i < count; i++) {
    const h = (baseHsl.h + goldenStep * i) % 360
    const s = Math.max(0.4, baseHsl.s - i * 0.04)
    const l = Math.max(0.35, Math.min(0.65, baseHsl.l + (i % 2 === 0 ? 0 : 0.05)))
    out.push(hslToHex({ h, s, l }))
  }
  return out
}

/**
 * Premium dataColors curation rule: 5-6 categorical colors max, ordered by
 * importance. First color = brand accent; subsequent descend in saturation.
 *
 * Per Cole Nussbaumer Knaflic ("Storytelling with Data"): only the focal data
 * point gets brand color; everything else is gray. So the recommended array is
 *   [accent, ...4 grays at descending lightness]
 * If you need more colors, fall through to the categorical generator.
 */
export function premiumDataColors(accent, mode = 'light') {
  const grays = mode === 'dark'
    ? ['#94A3B8', '#64748B', '#475569', '#334155', '#1E293B']
    : ['#475569', '#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0']
  return [accent, ...grays]
}

// ── Semantic colors ──────────────────────────────────────────────────────────

/**
 * Generate good/neutral/bad sentiment colors that match the saturation of
 * the brand accent — premium dashboards don't use saturated traffic-light defaults.
 */
export function sentimentColors(accent) {
  const hsl = hexToHsl(accent)
  // Match accent's saturation/lightness, swap hue
  return {
    good:    hslToHex({ h: 142, s: hsl.s, l: hsl.l }),  // green hue
    neutral: hslToHex({ h: 45,  s: Math.max(0.3, hsl.s - 0.2), l: hsl.l }),  // amber
    bad:     hslToHex({ h: 0,   s: hsl.s, l: hsl.l }),  // red
  }
}

// ── K-means dominant color extraction ────────────────────────────────────────

/**
 * Extract dominant colors from an image using k-means clustering in RGB space.
 *
 *   const colors = await extractDominantColors(imageElement, 5)
 *   → ['#3B82F6', '#1E293B', '#F1F5F9', '#FBBF24', '#94A3B8']
 *
 * Works with HTMLImageElement, HTMLCanvasElement, or ImageData.
 * Runs entirely in browser via canvas.getImageData (no server call).
 */
export async function extractDominantColors(image, k = 5, maxIterations = 20) {
  const canvas = document.createElement('canvas')
  const w = canvas.width  = Math.min(image.naturalWidth || image.width, 200)
  const h = canvas.height = Math.min(image.naturalHeight || image.height, 200)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  // Sample pixels (skip transparent + near-white/black to avoid bg noise)
  const pixels = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue
    const sum = r + g + b
    if (sum > 750 || sum < 30) continue   // skip near-white and near-black
    pixels.push([r, g, b])
  }
  if (!pixels.length) return ['#475569']

  // Initialize centroids by random pick
  const centroids = []
  for (let i = 0; i < k; i++) {
    centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice())
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign
    const clusters = Array(k).fill(null).map(() => [])
    for (const px of pixels) {
      let best = 0, bestDist = Infinity
      for (let i = 0; i < k; i++) {
        const c = centroids[i]
        const d = (px[0] - c[0]) ** 2 + (px[1] - c[1]) ** 2 + (px[2] - c[2]) ** 2
        if (d < bestDist) { bestDist = d; best = i }
      }
      clusters[best].push(px)
    }
    // Update
    let moved = false
    for (let i = 0; i < k; i++) {
      if (!clusters[i].length) continue
      const cl = clusters[i]
      const nx = [
        cl.reduce((s, p) => s + p[0], 0) / cl.length,
        cl.reduce((s, p) => s + p[1], 0) / cl.length,
        cl.reduce((s, p) => s + p[2], 0) / cl.length,
      ]
      if (nx.some((v, j) => Math.abs(v - centroids[i][j]) > 1)) moved = true
      centroids[i] = nx
    }
    if (!moved) break
  }

  // Sort by cluster size (most dominant first)
  const counts = centroids.map((c, i) => {
    let n = 0
    for (const px of pixels) {
      const cd = c
      let best = 0, bestDist = Infinity
      for (let j = 0; j < k; j++) {
        const cc = centroids[j]
        const d = (px[0] - cc[0]) ** 2 + (px[1] - cc[1]) ** 2 + (px[2] - cc[2]) ** 2
        if (d < bestDist) { bestDist = d; best = j }
      }
      if (best === i) n++
    }
    return { hex: rgbToHex({ r: c[0], g: c[1], b: c[2] }), count: n }
  })
  counts.sort((a, b) => b.count - a.count)
  return counts.map(c => c.hex)
}

// ── 60-30-10 rule helpers ────────────────────────────────────────────────────

/**
 * Premium color discipline. Restrict charts to 5 categories max; if more, top-3
 * get accent color and the rest go to neutral. This is implemented in the
 * style applier as a per-visual transform.
 */
export const COLOR_DISCIPLINE = {
  primaryWeight:    0.6,   // 60% — neutral surfaces, structure, backgrounds
  secondaryWeight:  0.3,   // 30% — chart series, supporting elements
  accentWeight:     0.1,   // 10% — brand accent on focal data, KPIs, active states
  maxCategoricalSeries: 5,
  maxCategoricalSeriesStrict: 3,   // for KPI cards / single-focus charts
}
