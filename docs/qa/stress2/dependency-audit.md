# Dependency audit ? 2026-11-03

- MCP dependency tree: npm install audit reports 0 vulnerabilities (154 packages).
- App/root dependency tree: {'info': 0, 'low': 0, 'moderate': 19, 'high': 21, 'critical': 5, 'total': 45}
- Critical packages reported: concurrently, shell-quote, tar, tinypool, vitest.
- Full machine-readable app evidence: ignored cache/stress2-app-audit.json.
- These are advisory counts in the installed tree, not a demonstrated exploit in the renderer or a production reachability assessment. Dependency remediation remains open; no installer-readiness/certification claim is made. Force upgrades were not applied during the declarative-format acceptance work.
