const fs = require('node:fs')
const source = 'docs/qa/evidence/full-audit.json'
const audit = JSON.parse(fs.readFileSync(source, 'utf8'))
const expectedEvents = audit.events.filter(e => e.scenario === 'workflows viewer' && e.message === '[AppSpec qa] error: QA query failure')
const rows = new Map()
for (const host of audit.hosts) if (!rows.has(host.type)) rows.set(host.type, { hosts: new Set(), attempts: 0, changes: 0, fingerprints: 0, noChange: 0, paths: new Set() })
for (const host of audit.hosts) rows.get(host.type).hosts.add(host.host)
for (const control of audit.properties) {
  const row = rows.get(control.typeId)
  if (!row) continue
  row.attempts++
  if (control.status === 'STATE_UPDATED') row.changes++
  if (control.renderChanged) row.fingerprints++
  if (control.status === 'NO_STATE_CHANGE') row.noChange++
  for (const delta of control.diff || []) row.paths.add(delta.path)
}
const lines = [
  '# Formatting control execution coverage', '',
  `Sweep complete: **${audit.complete === true ? 'Yes' : 'No'}**. Last recorded stage: ${audit.progress}.`, '',
  'These are actual editor/viewer/inspector executions using synthetic query data. A changed render fingerprint is a screening signal, not proof of correct typography, layout or behavior. An unchanged fingerprint can be expected for hidden controls, animation, hover, or an explicit value equal to the computed default.', '',
  '| Visual | Hosts mounted | Control attempts | State changes | Render fingerprint changes | No state change | Unique changed paths |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
]
for (const [type, row] of rows) lines.push(`| ${type} | ${[...row.hosts].join(', ')} | ${row.attempts} | ${row.changes} | ${row.fingerprints} | ${row.noChange} | ${row.paths.size} |`)
lines.push('', `Console/error events: ${audit.events.length}; ${expectedEvents.length} deliberate query-failure fixture events; ${audit.events.length - expectedEvents.length} unexpected events.`, '',
  'Control-level evidence: [format-control-results.csv](format-control-results.csv). Raw evidence: [full-audit.json](evidence/full-audit.json).', '',
  'Separate verified cases: native app interaction report, hosted Service selection/table report, text-token DOM report and individual bug regressions. This sweep does not certify AI editing or every export target.', '')
fs.writeFileSync('docs/qa/format-control-coverage.md', lines.join('\n'))
const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"'
const csv = [['visual', 'variant', 'tab', 'label', 'input', 'from', 'to', 'status', 'renderChanged', 'changedPaths'].map(quote).join(',')]
for (const c of audit.properties) csv.push([c.typeId, c.variant, c.tab, c.label, c.input, JSON.stringify(c.from), JSON.stringify(c.to), c.status, c.renderChanged, JSON.stringify(c.diff)].map(quote).join(','))
fs.writeFileSync('docs/qa/format-control-results.csv', csv.join('\n') + '\n')
console.log(JSON.stringify({ complete: !!audit.complete, visuals: rows.size, attempts: audit.properties.length, errors: audit.events.length }))
