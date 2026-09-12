const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..')
const fixes={
 'PERSIST-001':'Reject colliding rename/ambiguous save; display rename errors. Storage tests and persistence-ui.json pass.',
 'DATA-EDITOR-001':'Include all query inputs in dedup guard. data-audit-after.json: all 299 checks pass.',
 'DATA-ERROR-001':'Propagate editor errors; retain viewer cards on empty/error. visual-fix-regressions.json passes.',
 'VIS-RACE-001':'Clear chart on empty/loading/error. data-audit-after.json passes.',
 'VIS-LINE-001':'Run hooks before state returns. Line-family transitions pass in both hosts.',
 'VIS-FUNNEL-001':'Replace demo fallback with empty/error state. Host zero/empty/error/recovery tests pass.',
 'VIS-AREA-001':'Provide Area registry adapter. Actual series area options verified.',
 'VIS-STACKED-AREA-001':'Forward stacked to LineMarks; shared stack and opt-out verified.',
 'VIS-TABLE-001':'Preserve/query/render dimension-only tables without phantom measure. DAX and mounted host tests pass; live Fabric untested.',
 'SPEC-CUSTOM-001':'Accept custom type and validate actual template. Production schema regression passes.',
 'SPEC-SLICER-001':'Accept supported multi_select type. Production schema regression passes.',
 'AI-SLICER-001':'Preserve multi_select through sanitizer. contract-audit-after.json passes this case.',
 'SPEC-INPUT-001':'Guard invalid visual element shape. Regression passes.',
 'SPEC-INPUT-002':'Validate nested page slicers. Regression passes.',
 'FILTER-001':'Prevent excluded slicer keys re-entering generic filter pass. Production regression passes.',
 'LAYOUT-001':'Wrap excess KPIs to additional positive-width rows. Fourteen-KPI regression passes.',
 'LAYOUT-DRAG-001':'Clamp X using visual width. Native far-right drag/resize pass.',
 'TOOLTIP-001':'Encode data text in HTML formatter. Unit and native tooltip checks pass.',
 'VIS-HEATMAP-001':'Fit grid rows to available height. Default four-cell bounds pass in both hosts.',
 'VIS-NARRATIVE-001':'Name comparison measure and handle zero denominator. Component and mounted tests pass.',
}
for(const file of ['bug-log.md','full-audit-findings.md','schema-filter-findings.md','clipping-review.md','visual-review-findings.md','continuation-findings.md']){
 const p=path.join(root,'docs/qa',file);let text=fs.readFileSync(p,'utf8')
 text=text.replace(/(^## ([A-Z][A-Z0-9-]+)[^\n]*\n)([\s\S]*?)(?=^## |$(?![\s\S]))/gm,(whole,heading,id,body)=>{
  if(!fixes[id])return whole
  body=body.replace(/^- (?:\*\*)?Status[^\n]*\n/gm,'').replace(/^- (?:\*\*)?Fix(?:\*\*)?:[^\n]*\n/gm,'')
  return heading+'\n- **Status:** VERIFIED (local scope).\n- **Fix and verification:** '+fixes[id]+' See [fix status](fix-status.md).\n'+body
 })
 if(!text.includes('Current repair status:'))text=text.replace(/^(# [^\n]*\n)/,'$1\nCurrent repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.\n')
 text=text.replace('All findings are **Open**. No fix has been applied.','The current status is recorded per finding below.').replace('All findings are **Open**.','The current status is recorded per finding below.')
 fs.writeFileSync(p,text)
}
console.log('Updated '+Object.keys(fixes).length+' verified issue records.')
