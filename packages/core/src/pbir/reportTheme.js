import fs from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_REPORT_THEME } from '../shared/reportTheme.js'

// Read only the explicitly referenced local theme, never a caller-supplied URL
// or an arbitrary JSON file selected by directory enumeration.
export async function readReportTheme(reportDir) {
  if (!reportDir) return { theme: DEFAULT_REPORT_THEME, source: 'Power BI default', warnings: [] }
  const root = await fs.realpath(path.resolve(reportDir))
  const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
  const report = await read(path.join(root, 'definition', 'report.json'))
  const reference = report.themeCollection?.customTheme
  if (!reference?.name) return { theme: DEFAULT_REPORT_THEME, source: 'Power BI default', warnings: [] }
  const name = reference.name
  if (typeof name !== 'string' || !name || /[/\\\0]/.test(name) || name === '..') throw Error('Invalid report theme resource name')
  const registered = (report.resourcePackages || []).find(p => p.type === 'RegisteredResources' || p.name === 'RegisteredResources')
  const item = registered?.items?.find(item => item.name === name)
  const relative = item?.path || name
  const resources = path.join(root, 'StaticResources', 'RegisteredResources')
  const file = path.resolve(resources, relative)
  if (!file.startsWith(resources + path.sep) || path.extname(file).toLowerCase() !== '.json') throw Error('Report theme must reference a local registered JSON resource')
  let real
  try { real = await fs.realpath(file) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { theme: DEFAULT_REPORT_THEME, source: 'Power BI default', warnings: [`Referenced report theme ${name} is missing; preview uses the default theme.`] }
  }
  if (!real.startsWith(resources + path.sep)) throw Error('Report theme resource escapes the registered resource folder')
  if ((await fs.stat(real)).size > 1024 * 1024) throw Error('Report theme JSON exceeds the 1MB limit')
  return { theme: await read(real), source: name, warnings: [] }
}
