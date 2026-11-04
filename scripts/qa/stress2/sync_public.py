"""Copy reviewed source/artifacts into a clean checkout of public/main.

No private Git history, environment files, PBIP/model folders or raw QA data.
"""
from pathlib import Path
import subprocess,shutil,json
root=Path(__file__).resolve().parents[3];target=Path('D:/vilsem-core-release-040').resolve()
assert subprocess.check_output(['git','rev-parse','--show-toplevel'],cwd=target,text=True).strip().replace('\\','/').lower()==str(target).replace('\\','/').lower()
def paths(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).splitlines()
explicit={'package-lock.json','packages/core/package.json','packages/core/README.md','packages/core/assets/renderer.pbiviz','tests/core-injection.test.js','tests/instantiateVisual.test.js','tests/power-bi-selection-runtime.test.ts','vilsem-renderer/src/visual.ts','vilsem-renderer/capabilities.json','vilsem-renderer/pbiviz.json','vilsem-renderer/dist/package.json'}
files={p for p in paths('diff','--name-only') if p in explicit or p.startswith('packages/core/src/')}
files.update(p for p in paths('ls-files','--others','--exclude-standard','packages/core/src','tests') if p.startswith('packages/core/src/') or p.startswith('tests/stress2-') and p.endswith('.test.js') or p=='tests/scoped-measures.test.js')
metadata=json.loads((root/'vilsem-renderer/pbiviz.json').read_text());v=metadata['visual'];files.add(f'vilsem-renderer/dist/{v["guid"]}.{v["version"]}.pbiviz')
for folder in ('scripts/qa/stress2','docs/qa/stress2'):
 files.update(p.relative_to(root).as_posix() for p in (root/folder).rglob('*') if p.is_file() and p.suffix in ('.py','.md','.json','.png'))
for relative in sorted(files):
 src=(root/relative).resolve();dst=(target/relative).resolve()
 assert src.is_relative_to(root) and dst.is_relative_to(target)
 assert not any(part in ('.env','node_modules','cache','pbip folder') for part in Path(relative).parts)
 dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
print('Copied',len(files),'reviewed code/test/chart evidence files; private history and raw model untouched')
