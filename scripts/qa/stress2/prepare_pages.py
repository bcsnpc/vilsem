"""Create only new empty QA pages, preserving all existing report pages/visuals."""
from pathlib import Path
import json
root=Path('D:/semantic_app/cache/qa-local-pbip-20260907-224432/AdventureWorks Report_FINAL.Report/definition/pages').resolve()
assert root.is_relative_to(Path('D:/semantic_app/cache').resolve())
index=root/'pages.json';metadata=json.loads(index.read_text(encoding='utf-8-sig'))
for batch in (9,10):
 name=f'stress2_a{batch:02}';folder=(root/name).resolve();assert folder.is_relative_to(root)
 expected={'$schema':'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json','name':name,'displayName':f'Stress2-'+('B1' if batch==9 else 'B2-C1'),'displayOption':'FitToWidth','height':3600,'width':1800}
 if folder.exists():assert json.loads((folder/'page.json').read_text(encoding='utf-8-sig'))==expected
 else:
  folder.mkdir();(folder/'visuals').mkdir();(folder/'page.json').write_text(json.dumps(expected,indent=2),encoding='utf-8')
 if name not in metadata['pageOrder']:metadata['pageOrder'].append(name)
index.write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print('Preserved existing pages; ensured two new empty custom-visual QA pages')
