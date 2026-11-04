"""Archive exact existing own-renderer QA containers for fresh MCP re-commit."""
from pathlib import Path
import json,shutil
base=Path('D:/semantic_app/cache').resolve();report=base/'qa-local-pbip-20260907-224432/AdventureWorks Report_FINAL.Report'
backup=base/'stress2-before-final-polish30';backup.mkdir(exist_ok=True)
out=Path('D:/vilsem-mcp/test-results/stress2')
cases={c['id']:c for b in ('a9','a10') for c in json.loads((out/f'cases-{b}.json').read_text(encoding='utf-8'))}
for n in (97,98,99,101,102,103,105,118):
 c=cases[n];src=(report/'definition/pages'/c['pageName']/'visuals'/c['visualName']).resolve();dst=(backup/c['visualName']).resolve()
 assert src.is_relative_to(report.resolve()) and dst.is_relative_to(base)
 if not src.exists():assert dst.exists();continue
 assert not dst.exists(),'Archive already exists; refuse replacement'
 visual=json.loads((src/'visual.json').read_text(encoding='utf-8-sig'));assert visual['visual']['visualType']=='semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
 shutil.move(str(src),str(dst));print('Archived own QA container',n)
