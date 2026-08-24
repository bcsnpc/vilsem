// Single source of truth for the font families vilsem offers (visual inspector +
// generator + web export). Previously duplicated in AppGenerator (PREMIUM_FONTS)
// and VisualInspector (FONTS) as two identical 10-item lists. Keep the Power BI
// embed (pbiviz-semantica-renderer/scripts/embed-fonts.js) in sync with
// PBI_EMBED_FONTS so published reports render matching type.
//
// Each spec carries the exact Google Fonts weights that family actually ships, so
// the generated CSS URL never requests an unavailable weight (which 400s the whole
// request). `pbi:true` marks families also embedded in the .pbiviz.
const FONT_SPECS = [
  // ── Sans (originals — keep first so existing defaults are unchanged) ──
  { family: 'Inter',             w: '400;500;600;700;800', pbi: true },
  { family: 'DM Sans',           w: '400;500;700',         pbi: true },
  { family: 'Space Grotesk',     w: '400;500;700',         pbi: true },
  { family: 'Plus Jakarta Sans', w: '400;500;700;800',     pbi: true },
  { family: 'Manrope',           w: '400;500;700;800',     pbi: true },
  { family: 'Sora',              w: '400;600;700',         pbi: true },
  { family: 'Outfit',            w: '400;500;700',         pbi: true },
  { family: 'Urbanist',          w: '400;500;700;800',     pbi: true },
  { family: 'Libre Franklin',    w: '400;500;700',         pbi: true },
  { family: 'IBM Plex Sans',     w: '400;500;700',         pbi: true },
  // ── Sans (new) ──
  { family: 'Poppins',           w: '400;500;600;700',     pbi: true },
  { family: 'Montserrat',        w: '400;500;600;700;800', pbi: true },
  { family: 'Work Sans',         w: '400;500;600;700',     pbi: true },
  { family: 'Nunito Sans',       w: '400;600;700' },
  { family: 'Nunito',            w: '400;600;700;800' },
  { family: 'Rubik',             w: '400;500;600;700' },
  { family: 'Figtree',           w: '400;500;600;700' },
  { family: 'Lexend',            w: '400;500;600;700',     pbi: true },
  { family: 'Archivo',           w: '400;500;600;700' },
  { family: 'Public Sans',       w: '400;600;700' },
  { family: 'Red Hat Display',   w: '400;500;700' },
  { family: 'Onest',             w: '400;500;700' },
  // ── Serif / display ──
  { family: 'Playfair Display',  w: '400;500;600;700',     pbi: true },
  { family: 'DM Serif Display',  w: '400' },
  { family: 'Fraunces',          w: '400;500;600;700' },
  { family: 'Source Serif 4',    w: '400;600;700' },
  { family: 'Merriweather',      w: '400;700' },
  // ── Mono ──
  { family: 'JetBrains Mono',    w: '400;500;700',         pbi: true },
  { family: 'IBM Plex Mono',     w: '400;500;700' },
  { family: 'Space Mono',        w: '400;700' },
]

// Family names for the picker <select>s.
export const FONTS = FONT_SPECS.map(f => f.family)

// Subset embedded in the Power BI custom visual (bounds .pbiviz size). Families
// not in this list fall back to a system font when published to PBI.
export const PBI_EMBED_FONTS = FONT_SPECS.filter(f => f.pbi).map(f => f.family)

// Build the Google Fonts css2 URL for all families with their real weights.
export function googleFontsHref(specs = FONT_SPECS) {
  const fam = specs.map(f => `family=${f.family.replace(/ /g, '+')}:wght@${f.w}`).join('&')
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`
}
