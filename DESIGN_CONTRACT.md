# WeFlora Design Contract v1.0 (Strict)

**Status:** MANDATORY  
**Applies to:** All new and refactored UI from Phase 1 onward.

## Purpose
This document defines the non-negotiable UI/UX and interaction contract for WeFlora.  
It exists to ensure design consistency, auditability, and correct functional testing of the agentic system and Living Record.  
**This contract is authoritative. If an implementation conflicts with this document, the implementation is wrong.**

---

## 0. First Principles (Non-Negotiable)
1. **The Living Record is the product**
   - The system must expose machine state, agent decisions, and data flow explicitly.
   - UI must behave like a lab notebook / ledger, not a dashboard.
2. **Ledger-first, renderer-only UI**
   - UI renders EventRecords only.
   - No hidden state, inferred logic, or UI-only summaries.
3. **One design system**
   - Pages must visually and structurally align with existing Worksheets pages.
   - No per-page creativity.
4. **Density over decoration**
   - This is professional tooling, not a marketing surface.

---

## 1. Absolute Visual Prohibitions
The following are not allowed anywhere in core product pages (Skills, Flows, Runs, Living Record):
- ❌ Green or tinted page backgrounds
- ❌ Card-based page scaffolding
- ❌ Floating panels or envelopes
- ❌ Tabs, previews, accordions, or expand/collapse as primary structure
- ❌ Meta subtitles (phase labels, category banners, spec version headers)
- ❌ Nested scroll containers (more than one scrollbar per page)

**Violations block merge.**

---

## 2. Global Layout Contract
**Page Shell**
- Use the same background, spacing, and typography as Worksheets.
- Single main content column.
- One scroll container: the page body.

**Page Header**
- Required:
  - Page title (H1)
  - Optional 1-line description
- Optional:
  - Primary actions (right-aligned)
- Forbidden:
  - Category labels
  - Phase subtitles
  - Version strings

---

## 3. Navigation & Information Architecture
**Left Navigation (Canonical)**
- Research
- Projects
- Skills
- Flows
- Sessions
- Worksheets
- Reports
- Files

**Structural Rules**
- Planner Pack and Planning are NOT a top-level nav item
- Planner Pack, Planning variants, and similar are Flows
- All executions (runs) land in Sessions
- Runs render Living Records

---

## 4. Skills (AgentProfiles)
**Skills List**
- List or table layout only (no cards)
- Each row:
  - Skill name
  - One-line purpose
  - Version (small, muted)
- Tags optional (max 3)

**Skill Detail**
Must include, in this order:
1. Purpose (1–2 sentences)
2. Inputs
   - Required vs optional
   - Type
   - Pointer source
3. Output schema
   - Copyable JSON schema
4. Output examples
   - ok
   - insufficient_data
   - rejected (if applicable)

**Forbidden:**
- Decorative containers
- Meta sections like “Profile”, “Category”, “Spec version” as headers

---

## 5. Runs & Living Record (Critical)
**Definition**
The Living Record is a chronological rendering of EventRecords.  
No other data source is allowed.

**Timeline Structure (Required)**
For each EventRecord:
1. Timestamp (muted)
2. Event title (Agent name / action)
3. Status chip (small)
4. Content blocks (always visible):
   - What happened (summary)
   - Inputs used (pointer paths + values)
   - Outputs written (pointer paths + values)
   - Evidence (citations / links)
   - Assumptions (with validation hints)
   - Artifacts / Actions emitted

**Rules**
- Default state = fully expanded
- No tabs
- No previews
- No “click to see more” for normal content

If content is extremely large:
- Deterministic truncation allowed
- Must clearly state truncation
- Must expand inline

**Insufficient Data Rendering**
If status = insufficient_data, UI must show:
- Explicit missing inputs
- Why they are required
- Concrete next actions
- Optional user input affordances

---

## 6. Scroll Contract
- Exactly one scroll bar per page
- No scrolling columns
- No scrolling panels
- Maps/code blocks may auto-size but do not create inner scroll contexts

---

## 7. Typography & Color
- Typography scale must match Worksheets
- WeFlora brand color:
  - Primary actions
  - Active navigation
  - Status chips
  - Timeline markers
- No decorative color washes

---

## 8. Error & Status Handling
- Errors must be written as EventRecords
- Toasts are secondary only
- Ledger is the source of truth

---

## 9. Input Envelope Contract
Every Flow declares:
- Required inputs
- Optional inputs
- Derived inputs

UI must:
- Block execution on missing required inputs
- Render an inline “Input Completion” state
- Allow re-run after input completion

This enables:
- Loose enrichment workflows
- Partial data validation
- Exploratory agent usage

---

## 10. Enforcement
- This document is binding.
- UI that violates this contract must be refactored.
- No exceptions without explicit architectural approval.
