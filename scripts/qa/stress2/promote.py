"""Promote only individually inspected cases after all recorded tool inputs match."""
import json,shutil,sys
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[3];out=Path('D:/vilsem-mcp/test-results/stress2');matrix=root/'docs/qa/stress2/matrix.json';m=json.loads(matrix.read_text(encoding='utf-8'))
cases=[]
for f in out.glob('cases-*.json'):cases.extend(json.loads(f.read_text(encoding='utf-8')))
for n in map(int,sys.argv[1:]):
 c=next(c for c in cases if c['id']==n);spec=json.loads((out/'pending'/c['file']).read_text(encoding='utf-8'))
 for tool in ['validate_spec','explain_visual','preview_visual','commit_visual']:
  stem=f"{n:03}-{c['slug']}-{tool}.json";f=out/('retry-'+stem)
  if not f.exists():f=out/stem
  evidence=json.loads(f.read_text(encoding='utf-8'));assert not evidence.get('isError'),(n,tool)
  assert evidence.get('request',{}).get('spec')==spec,(n,tool,'spec mismatch')
  assert evidence['request'].get('bindings')==c['bindings'],(n,tool,'binding mismatch')
  assert list(evidence['request']['spec'].get('template',{}).get('slots',{}))==list(spec.get('template',{}).get('slots',{})),(n,tool,'slot order mismatch')
  if tool in ['explain_visual','preview_visual'] and 'maxRows' in c:
   assert evidence['request'].get('maxRows')==c['maxRows'],(n,tool,'query window mismatch')
 png=f"{n:03}-{c['slug']}.png";assert (root/'docs/qa/stress2'/png).stat().st_size>1000
 with Image.open(root/'docs/qa/stress2'/png) as im:
  assert abs(im.height-im.width/(892/592))<=6,(n,'partial screenshot surface')
 m[n-1].update(status='PASS',reason='All four actual MCP operations succeeded with this exact spec; individual native Desktop rendering/screenshot inspected.',evidence=png)
 shutil.copyfile(out/'pending'/c['file'],Path('D:/vilsem-mcp/templates')/('stress2-'+c['file']))
 print('Promoted inspected case',n)
matrix.write_text(json.dumps(m,indent=2,ensure_ascii=False),encoding='utf-8')
