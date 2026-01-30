# UI Acceptance Checklist

Use this checklist for QA, PR review, and regression testing.

---

# UI Acceptance Checklist – WeFlora

QA must tick **ALL** items before approval.

---

## Layout & Scroll

- [ ] Exactly one vertical scroll container
- [ ] No nested `overflow-y-auto`
- [ ] No `min-h-screen` in page components
- [ ] Page uses PageShell → PageHeader → PageBody

---

## Typography

- [ ] Page title uses correct H1 class
- [ ] Subtitle uses correct style (or absent)
- [ ] Section headers use correct H2 class
- [ ] No decorative or redundant subtitles
- [ ] Text hierarchy is clear without color hacks

---

## Icons & Color

- [ ] All icons are inside colored containers
- [ ] Status badges use approved colors only
- [ ] No raw/uncolored icons
- [ ] No arbitrary colors introduced

---

## Living Ledger / Sessions

- [ ] Timeline is vertical and chronological
- [ ] No cards around steps
- [ ] Each step shows:
  - [ ] What happened
  - [ ] Inputs
  - [ ] Outputs
  - [ ] Evidence
  - [ ] Assumptions
- [ ] Follow-up interaction only on insufficient_data
- [ ] No conversational tone in factual steps

---

## Skills / Flows

- [ ] Clear description of purpose
- [ ] Clear list of inputs
- [ ] Clear indication of outputs
- [ ] Clear way to initiate/run
- [ ] No dead-end pages

---

## General UX

- [ ] Page explains itself without prior knowledge
- [ ] No empty states without guidance
- [ ] UI feels consistent with Worksheets typography
- [ ] No unexplained visual differences between pages

---

## Final Gate

- [ ] Feels like ONE system
- [ ] Readable without scrolling confusion
- [ ] Usable by a first-time user

Approval requires **100% compliance**.
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
