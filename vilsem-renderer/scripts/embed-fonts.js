/**
 * embed-fonts.js — downloads Google Fonts woff2 files for the 10 premium
 * Semantica fonts (weights 500/700/800) and inlines them as @font-face blocks
 * with base64 data URIs in style/visual.less.
 *
 * Run once before `pbiviz package`. Idempotent — overwrites content between
 * `/* FONT-START *\/` and `/* FONT-END *\/` markers.
 *
 * Usage: node scripts/embed-fonts.js
 */

const fs   = require('fs')
const path = require('path')

const FONTS = [
  'Inter',
  'DM Sans',
  'Space Grotesk',
  'Plus Jakarta Sans',
  'Manrope',
  'Sora',
  'Outfit',
  'Urbanist',
  'Libre Franklin',
  'IBM Plex Sans',
]
const WEIGHTS = [500, 700, 800]

// Chrome on Windows UA — Google Fonts returns woff2 for this.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function buildCssUrl() {
  const q = FONTS
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${WEIGHTS.join(';')}`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${q}&display=swap`
}

async function fetchBinary(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buf = await res.arrayBuffer()
  return Buffer.from(buf)
}

async function main() {
  const cssUrl = buildCssUrl()
  console.log('[embed-fonts] Fetching CSS from Google Fonts…')
  const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': UA } })
  if (!cssRes.ok) throw new Error(`Failed to fetch CSS: ${cssRes.status}`)
  const cssText = await cssRes.text()

  // Parse @font-face blocks. Only keep the `latin` subset (unicode-range
  // starting with U+0000-00FF or no unicode-range at all) to minimize size.
  const blocks = cssText.split(/(?=@font-face)/g).filter((b) => b.trim().startsWith('@font-face'))
  console.log(`[embed-fonts] Found ${blocks.length} @font-face blocks in CSS`)

  const kept = []
  const seen = new Set()
  for (const block of blocks) {
    // Extract font-family
    const familyMatch = block.match(/font-family:\s*['"]([^'"]+)['"]/i)
    const weightMatch = block.match(/font-weight:\s*(\d+)/i)
    const styleMatch  = block.match(/font-style:\s*(\w+)/i)
    const urlMatch    = block.match(/url\((https:\/\/[^)]+\.woff2)\)/i)
    const unicodeRangeMatch = block.match(/unicode-range:\s*([^;]+);/i)
    if (!familyMatch || !weightMatch || !urlMatch) continue

    const family = familyMatch[1]
    const weight = Number(weightMatch[1])
    const style  = styleMatch ? styleMatch[1] : 'normal'

    // Prefer latin subset (the block whose unicode-range starts with U+0000).
    // Multiple blocks per family+weight exist for latin-ext, cyrillic, etc.
    const isLatin = !unicodeRangeMatch || /U\+000?0/.test(unicodeRangeMatch[1])
    const key = `${family}|${weight}|${style}`
    if (seen.has(key)) continue
    if (!isLatin) continue
    seen.add(key)

    kept.push({ family, weight, style, url: urlMatch[1] })
  }

  console.log(`[embed-fonts] Kept ${kept.length} unique latin blocks`)

  // Download each woff2 and base64-encode
  const results = []
  for (const k of kept) {
    process.stdout.write(`  ${k.family} ${k.weight} ${k.style}… `)
    const buf = await fetchBinary(k.url)
    const b64 = buf.toString('base64')
    console.log(`${(buf.length / 1024).toFixed(1)}KB`)
    results.push({ ...k, b64 })
  }

  // Build @font-face CSS block
  const cssBlocks = results.map((r) => `@font-face{font-family:'${r.family}';font-style:${r.style};font-weight:${r.weight};font-display:swap;src:url(data:font/woff2;base64,${r.b64}) format('woff2');}`).join('\n')

  // Write into visual.less between markers (idempotent)
  const lessPath = path.join(__dirname, '..', 'style', 'visual.less')
  let lessContent = fs.readFileSync(lessPath, 'utf8')
  const startMarker = '/* FONT-START */'
  const endMarker   = '/* FONT-END */'
  const injected = `${startMarker}\n/* ${results.length} @font-face blocks embedded by scripts/embed-fonts.js. Do not edit by hand. */\n${cssBlocks}\n${endMarker}`

  if (lessContent.includes(startMarker) && lessContent.includes(endMarker)) {
    const re = new RegExp(`${startMarker.replace(/[/*]/g, '\\$&')}[\\s\\S]*?${endMarker.replace(/[/*]/g, '\\$&')}`, 'g')
    lessContent = lessContent.replace(re, injected)
  } else {
    // First run — prepend the markers block
    lessContent = injected + '\n\n' + lessContent
  }
  fs.writeFileSync(lessPath, lessContent, 'utf8')

  const totalKB = (results.reduce((s, r) => s + Buffer.from(r.b64, 'base64').length, 0) / 1024).toFixed(1)
  const b64KB   = (results.reduce((s, r) => s + r.b64.length, 0) / 1024).toFixed(1)
  console.log(`[embed-fonts] Wrote ${results.length} @font-face blocks to ${lessPath}`)
  console.log(`[embed-fonts] Raw woff2: ${totalKB}KB  Base64: ${b64KB}KB`)
}

main().catch((e) => { console.error(e); process.exit(1) })
