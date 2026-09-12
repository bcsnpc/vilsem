# Vilsem engineering phases

This tracker retains the original scope. A passing subset never implies a phase is complete. Work continues across phases without requiring a new approval at each boundary.

| Phase | Scope | Current status / remaining work |
| --- | --- | --- |
| 1 | Understand the entire repository | Architecture and runtime flows documented; revisit affected dependencies before fixes. |
| 2 | Run the application and trace user journeys | Electron and local authoring exercised; packaged install and full authenticated journeys pending. |
| 3 | Inventory every visualization | 41 IDs inventoried; coverage and supported-target differences remain explicit. |
| 4 | Trace each visual's construction | Shared/duplicated primitive paths documented; Desktop and Power BI runtimes still differ. |
| 5 | Cross-visual consistency | Matrices and control tests exist; complete detailed formatting consistency remains open. |
| 6 | Clipping and boundary audit | Broad cases exercised; unresolved candidates and exported Column label clipping remain. |
| 7 | Realistic and edge-case datasets | Synthetic cases plus real AdventureWorks queries used; not every visual/data combination validated. |
| 8 | Formal per-visual test matrix | Matrix exists; filling untested formatting, interaction and persistence cases continues. |
| 9 | UI/AI parity | Contracts and mapping audit exist; invalid-config acceptance and live AI coverage pending. |
| 10 | UX audit | Home, shared dialogs, Playground improvements tested; accessibility and complete workflow polish pending. |
| 11 | Bug/enhancement logs | Maintained with evidence and scoped statuses. |
| 12 | Architecture issues | Logged and prioritized; no blanket refactor. |
| 13 | Prioritization | P0/P1 correctness before lower-priority polish; consult priority-plan.md. |
| 14 | Systematic fixes/retests | Ongoing. Local renderer registration corrected; other issues remain open. |
| 15 | Automated regression tests | Unit and Electron suites exist; installer, live services and additional interactions pending. |
| 16 | Visual regression | Deterministic galleries/evidence exist; full reviewed screenshot baselines pending. |
| 17 | Final product documentation | Core documents exist; maintain truthfulness as behavior and coverage evolve. |

## Cross-cutting delivery work

- Local PBIP model -> new Vilsem report -> Save as Power BI preview: production UI/IPC writer connected; loaded UI creation passed on an isolated model copy; the UI-generated Bar report renders in Desktop. Full save/reopen and broader visual parity remain pending.
- Local mode excludes cloud/web outputs. Fabric mode retains its targets plus Power BI file preview; actual Fabric-backed local file validation pending.
- Full-page nine-visual Desktop gallery renders in dark mode; detailed format/interaction/save-reopen and remaining types unverified.
- Every export must preserve model/report source files, field bindings and saved report theme. Unsupported content must not be silently dropped.
- Preserve the working Service publisher while developing enhanced PBIR local output.

## Immediate sequence

1. Finish isolated UI-export/Desktop verification and document usable preview steps.
2. Verify save/reopen and light theme; resolve full-page gallery defects.
3. Broaden supported visuals, detailed formatting and interactions with regression checks.
4. Return to AI validation, canvas/Playground/Present gaps, actual target deployment checks, packaging and release readiness.
