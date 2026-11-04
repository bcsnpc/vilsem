"""Record only actual four-tool refusal evidence and retain failed authored specs."""
from pathlib import Path
import json,shutil
out=Path('D:/vilsem-mcp/test-results/stress2');mcp=out.parents[1]
summary=json.loads((out/'refusals-final.json').read_text(encoding='utf-8'))
cases={c['id']:c for batch in ('a8','a10') for c in json.loads((out/f'cases-{batch}.json').read_text(encoding='utf-8'))}
root=Path(__file__).resolve().parents[3];matrix=root/'docs/qa/stress2/matrix.json';m=json.loads(matrix.read_text(encoding='utf-8'))
section=['## Stress round 2: final unsupported cases','',
'All four actual MCP operations (`validate_spec`, `explain_visual`, `preview_visual`, `commit_visual`) refused each case below. The harness asserted target-container absence before and after every group of calls. Failed specs are retained separately from shipped working templates. No extension was implemented.','',
'| Case | Reason / exact primary diagnostic | Proposed extension |','| --- | --- | --- |']
for item in summary:
 n=item['id'];c=cases[n];assert item['noContainerWritten'];assert len(item['errors'])==4
 assert [e['tool'] for e in item['errors']]==['validate_spec','explain_visual','preview_visual','commit_visual']
 messages=[e['error'] for e in item['errors']];assert len(set(messages))==1
 # Current validation may repeat the same diagnostic in separate guards;
 # retain the full literal tool response in the evidence file below.
 message=messages[0].splitlines()[0]
 design=('A locally shipped, bounded and versioned geography asset, projection, validated coordinates and dedicated geo modules; the current model also lacks lat/long fields.' if n in (111,112,113,114) else
 'A bounded word-placement/collision module and text display list.' if n==116 else
 'A weighted power-diagram solver and validated bounded polygon display list.' if n==117 else
 'A separate isolated GL/3D renderer with bounded mesh/camera resources and explicit device support.' if n==119 else
 'A constrained area-overlap layout and model-evaluated intersection counts; never infer intersections from marginal counts.' if n==120 else
 'A bounded variable-width/height rectangle display list.')
 section.append(f'| {n:03} [{c["slug"]}](expressiveness/stress2-{c["file"]}) | `{message}` | {design} |')
 shutil.copyfile(out/'pending'/c['file'],mcp/'docs/expressiveness'/('stress2-'+c['file']))
 m[n-1].update(status='FAIL (c) - not implemented by scope',classification='c',reason=f'All four actual MCP operations refuse: {message}. No target container written. '+('No map asset or coordinate fields available. ' if n in (111,112,113,114) else '')+'Sandbox/asset requirements documented.')
section.extend(['','Geography is environment/capability-limited, not a claim that map rendering inherently needs arbitrary callbacks. A map asset and real coordinate/geocoding inputs are prerequisites; none were fabricated or downloaded. Tile grids (115) use explicit authored coordinates and are tested separately.','',
'Word-cloud layout, weighted Voronoi tessellation and exact Euler-area fitting are not supplied native series in the current renderer. They would require additional layout/geometry modules; a plain treemap, random circles or scatter labels are not accepted substitutes. These Tier-C probes stop at explicit refusal as requested.','',
'All extensions must preserve the security model below: no inline JavaScript/eval, DOM/network/filesystem/model-connection access, bounded execution/memory/display lists and source identities. Web Workers and node:vm alone are not security boundaries. GL needs a distinct renderer boundary; local map assets need provenance/licensing, size limits and no remote URL loading.','',
'The full literal diagnostics, including any duplicate guard messages, are retained in [refusal evidence](stress2-refusals.json).',''])
(mcp/'docs/stress2-refusals.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
p=mcp/'docs/expressiveness-gaps.md';s=p.read_text(encoding='utf-8');heading='# Expressiveness audit and imperative gap\n';assert s.startswith(heading)
p.write_text(heading+'\n'+'\n'.join(section)+'\n'+s[len(heading):],encoding='utf-8')
matrix.write_text(json.dumps(m,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'Recorded{len(summary)*4} actual refusals across{len(summary)} cases; no containers written')
