from pathlib import Path
import shutil,json,hashlib,zipfile,subprocess
running=subprocess.check_output(['powershell.exe','-NoProfile','-Command',"@(Get-Process PBIDesktop -ErrorAction SilentlyContinue).Count"],text=True).strip()
assert running=='0', 'Close Desktop normally before changing QA renderer resources'
root=Path('D:/semantic_app').resolve();source=(root/'cache/qa-local-pbip-20260907-224432').resolve();target=(root/'cache/qa-round3-theme-20261103').resolve()
assert target.is_relative_to(root/'cache') and source.is_relative_to(root/'cache') and source!=target
if not target.exists():shutil.copytree(source,target)
report=target/'AdventureWorks Report_FINAL.Report';guid='semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
with zipfile.ZipFile(root/'packages/core/assets/renderer.pbiviz') as z:
 meta=json.loads(z.read('package.json'));assert (meta.get('version') or meta['visual']['version'])==json.loads((root/'vilsem-renderer/pbiviz.json').read_text())['visual']['version'];dest=(report/'CustomVisuals'/guid).resolve()
 for name in z.namelist():
  p=(dest/name).resolve();assert p.is_relative_to(dest)
 z.extractall(dest)
stock={json.loads(p.read_text(encoding='utf-8'))['template']['meta']['id']:json.loads(p.read_text(encoding='utf-8')) for p in Path('D:/vilsem-mcp/templates').glob('stress2-*.vilsem-visual.json')}
updated=0
for p in (report/'definition/pages').glob('stress2_*/visuals/*/visual.json'):
 d=json.loads(p.read_text(encoding='utf-8'));assert d['visual']['visualType']==guid
 literal=d['visual']['objects']['semantica'][0]['properties']['primitiveSpec']['expr']['Literal'];spec=json.loads(literal['Value'][1:-1].replace("''","'"));identifier=spec.get('template',{}).get('meta',{}).get('id')
 if identifier in stock:
  literal['Value']="'"+json.dumps(stock[identifier],ensure_ascii=False,separators=(',',':')).replace("'","''")+"'";p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');updated+=1
assert updated==111
model=target/'AdventureWorks Report_FINAL.SemanticModel';baseline={str(p.relative_to(model)):hashlib.sha256(p.read_bytes()).hexdigest() for p in model.rglob('*') if p.is_file() and '.pbi' not in p.parts}
baselineFile=root/'cache/round3-model-hashes.json'
if baselineFile.exists():assert json.loads(baselineFile.read_text())==baseline, 'Model changed; refuse to replace baseline'
else:baselineFile.write_text(json.dumps(baseline,indent=2))
images=[{'path':p.relative_to(root).as_posix(),'sha256Before':hashlib.sha256(p.read_bytes()).hexdigest(),'status':'Needs inspection/regeneration'} for p in (root/'docs/qa').rglob('*.png')]
inventory=root/'docs/qa/stress3/screenshot-regeneration.json'
if not inventory.exists():inventory.write_text(json.dumps(images,indent=2)+'\n',encoding='utf-8')
print('Prepared private QA copy:',updated,'theme-native visuals; renderer',meta.get('version') or meta['visual']['version'],len(baseline),'model files hashed;',len(images),'QA screenshots inventoried. Original model/report untouched.')
