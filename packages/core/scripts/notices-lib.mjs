// Third-party notices from a list of package directories that a build actually bundled.
// Reads each package's own license file (or a standard SPDX text when the package
// ships none), groups identical license texts, and reproduces Apache NOTICE files
// as Apache-2.0 section 4(d) requires. Output is plain text/markdown, never code.
import fs from 'node:fs'
import path from 'node:path'

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
const ISC = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`
const FALLBACK = {MIT, ISC}

// Packages that ship no license file: the license and holder from their own metadata/upstream.
const KNOWN_HOLDERS = {
  'victory-vendor': 'Copyright (c) 2015-present Formidable Labs, Inc. (MIT); vendored d3 modules Copyright 2010-2022 Mike Bostock (ISC)',
  'agent-base': 'Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>',
  'https-proxy-agent': 'Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>',
}
// Packages offered under a choice of licenses: the one Vilsem takes.
const ELECTED = {dompurify: 'Apache-2.0 (DOMPurify is dual licensed MPL-2.0 OR Apache-2.0; Vilsem uses it under Apache-2.0)'}
// MPL-2.0 packages distributed unmodified are listed with where to get the license and
// the source, taken from the package's own repository field.
const isMpl = license => license === 'MPL-2.0'
const httpsUrl = repo => String(repo).replace(/^git@github\.com:/, 'https://github.com/').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/')

export function packageNameFromDir(dir) {
  const parts = dir.split(/[\\/]/)
  const i = parts.lastIndexOf('node_modules')
  if (i < 0) return null
  return parts[i + 1]?.startsWith('@') ? `${parts[i + 1]}/${parts[i + 2]}` : parts[i + 1]
}

export function packageRootFromPath(file) {
  const parts = file.split(/[\\/]/)
  const i = parts.lastIndexOf('node_modules')
  if (i < 0) return null
  return parts.slice(0, i + (parts[i + 1]?.startsWith('@') ? 3 : 2)).join('/')
}

function readPackage(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const files = fs.readdirSync(dir)
  const licenseFile = files.find(f => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f))
  const noticeFile = files.find(f => /^notice(\.(md|txt))?$/i.test(f))
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || 'UNKNOWN'
  let text = licenseFile ? fs.readFileSync(path.join(dir, licenseFile), 'utf8').replace(/\r\n/g, '\n').trim() : ''
  if (!text) {
    const base = FALLBACK[license] || (/MIT/.test(license) ? MIT : /ISC/.test(license) ? ISC : '')
    if (!base && !isMpl(license)) throw Error(`${pkg.name}@${pkg.version}: no license file and no known ${license} text`)
    const holder = KNOWN_HOLDERS[pkg.name] || `Copyright (c) ${typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || pkg.name + ' contributors'}`
    text = isMpl(license) ? '' : `${holder}\n\n${base}`
  }
  const notice = noticeFile ? fs.readFileSync(path.join(dir, noticeFile), 'utf8').replace(/\r\n/g, '\n').trim() : ''
  return {name: pkg.name, version: pkg.version, license, text, notice, repository: String(pkg.repository?.url || pkg.repository || pkg.homepage || '').replace(/^git\+/, '').replace(/\.git$/, '')}
}

// Split a license file into its copyright lines and the remaining license body,
// so identical bodies can be printed once with every holder listed.
function splitLicense(text) {
  const lines = text.split('\n')
  const holders = []
  let start = 0
  while (start < lines.length && (/^\s*$/.test(lines[start]) || /copyright|^\s*\(c\)|^(the )?(mit|isc) licen[sc]e|^bsd|^licen[sc]e$/i.test(lines[start]) || /^[=\-]{3,}$/.test(lines[start]))) {
    if (/copyright|\(c\)/i.test(lines[start])) holders.push(lines[start].trim())
    start++
  }
  return {holders, body: lines.slice(start).join('\n').trim()}
}

export function buildNotices(packageDirs, {title, intro, exclude = []}) {
  const seen = new Map()
  for (const dir of packageDirs) {
    const info = readPackage(dir)
    if (exclude.includes(info.name)) continue
    seen.set(`${info.name}@${info.version}`, info)
  }
  const packages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  const groups = new Map()
  const mpl = [], apache = []
  for (const p of packages) {
    if (isMpl(p.license)) { mpl.push(p); continue }
    if (/apache/i.test(p.license) && !ELECTED[p.name] || ELECTED[p.name]?.startsWith('Apache')) apache.push(p)
    const {holders, body} = splitLicense(p.text)
    const key = body.replace(/\s+/g, ' ')
    if (!groups.has(key)) groups.set(key, {body, license: ELECTED[p.name] ? 'Apache-2.0' : p.license, entries: []})
    groups.get(key).entries.push({...p, holders})
  }
  const out = [`# ${title}`, '', intro, '', '## Components', '']
  for (const p of packages) out.push(`- ${p.name} ${p.version}: ${ELECTED[p.name] || p.license}${p.repository ? ` (${p.repository})` : ''}`)
  const withNotice = packages.filter(p => p.notice)
  if (withNotice.length) {
    out.push('', '## NOTICE files (Apache License 2.0, section 4(d))', '')
    for (const p of withNotice) out.push(`### ${p.name} ${p.version}`, '', p.notice, '')
  }
  if (mpl.length) {
    out.push('', '## Mozilla Public License 2.0 components', '')
    for (const p of mpl) out.push(`- ${p.name} ${p.version} is distributed unmodified under MPL-2.0 (https://mozilla.org/MPL/2.0/). Source code: ${httpsUrl(p.repository)}`)
  }
  out.push('', '## License texts', '')
  for (const g of groups.values()) {
    out.push(`### ${g.license}: ${g.entries.map(e => `${e.name} ${e.version}`).join(', ')}`, '')
    const holders = [...new Set(g.entries.flatMap(e => e.holders.length ? e.holders.map(h => `${h} (${e.name})`) : []))]
    if (holders.length) out.push(...holders, '')
    out.push(g.body, '')
  }
  return {text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', packages: packages.map(p => `${p.name}@${p.version}`), apache: apache.map(p => p.name)}
}

// Safe inside a /*! ... */ block comment.
export function asBlockComment(text) {
  return '/*!\n' + text.replace(/\*\//g, '* /') + '*/\n'
}
