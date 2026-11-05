"""Rebuild item-to-format provenance from shipped, passing stress2 specs."""
import argparse
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--mcp-root', type=Path, default=root.parent/'vilsem-mcp')
args = parser.parse_args()
matrix = json.loads((root/'docs/qa/stress2/matrix.json').read_text(encoding='utf-8'))
passing = {item['id'] for item in matrix if item['status']=='PASS'}
tests = {
    'allocate':'stress2-layout-shaping', 'chunk':'stress2-layout-shaping', 'top':'stress2-layout-shaping', 'points':'stress2-layout-shaping',
    'waterfall':'stress2-sequence-shaping','heikinAshi':'stress2-sequence-shaping','hierarchy':'stress2-hierarchy-color','flows':'stress2-flow-shaping',
    'intervals':'stress2-temporal-shaping','stream':'stress2-temporal-shaping','conversion':'stress2-analytic-shaping','dateBands':'stress2-analytic-shaping',
    'boxplot':'stress2-distribution-shaping','histogram':'stress2-distribution-shaping','ecdf':'stress2-distribution-shaping','density':'stress2-density-shaping',
    'jitter':'stress2-jitter-shaping','words':'stress2-word-layout',
}
for key in ['qq','hexbin','density2d','groupShare','conditional','rebase','cohort','pivot','correlation','pareto','tiles']:
    tests[key]='stress2-statistical-shaping'
for key in ['calculate','facet','date','stat','window']:
    tests[key]='instantiateVisual'
uses = {}
structural = {}
structural_tests = {
    'concat': 'stress2-repeat-data', 'repeat/$item': 'stress2-repeat-data',
    'formatterTemplate': 'stress2-native-tooltip',
    'lastRowValue/lastRowLabel': 'stress2-kpi-accessors',
    'formatterEmptyText': 'stress2-kpi-accessors',
    'visual-scoped measures': 'scoped-measures',
}
def scan(node, item, file):
    if isinstance(node, dict):
        for key,value in node.items():
            feature = ('repeat/$item' if key == 'repeat' else key)
            if feature in structural_tests:
                record(feature, item, file, {key:value})
            scan(value,item,file)
    elif isinstance(node,list):
        for value in node: scan(value,item,file)
    elif isinstance(node,str):
        if node.startswith('$item'): record('repeat/$item',item,file,node)
        if re.search(r'\.lastRow(?:Value|Label)$',node):
            record('lastRowValue/lastRowLabel',item,file,node)
def record(feature,item,file,snippet):
    entry=structural.setdefault(feature,dict(items=set(),file=file,snippet=snippet))
    entry['items'].add(item)
for file in sorted((args.mcp_root/'templates').glob('stress2-*.vilsem-visual.json')):
    item = int(re.search(r'stress2-(\d+)',file.name)[1])
    if item not in passing: continue
    spec = json.loads(file.read_text(encoding='utf-8'))
    scan(spec,item,file)
    if spec.get('measures'): record('visual-scoped measures',item,file,{'measures':spec['measures']})
    for transform in spec.get('template',{}).get('transforms',[]):
        for key in transform:
            if key=='as': continue
            entry=uses.setdefault(key,dict(items=set(),file=file,snippet=transform))
            entry['items'].add(item)
marker='\n## Item-level format provenance (Round 3 reconstruction)\n'
lines=[marker,'\nReconstructed from the shipped passing specs and the core changes since `core-v0.3.0` (public commits `67944f9`, `331ce7f`, `2078a89`, `2730bc0`). The old matrix retains only one explicit `(b)` classification, so it cannot substantiate an exact historical count of 25 fallbacks. This table covers **every transform actually used by all 111 passing examples**, including derived approaches; it does not relabel those cases or infer missing historical classifications.\n', '\n| Feature | Stress2 item numbers | Regression suite | Complete shipped example |\n| --- | --- | --- | --- |\n']
examples=['\n## Stress2 transform examples by item\n','\nThese fragments are copied from passing shipped specs. Slot and calc names retain their original context; follow the complete-example link for its slot declarations, preceding transforms and bindings. All items below have native screenshot provenance in the Round2 matrix.\n']
for key,entry in sorted(uses.items()):
    suite=tests[key]+'.test.js'
    assert (root/'tests'/suite).is_file(),suite
    ids=', '.join(map(str,sorted(entry['items'])))
    link='https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/'+entry['file'].name
    lines.append(f'| `{key}` | {ids} | `tests/{suite}` | [{entry["file"].stem}]({link}) |\n')
    examples += [f'\n### `{key}` — items {ids}\n',f'\n[Complete example]({link}). Regression: `{suite}`.\n', '\n```json\n'+json.dumps(entry['snippet'],indent=2)+'\n```\n']
lines += ['\n### Structural, token and query features\n\n| Feature | Stress2 item numbers | Regression suite | Complete example |\n| --- | --- | --- | --- |\n']
for feature,entry in sorted(structural.items()):
    suite=structural_tests[feature]+'.test.js'
    assert (root/'tests'/suite).is_file(),suite
    ids=', '.join(map(str,sorted(entry['items'])))
    link='https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/'+entry['file'].name
    lines.append(f'| `{feature}` | {ids} | `tests/{suite}` | [{entry["file"].stem}]({link}) |\n')
    examples += [f'\n### `{feature}` — items {ids}\n',f'\n[Complete example]({link}). Regression: `{suite}`.\n','\n```json\n'+json.dumps(entry['snippet'],indent=2)+'\n```\n']
p=root/'docs/qa/stress2/format-additions.md'
text=p.read_text(encoding='utf-8').split(marker)[0]
p.write_text(text+''.join(lines),encoding='utf-8')
p=args.mcp_root/'docs/spec-format.md'
text=p.read_text(encoding='utf-8')
start='\n## Stress2 transform examples by item\n'
end='\n<!-- END GENERATED STRESS2 TRANSFORM EXAMPLES -->\n'
if start in text:
    before, previous=text.split(start,1)
    if end in previous:
        after=previous.split(end,1)[1]
    else:
        # Preserve handwritten sections appended after the old generated block.
        match=re.search(r'\n## (?!Stress2 transform examples by item)[^\n]+',previous)
        after=previous[match.start():] if match else ''
else:
    before,after=text,''
p.write_text(before+''.join(examples)+end+after,encoding='utf-8')
print(f'Indexed {len(uses)} transforms across {len(passing)} passing items; all referenced regression suites exist.')
