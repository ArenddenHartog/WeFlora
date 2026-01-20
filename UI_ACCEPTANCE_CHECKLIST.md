# UI Acceptance Checklist

Use this checklist for QA, PR review, and regression testing.

---

## Page-Level Checks
- Page background matches Worksheets
- Only one scroll bar exists
- No cards used as layout scaffolding
- No tabs, previews, or accordions
- No meta subtitles (phase/category/version)

---

## Navigation & IA
- Planner Pack is not in left navigation
- Flows exist as first-class concept
- Runs list all executions
- Clicking a Flow creates a Run

---

## Skills Pages
- Skills list uses list/table layout
- Skill detail scrolls correctly
- Inputs show required vs optional
- Output schema is visible and copyable
- Output examples include insufficient_data

---

## Living Record / Runs
- Timeline renders from EventRecords only
- Events appear in chronological order
- Each event shows:
  - Timestamp
  - Agent/action name
  - Status
  - Inputs used
  - Outputs written
  - Evidence
  - Assumptions
- No event content is hidden by default
- Insufficient data events show missing inputs + next steps

---

## Scroll & Layout
- No nested scroll containers
- No horizontal scroll except for code blocks
- Map or large visuals do not create secondary scrollbars

---

## Visual Consistency
- Typography matches Worksheets
- WeFlora color used only as accent
- Status indicators are subtle, not headings

---

## Data Integrity
- Ledger shows state progression
- Inputs consumed are visible
- Outputs written are visible
- Subsequent events reference previous outputs
