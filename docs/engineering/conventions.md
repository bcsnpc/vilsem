# Engineering conventions for the audit and follow-up work

These are working conventions, not a claim the entire repository already follows them.

- Preserve existing working behavior and local user changes. Use the audit priority plan, not opportunistic refactoring.
- App Spec contains persisted user intent; underscore-prefixed rendering callbacks/context are runtime-only. Avoid persisting functions, tokens or transport objects.
- Public settings need a named supported operation, type/default/range, visible control policy and renderer consumer. UI and AI must use the same operation semantics.
- Perform hooks on every render; empty/loading/error states must not change hook count. Query failures must not become invented business values.
- Keep scale/domain/format/normalization logic pure where practical; tests import production functions. Do not copy algorithms into tests and call that production coverage.
- Use safe synthetic datasets and isolated userData/database directories. Do not use remote publishing scripts as default tests.
- Validate per-visual capability, not just a universal config object's shape. Unsupported field combinations need explicit feedback.
- Bound plot marks separately from titles/legends/tooltips. Avoid blanket overflow fixes; retain intentional scrolling and visible error states.
- Treat screenshots as baselines only after stable fonts, DPR, animations, data, readiness and human review are established.
- Record command outcomes, original reproduction, changed files, regression scope and remaining limits in the work log. Mark VERIFIED only after meaningful automated or runtime confirmation.
- Generated inventory files come from scripts/qa/document-inventory.cjs plus renderer evidence. Their lexical discoveries are incomplete until reconciled against actual conditional UI controls.
