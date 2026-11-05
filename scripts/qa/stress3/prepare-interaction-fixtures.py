"""External native QA fixture setup. Not part of the custom-visual MCP tools."""
import copy
import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
report = root / 'cache/qa-round3-theme-20261103/AdventureWorks Report_FINAL.Report'
assert report.resolve().is_relative_to((root / 'cache').resolve())
pages = report / 'definition/pages'
page_name = 'stress3_interactions'
target = pages / page_name
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding='utf-8')
def source(visual_type):
    for file in pages.glob('*/visuals/*/visual.json'):
        if file.parent.parent.parent.name == page_name: continue
        value = read(file)
        if value.get('visual', {}).get('visualType') == visual_type: return copy.deepcopy(value)
    raise ValueError(f'Missing native source: {visual_type}')
def clone(visual_type, name, x, y, width, height):
    value = source(visual_type)
    for key in ['parentGroupName', 'filterConfig', 'annotations']: value.pop(key, None)
    value['name'] = name
    value['position'] = dict(x=x, y=y, width=width, height=height, z=10, tabOrder=10)
    value['visual'].pop('objects', None)
    value['visual'].pop('visualContainerObjects', None)
    return value
page = dict(**{'$schema':'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json'}, name=page_name, displayName='Stress3 Interactions', displayOption='FitToPage', width=1280, height=720,
    visualInteractions=[
        dict(source='stress3_custom_bar',target='stress3_native_card',type='DataFilter'),
        dict(source='stress3_native_bar',target='stress3_custom_bar',type='HighlightFilter'),
        dict(source='stress3_native_slicer',target='stress3_custom_bar',type='DataFilter'),
    ])
if (target/'page.json').exists(): raise ValueError('QA page exists; preserve it and inspect before modifying')
write(target/'page.json', page)
card = clone('cardVisual','stress3_native_card',790,0,480,190)
write(target/'visuals/stress3_native_card/visual.json',card)
slicer = clone('slicer','stress3_native_slicer',800,210,470,230)
projection = slicer['visual']['query']['queryState']['Values']['projections'][0]
projection['field']['Column']['Expression']['SourceRef']['Entity']='Product Categories Lookup'
projection['field']['Column']['Property']='CategoryName'
projection.update(queryRef='Product Categories Lookup.CategoryName',nativeQueryRef='CategoryName')
slicer['visual']['objects'] = {'data':[{'properties':{'mode':{'expr':{'Literal':{'Value':"'Basic'"}}}}}]}
write(target/'visuals/stress3_native_slicer/visual.json',slicer)
native = clone('clusteredBarChart','stress3_native_bar',0,450,1280,260)
measure = native['visual']['query']['queryState']['Y']['projections'][0]
measure['field']['Measure']['Property']='Total Revenue'
measure.update(queryRef='Measure Table.Total Revenue',nativeQueryRef='Total Revenue')
native['visual']['query']['sortDefinition']['sort'][0]['field']['Measure']['Property']='Total Revenue'
write(target/'visuals/stress3_native_bar/visual.json',native)
index = read(pages/'pages.json')
index['pageOrder'].append(page_name)
write(pages/'pages.json',index)
print('Prepared isolated native card, category slicer and native bar; no model files changed.')
