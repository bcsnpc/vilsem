// Runs after `pbiviz package`: lists every third-party package bundled into the
// renderer (webpack's own bundle report + the DOM layer's recorded module list),
// writes packages/core/THIRD_PARTY_NOTICES.md, and replaces the renderer's dangling
// "see visual.js.LICENSE.txt" pointer (that file is not part of a .pbiviz) with the
// full notices as a preserved comment inside visual.js.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {buildNotices, packageRootFromPath, asBlockComment} from './notices-lib.mjs'

const require = createRequire(import.meta.url)
const AdmZip = require('adm-zip')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const renderer = path.join(root, 'vilsem-renderer')
const {guid, version} = JSON.parse(fs.readFileSync(path.join(renderer, 'pbiviz.json'), 'utf8')).visual

// 1. Webpack bundle report: module paths are relative to vilsem-renderer.
const stats = fs.readFileSync(path.join(renderer, 'webpack.statistics.prod.html'), 'utf8')
const dirs = new Set()
for (const m of stats.matchAll(/"(?:label|path)":"([^"]*node_modules[^"]*)"/g)) {
  const rootDir = packageRootFromPath(m[1].replace(/\\\\/g, '/').replace(/\\\//g, '/'))
  if (rootDir && /node_modules\/(@[^/]+\/)?[^/]+$/.test(rootDir)) dirs.add(path.resolve(renderer, rootDir))
}
// 2. DOM layer (bundled into the renderer as generated/powerbiDom.js).
const domList = path.join(renderer, 'generated', 'powerbiDom.packages.json')
if (!fs.existsSync(domList)) throw Error('generated/powerbiDom.packages.json missing: rebuild the renderer (copy-primitives records it)')
for (const dir of JSON.parse(fs.readFileSync(domList, 'utf8'))) dirs.add(dir)

const existing = [...dirs].filter(d => fs.existsSync(path.join(d, 'package.json')))
const notices = buildNotices(existing, {
  title: `Third-party notices: vilsem Renderer ${version}`,
  intro: `The vilsem Renderer (renderer.pbiviz, GUID ${guid}) is MIT-licensed (see LICENSE). It bundles the third-party components below, generated from the renderer build's own module graph. Each component remains under its own license.`,
  exclude: ['@vilsem/core'],
})
if (!notices.packages.some(p => p.startsWith('echarts@'))) throw Error('Expected echarts in the renderer bundle; refusing to write incomplete notices')
fs.writeFileSync(path.join(root, 'packages', 'core', 'THIRD_PARTY_NOTICES.md'), notices.text)

// 3. Embed the notices in visual.js inside the packaged .pbiviz.
const pbiviz = path.join(renderer, 'dist', `${guid}.${version}.pbiviz`)
const zip = new AdmZip(pbiviz)
const entry = zip.getEntries().find(e => e.entryName.endsWith('.pbiviz.json'))
const visual = JSON.parse(zip.readAsText(entry))
const dangling = /^\/\*! For license information please see visual\.js\.LICENSE\.txt \*\/\s*/
const body = visual.content.js.replace(dangling, '').replace(/^\/\*!\n# Third-party notices[\s\S]*?\*\/\n/, '')
visual.content.js = asBlockComment(notices.text) + body
zip.updateFile(entry.entryName, Buffer.from(JSON.stringify(visual)))
zip.writeZip(pbiviz)
console.log(`renderer notices: ${notices.packages.length} packages, ${notices.text.length} chars embedded in ${path.basename(pbiviz)}`)
