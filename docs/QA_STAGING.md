# Staging QA Guide

## 1) Critical user flows
Use these to anchor exploratory testing and manual regression.

### Worksheet creation
1. Navigate to **Worksheets** from the left sidebar.
2. Click **New Worksheet** (worksheet templates view).
3. Choose **Blank** or **Use Template**.
4. Confirm the new worksheet opens and the title updates in the header.

### Adding skill templates (AI columns)
1. Open a worksheet.
2. Click **Settings** (right panel) → **Skills / Manage Worksheet**.
3. Add a skill template and confirm a new AI column appears.
4. Verify the column title matches the skill template name.

### Editing columns
1. In a worksheet grid, open the column **…** menu.
2. Rename the column and adjust column settings.
3. Confirm the column header updates and settings persist after reload.

### Export
1. In a worksheet, use the **Download** (export) action in the toolbar.
2. Save the exported file and verify it contains expected column headers + rows.

### AI preview
1. Open an AI column settings panel.
2. Confirm the preview prompt updates as template params change.
3. Run a single AI cell and confirm display format matches the expected output type.

## 2) Error boundaries + staging logging
Worksheet UI is wrapped in error boundaries for staging visibility:
- Worksheet workspace (main editor).
- Worksheet side panel (skills/manage, chat, files, species).
- Worksheet templates + wizard (list view).

Captured errors are logged to the console and stored on `window.__WF_STAGING_ERRORS` for quick inspection in staging.

## 3) Smoke test checklist (manual)
> Perform these steps in the staging UI and watch for console errors.

- [ ] Open **Worksheets** and load a worksheet.
- [ ] Create a blank worksheet and add a new row.
- [ ] Add an AI column via **Manage Worksheet** and run AI for a single cell.
- [ ] Edit a column title and verify the update persists after reload.
- [ ] Export the worksheet and verify column headers and at least one row are present.
- [ ] Open **Chat** panel and send a prompt scoped to the worksheet.
- [ ] Verify no red console errors and `window.__WF_STAGING_ERRORS` is empty.

## 4) AI prompt/output consistency validation
Use these steps to validate outputType enforcement across templates:
1. Add at least **three** different skill templates (badge, score, currency).
2. Run one AI cell for each template.
3. Confirm the output format is enforced:
   - **Badge:** `Status - Brief Rationale`
   - **Score:** `NN/100 - Key Reason`
   - **Currency:** `€Amount` (or `$Amount` if the template allows)
4. Confirm invalid formatting is flagged in the cell (error indicator).

## 5) Performance warnings: review + decision
- Check the build output (Vite) for chunk size warnings and the browser console for slow script warnings.
- **Decision:** Defer performance tuning unless build output shows chunk warnings or staging LCP exceeds 2.5s. If warnings appear, triage before broader testing.

## 6) Known limitations (for testers)
- **AI generation depends on API keys** (`VITE_GOOGLE_API_KEY`); missing keys can cause AI errors.
- **Worksheet export formatting** is basic and does not preserve column formatting beyond plain values.
- **Legacy AI prompt columns** may not include template-based validators unless migrated to a skill template.
- **Global files panel** in worksheets is placeholder-only and requires a project context for file access.
