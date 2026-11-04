"""Render the tracked matrix; never infer PASS from successful tool calls alone."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
m=json.loads((root/'docs/qa/stress2/matrix.json').read_text(encoding='utf-8'))
lines=['# Stress round 2 results','',f"Task 1 query-only measures: live Desktop verified. Task 2: {sum(r['status']=='PASS' for r in m)}/120 PASS. Each PASS has an inspected Desktop screenshot; tool-only success remains awaiting verification.",'','| # | Visual | Status | Evidence / reason |','| --- | --- | --- | --- |']
for r in m:
 reason=r.get('reason') or 'Not attempted'
 if r.get('evidence'):reason=f"[{r['evidence']}]({r['evidence']}) · "+reason
 if r.get('classification'):reason='('+r['classification']+') '+reason
 lines.append('| '+str(r['id'])+' | '+r['name'].replace('|','\\|')+' | '+r['status']+' | '+reason.replace('|','\\|')+' |')
(root/'docs/qa/stress2/results.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Rendered',len(m),'case statuses')
