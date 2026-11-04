# 0.4 release acceptance

- Public core: [core-v0.4.0](https://github.com/bcsnpc/vilsem/releases/tag/core-v0.4.0), sanitized public commit2730bc0, fast-forwarded to public main without private history.
- MCP: [v0.4.0](https://github.com/bcsnpc/vilsem-mcp/releases/tag/v0.4.0), commite6edeb3, pushed to main. Immutable public core-v0.4.0 dependency, not a local tarball or workspace symlink.
- Private app/source: main70e86f5 contains the audited source changes. Generated unrelated app build artifacts were excluded and preserved locally.
- Private and clean public app/core suites:956/956 each. Final MCP suite against the public core download:167/167 in408.30s. Its earlier165/167 run had two30s timing failures; both unchanged tests passed isolated2/2 before the full unchanged retry passed. No timeout or assertions were weakened.
- MCP published-core audit:0. App workspace audit:45 unresolved (19moderate,21high,5critical).
- Independent release-tarball consumer: installed outside both repositories, server0.4.0 stdio handshake; Desktop auto port56276 via process-workspace-port-file;13tables/39measures; real revenue query; word-cloud validate/explain/real-data PNG from130 product rows. No VILSEM_APP_PATH or app checkout.
- Public Git-tag install PASS: fresh standalone npm install of git+https://github.com/bcsnpc/vilsem-mcp.git#v0.4.0; stdio server0.4.0,134 total catalog entries including111 new stress templates, validate_spec of a new scratch template and fixture PNG PASS. Install audit0. This tag check does not repeat the separate live Desktop acceptance.
- All19 model definition hashes unchanged, also checked after final normal close. Original supplied PBIP untouched. Latest renderer4.31 hash matches QA/public/isolated installed package.

[Artifact SHA256 and structured acceptance](release-evidence.json) | [Isolated live consumer](isolated-consumer.json) | [Full report and limitations](final-report.md)

No npm-registry publication or new Electron installer is included. These releases do not close the nine documented capability refusals, broader cloud/interaction/formatting/resize certification, or app dependency backlog.
