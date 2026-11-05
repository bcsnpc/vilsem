"""New private QA reports; no model writes or changes to the supplied report.

Four full-size cards per page avoid Desktop region captures clipping offscreen
cards on the old 3,600px test pages. Queries/specs are copied without alteration.
"""
from pathlib import Path
import argparse,copy,hashlib,json,zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--theme',choices=['light','dark'],required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[3]
workspace=root/'cache/qa-round3-theme-20261103'
source=workspace/'AdventureWorks Report_FINAL.Report'
target=workspace/f'Stress3 Theme {args.theme.title()}.Report'
assert target.resolve().is_relative_to((root/'cache').resolve())
assert not target.exists(), 'Refuse to overwrite an existing QA report'
model=workspace/'AdventureWorks Report_FINAL.SemanticModel'
baseline=json.loads((root/'cache/round3-model-hashes.json').read_text())
assert all(hashlib.sha256((model/k).read_bytes()).hexdigest()==v for k,v in baseline.items())
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
visuals=[]
for p in sorted((source/'definition/pages').glob('stress2_a*/visuals/stress2_???_*/visual.json')):
    visuals.append(read(p))
assert len(visuals)==111
visuals.sort(key=lambda v:v['name'])
if args.theme=='dark':
    visuals=[v for v in visuals if v['name'].startswith(('stress2_001_','stress2_037_','stress2_038_'))]
    visuals.append(read(source/'definition/pages/stress3_interactions/visuals/stress3_custom_bar/visual.json'))
write(target/'definition.pbir',read(source/'definition.pbir'))
write(target/'definition/version.json',read(source/'definition/version.json'))
guid='semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
with zipfile.ZipFile(root/'packages/core/assets/renderer.pbiviz') as z:
    dest=(target/'CustomVisuals'/guid).resolve()
    for name in z.namelist():assert (dest/name).resolve().is_relative_to(dest)
    z.extractall(dest)
packages=[p for p in read(source/'definition/report.json')['resourcePackages'] if p.get('name')==guid]
assert len(packages)==1
theme={'name':f'Stress3 {args.theme.title()}','background':'#111827' if args.theme=='dark' else '#ffffff','foreground':'#f2f2f2' if args.theme=='dark' else '#252423','dataColors':['#ffb347','#67e8f9','#c4b5fd','#f472b6'] if args.theme=='dark' else ['#118DFF','#12239E','#E66C37','#6B007B'],'textClasses':{'label':{'fontFace':'Segoe UI'}}}
theme['foregroundNeutralTertiary']='#555555' if args.theme=='dark' else '#dddddd'
# Palette background does not style native visual containers. An actual dark
# report must theme those too; a transparent renderer reveals that container.
theme['visualStyles']={'*':{'*':{'background':[{'color':{'solid':{'color':theme['background']}},'transparency':0}]}}}
themeName=f'stress3-{args.theme}.json'
write(target/'StaticResources/RegisteredResources'/themeName,theme)
packages.append({'name':'RegisteredResources','type':'RegisteredResources','items':[{'name':themeName,'path':themeName,'type':'CustomTheme'}]})
report=read(source/'definition/report.json')
report['resourcePackages']=packages
report['themeCollection']['customTheme']={'name':themeName,'type':'RegisteredResources','reportVersionAtImport':copy.deepcopy(report['themeCollection']['baseTheme']['reportVersionAtImport'])}
write(target/'definition/report.json',report)
order=[]
for offset in range(0,len(visuals),4):
    name=f'stress3_theme_{offset//4+1:02}'
    order.append(name)
    folder=target/'definition/pages'/name
    color={'solid':{'color':{'expr':{'Literal':{'Value':"'"+theme['background']+"'"}}}}}
    write(folder/'page.json',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json','name':name,'displayName':f'Theme {offset//4+1:02}','displayOption':'FitToPage','height':1200,'width':1800,'objects':{'background':[{'properties':{'color':color,'transparency':{'expr':{'Literal':{'Value':'0D'}}}}}]}})
    for i,v in enumerate(visuals[offset:offset+4]):
        v=copy.deepcopy(v)
        v['position'].update(x=i%2*900,y=i//2*600,width=900,height=600,z=i,tabOrder=i)
        write(folder/'visuals'/v['name']/'visual.json',v)
write(target/'definition/pages/pages.json',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json','pageOrder':order,'activePageName':order[0]})
project=read(workspace/'AdventureWorks Report_FINAL.pbip')
project['artifacts']=[{'report':{'path':target.name}}]
write(workspace/f'Stress3 Theme {args.theme.title()}.pbip',project)
assert all(hashlib.sha256((model/k).read_bytes()).hexdigest()==v for k,v in baseline.items())
print(f'Created new {args.theme} QA report: {len(visuals)} visuals, {len(order)} pages; model byte-identical')
