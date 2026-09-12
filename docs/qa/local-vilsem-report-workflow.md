# Local model -> new Vilsem report

## Implemented development workflow

1. Keep the selected PBIP model, or an unchanged copy, open in Power BI Desktop.
2. Restart Vilsem after updating the Electron code. The setup screen offers Work with a local PBIP model to reach Home without Fabric sign-in.
3. Home > Create new project: enter a new report name, choose Local PBIP model, choose the PBIP folder, then Next.
4. Vilsem matches the model definition fingerprint against open Desktop PBIP sessions, discovers its fields and opens an empty report. The existing Power BI report is never imported into the canvas.
5. Library > Bar: add a new visual. In Data, bind Quantity Sold and Product Categories Lookup > CategoryName.
6. Save writes a new Vilsem project to its SQLite store, including the local source reference. Reopening a local project reconnects through its source reference; it does not reuse a persisted ephemeral port.

This is a Vilsem saved report, not yet a PBIP/PBIR export. The fourth local-output option remains unfinished.

## Verification

Production Home/AppGenerator, local provider, query/metadata handlers and save/load IPC were exercised in an isolated Electron profile using the real AdventureWorks model loaded from a QA copy. The native picker alone was substituted with the known source path in automation.

- Home creates a separate local report.
- Bar created through the Library UI.
- Data controls bind the real local measure/dimension; actual ECharts series must contain13929,12436,57809 before acceptance.
- Save persists source reference and new visual through production SQLite/IPC; database is reopened for the assertion.
- Saved report remounts; test waits for the old chart to be removed and the new chart to contain the expected data. Captured compositor screenshot visually inspected.

Evidence: local-report-ui.json (5checks), local-vilsem-report.json (new report spec), local-report-canvas.png, local-report-source-integrity.json. QA profile path is recorded in the UI report; this test project is intentionally separate from the user's normal Recent list.

Related regressions: shell16/16, authoring10/10; unit492pass/1existingfailure; final UI build passed30.26s. PS script unpacking added to package configuration; packaged-installer execution is not yet verified.

## Source protection and limitations

All157 original files rehashed unchanged after the development tests. No source report/model files or existing measures changed. No new measures were required. Model discovery returns field metadata, excluding partition/data-source definitions.

Current implementation targets Windows and the installed Desktop ADOMD client. It finds sessions started with a quoted PBIP file argument, matches definitions and uses the session's catalog/port. It does not launch Desktop, refresh models or write measures. Unsupported/missing sessions fail with retry instructions. Multiple matching model copies, Desktop opened through other entry points, arbitrary models, closed/restarted-engine recovery and packaged deployment need broader acceptance.

Local relationships/advanced AI model context, full metadata typing, all visual families, local/cloud switching UX and export parity are not certified. Local-to-Fabric saved-project opening fails closed with a reconnect instruction rather than routing the Fabric report to the local model. This development slice verifies the new-report/create/query/save/reopen core only.
