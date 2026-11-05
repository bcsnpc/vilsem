"""Refresh owned QA renderer/specs offline, retaining pane overrides and queries."""
from pathlib import Path
import hashlib,json,subprocess,zipfile
root=Path(__file__).resolve().parents[3]
assert subprocess.check_output(['powershell.exe','-NoProfile','-Command',"@(Get-Process PBIDesktop -ErrorAction SilentlyContinue).Count"],text=True).strip()=='0','Close Desktop normally first'
workspace=root/'cache/qa-round3-theme-20261103'
model=workspace/'AdventureWorks Report_FINAL.SemanticModel'
baseline=json.loads((root/'cache/round3-model-hashes.json').read_text())
assert all(hashlib.sha256((model/k).read_bytes()).hexdigest()==v for k,v in baseline.items())
stock={json.loads(p.read_text())['template']['meta']['id']:json.loads(p.read_text()) for p in (root.parent/'vilsem-mcp/templates').glob('stress2-*.vilsem-visual.json')}
guid='semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
for theme in ['Light','Dark']:
    report=workspace/f'Stress3 Theme {theme}.Report'
    assert report.resolve().is_relative_to((root/'cache').resolve()) and report.is_dir()
    with zipfile.ZipFile(root/'packages/core/assets/renderer.pbiviz') as z:
        dest=(report/'CustomVisuals'/guid).resolve()
        for name in z.namelist():assert (dest/name).resolve().is_relative_to(dest)
        z.extractall(dest)
    changed=0
    for p in (report/'definition/pages').glob('*/visuals/*/visual.json'):
        d=json.loads(p.read_text())
        literal=d['visual']['objects']['semantica'][0]['properties']['primitiveSpec']['expr']['Literal']
        spec=json.loads(literal['Value'][1:-1].replace("''","'"))
        identifier=spec.get('template',{}).get('meta',{}).get('id')
        if identifier not in stock:continue
        literal['Value']="'"+json.dumps(stock[identifier],separators=(',',':')).replace("'","''")+"'"
        p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8');changed+=1
    expected=111 if theme=='Light' else 3
    if theme=='Light' and (report/'definition/pages/stress3_treemap_contrast').is_dir():expected+=2
    assert changed==expected
    print(theme,changed,'specs refreshed; query/layout/pane objects preserved')
assert all(hashlib.sha256((model/k).read_bytes()).hexdigest()==v for k,v in baseline.items())
print('21/21 model hashes unchanged')
