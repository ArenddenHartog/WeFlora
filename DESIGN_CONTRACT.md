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
   # WeFlora Design Contract (v1.1 – STRICT)

   This document is the single source of truth for **layout, typography, interaction, and visual language** across WeFlora.

   If a UI implementation violates this contract, it is considered **incorrect**, even if it “works”.

   This contract exists to:
   - Prevent fragmented UI “worlds”
   - Ensure the Living Ledger is readable, testable, and trustworthy
   - Make WeFlora feel like **one coherent professional system**

   ---

   ## 0. Core Design Principles (Non-Negotiable)

   1. **One system, one language**
      - All non-canvas pages must feel like they belong to the same product.
   2. **Ledger-first**
      - UI exists to explain agent execution, not to decorate it.
   3. **Readable > clever**
      - Dense is allowed. Confusing is not.
   4. **Guiding, not chatting**
      - Neutral/scientific by default. Gentle guidance only where explicitly allowed.
   5. **Minimal motion**
      - Near-zero animation. No playful motion effects.

   ---

   ## 1. Layout Contract

   ### 1.1 Page Types

   #### A. Standard Pages (MANDATORY CONTRACT)
   Applies to:
   - Skills
   - Skill Detail
   - Flows
   - Flow Detail
   - Sessions (Runs)
   - Run Detail
   - Vault
   - Projects
   - Files
   - Reports list (not canvas)

   All MUST use:

   <PageShell> <PageHeader /> <PageBody /> </PageShell>

   #### B. Canvas Pages (EXEMPT)
   Applies to:
   • /worksheets/*
   • /reports/:id
   • /project/:id/*
   These may define their own headers and interaction models.

   ---

   ### 1.2 Scroll Rules (CRITICAL)
   • Exactly ONE vertical scroll container
   • Scroll container = main
   • Forbidden:
   o min-h-screen in page components
   o Nested overflow-y-auto
   o Page-level overflow-hidden

   Required root behavior:
   html, body, #root { height: 100% }
   AppShell          { height: 100% }
   main              { overflow-y: auto }

   Violations cause:
   • broken scrolling
   • clipped content
   • unusable pages

   ---

   ## 2. Typography Contract (Exact Classes)
   These are the ONLY allowed typographic styles.

   Page Title (H1)
   text-3xl font-semibold tracking-tight text-slate-900

   Page Subtitle (optional, 1 line only)
   mt-1 text-sm leading-6 text-slate-500

   Section Header (H2)
   text-lg font-semibold text-slate-900

   Row / Item Title
   text-base font-semibold text-slate-900

   Body Text
   text-sm leading-6 text-slate-700

   Meta / Technical / Secondary Text
   text-xs text-slate-500

   Hard Rules
   • ❌ No decorative subtitles
   • ❌ No repeated metadata under headers
   • ❌ No headings used as decoration
   • ✅ Typography must carry hierarchy, not layout tricks

   ---

   ## 3. Color & Icon Contract
   ### 3.1 Semantic Status Colors (ONLY THESE)
   Status	Color
   ok	teal
   insufficient_data	amber
   rejected / error	red
   running	slate

   ### 3.2 Icon Container (MANDATORY)
   All icons must live inside a colored container.
   h-10 w-10 rounded-xl
   flex items-center justify-center
   bg-weflora-mint/15
   text-weflora-teal
   No raw icons floating in space.

   ---

   ### 3.3 Status Badges (Exact)
   OK
   bg-weflora-mint/20
   text-weflora-teal
   border border-weflora-mint/40

   INSUFFICIENT_DATA
   bg-amber-50
   text-amber-700
   border border-amber-200

   REJECTED / ERROR
   bg-rose-50
   text-rose-700
   border border-rose-200

   RUNNING
   bg-slate-50
   text-slate-700
   border border-slate-200

   ---

   ## 4. Density & Spacing Rules
   • PageHeader bottom margin: mb-8
   • Major sections spacing: mt-10
   • List rows padding: py-5
   • Timeline blocks padding: py-6
   • Internal spacing: space-y-4

   Whitespace must serve reading, not decoration.

   ---

   ## 5. Cards Policy (IMPORTANT)
   Forbidden (Living Ledger / Sessions / Runs)
   • Rounded “cards”
   • Drop shadows
   • Tinted containers per step

   Allowed
   • Flat rows
   • Borders (border-slate-200)
   • Hover background (hover:bg-slate-50/60)

   Living Ledger must read like a scientific logbook, not a dashboard.

   ---

   ## 6. Living Record (Ledger) Renderer Contract
   Renderer input:
   LedgerStream {
     session: RunContext,
     events: EventRecord[]
   }

   Renderer output:
   • Single vertical stream
   • Chronological
   • No cards

   Each Step MUST render:
   1. Header line
   o Step title
   o Status badge
   o Timestamp
   2. What happened (always visible)
   3. Inputs (pointer list)
   4. Outputs (pointer list)
   5. Mutations (pointer diffs)
   6. Evidence
   7. Assumptions
   8. Actions (if any)

   Conversational UI Rules
   • Allowed ONLY for:
   o insufficient_data
   • Forbidden for:
   o factual/compliance steps

   ---

   ## 7. Interaction Rules
   • No hidden primary actions
   • No empty screens without guidance
   • Every Skill and Flow must expose:
   o What it does
   o What it needs
   o How to run it

   ---

   ## 8. Forbidden Patterns (Immediate Rejection)
   • Multiple scroll containers
   • Decorative cards everywhere
   • Uncolored icons
   • Random typography sizes
   • Pages without clear entry actions
   • UI that does not explain “what just happened”

   ---

   ## 9. Enforcement
   • Violations must be fixed before feature work continues
   • QA must validate against UI_ACCEPTANCE_CHECKLIST.md
   • Coding agents must treat this document as law
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
