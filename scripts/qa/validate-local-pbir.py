"""Validate the generated QA report against Microsoft's published schemas."""
import json
import urllib.request
from pathlib import Path
import jsonschema

root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/qa/evidence'
artifact = json.loads((evidence / 'local-generated-report.json').read_text())
report = Path(artifact['reportPath']).parent
checks = []
for file in [report / 'definition.pbir', *sorted((report / 'definition').rglob('*.json'))]:
    value = json.loads(file.read_text(encoding='utf-8-sig'))
    try:
        with urllib.request.urlopen(value['$schema'], timeout=30) as response:
            schema = json.load(response)
        jsonschema.validate(value, schema)
        checks.append({'file': str(file.relative_to(report)), 'pass': True})
    except Exception as error:
        checks.append({'file': str(file.relative_to(report)), 'pass': False, 'error': str(error)[:1500]})
(evidence / 'local-pbir-schema-validation.json').write_text(json.dumps({'projectPath': artifact['projectPath'], 'checks': checks}, indent=2))
print(json.dumps(checks))
raise SystemExit(0 if all(check['pass'] for check in checks) else 1)
