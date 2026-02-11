# WeFlora App Redesign Plan

**Status:** Implemented  
**Version:** 1.1  
**Last Updated:** 2025-02-11

### Implementation Summary (2025-02-11)
- Phase 1: Tokens extended with muted palette, flow/consensus tokens, hubTile
- Phase 2: RightSidebarStepper redesigned with vertical timeline; PCIV stage header updated
- Phase 3: ConsensusBar, EvidenceStrengthBar, KeyClaimsTable components; ReasoningTimeline integration
- Phase 4: EvidenceMap refined; RunTimeline ContributionBar/relevance badges use WeFlora tokens
- Phase 5: Skills/Flows hub tiles use hubTile; sidebar unchanged
- Phase 6: FlowGraphView added; FlowDetail has List/Graph toggle

---

## Executive Summary

This plan proposes a comprehensive redesign of the WeFlora app, preserving the existing Design Contract and ledger-first principles while evolving the visual language to be more cohesive, professional, and expressive. The redesign draws on your provided guiding images (Consensus Meter–style reasoning, Key Claims/Evidence tables, Deep Search flow, vertical timeline flows, EigenPal workflow builder, Plan/Results patterns) and the [Supabase Design System](https://supabase.com/design-system) as inspiration, anchored by consistent use of **WeFlora minted green teal** (#159F9A).

---

## 1. Current State Analysis

### 1.1 Strengths to Preserve

| Area | Current State | Keep |
|------|---------------|------|
| **Design Contract** | Strict layout, typography, scroll rules | Yes – non-negotiable |
| **Ledger-first** | EventRecords, machine state visible | Yes – core identity |
| **Design tokens** | `tokens.ts` with page, typography, surfaces | Yes – extend, don’t replace |
| **WeFlora palette** | teal, dark, mint, success, amber, red | Yes – expand usage |
| **PageShell pattern** | PageShell → PageHeader → PageBody | Yes – canonical |
| **Single scroll container** | Critical layout rule | Yes – non-negotiable |

### 1.2 Pain Points Identified

1. **Fragmented visual worlds** – Skills, Flows, Sessions, Planning, Vault each feel like different apps.
2. **Reasoning visualization** – Evidence and confidence are present but not immediately understandable (e.g., tiny contribution bars, dense EvidenceCards).
3. **Flow builder** – PCIV and Planning flows are functional but visually flat; no clear “active step” or “flow sense.”
4. **Confidence design** – Confidence is numeric or minimal; lacks the “Consensus Meter” / “Evidence Strength” clarity of your references.
5. **Overcorrection risk** – Past iterations removed personality; the contract forbids “decorative” without defining “character.”

### 1.3 Guiding Elements (from your images)

| Element | Source | Application in WeFlora |
|---------|--------|------------------------|
| Consensus Meter | Research aggregation UI | Aggregate evidence/claims into Yes/Mixed/No, with % and drill-down |
| Key Claims + Evidence Strength | Table with bar + label | Claims/evidence table with visual strength bars |
| Deep Search flow | Vertical timeline, stages, sub-steps | PCIV, Planning phases, Session steps |
| Vertical timeline (Case ready) | Teal active card | Active step clearly highlighted |
| EigenPal workflow | Node graph, Add step, End node | Flow builder, skill chaining |
| Plan + Results rail | Collapsible steps, file list | Right-side Plan / Evidence rail |

---

## 2. Design System Evolution

### 2.1 Philosophy: “Supabase-inspired, WeFlora-native”

- **Supabase:** Clean typography, clear hierarchy, subtle borders, generous whitespace, accessible contrast, minimal but purposeful color.
- **WeFlora:** Ledger-first, scientific clarity, WeFlora teal as the single accent for progress, status, and brand.

**Principle:** One accent color (WeFlora teal), one design language, one product feel.

### 2.2 Token Extensions

Proposed additions to `tokens.ts` (and Tailwind) without breaking existing usage:

| Token | Purpose | Example |
|-------|---------|---------|
| `weflora-teal` (existing) | Primary accent | Active nav, progress, CTAs |
| `weflora-teal/subtle` | Soft highlight | Hover states, rail headers |
| `weflora-teal/strong` | Emphasis | Active flow step, completed markers |
| `flowLine` | Vertical timeline connector | `border-l-2 border-weflora-teal` |
| `flowStepActive` | Active step surface | `bg-weflora-teal text-white` |
| `flowStepDone` | Completed step | `bg-slate-50 border-weflora-teal/20` |
| `consensusBarStrong` | High confidence segment | `bg-weflora-teal` |
| `consensusBarMedium` | Medium confidence | `bg-amber-400` |
| `consensusBarWeak` | Low / mixed | `bg-slate-300` |
| `evidenceStrengthBar` | Evidence strength (e.g. 8 bars = Strong) | Bar group component |

### 2.3 Typography (Supabase-inspired refinement)

- **Headings:** Slightly tighter tracking, clearer weight steps (e.g. `font-semibold` vs `font-bold`).
- **Body:** `text-slate-700` (readable) with `leading-relaxed` where appropriate.
- **Labels:** Uppercase, tracking-wide, `text-[11px]` – keep current contract.
- **Meta:** `text-slate-500`, `text-xs` – secondary info.

**No change to DESIGN_CONTRACT typography classes** – only ensure consistent application.

### 2.4 Surfaces & Density

- **Panels:** Light borders (`border-slate-100`), subtle backgrounds (`bg-slate-50/50`) where distinction is needed.
- **Cards:** Avoid heavy cards in Ledger; use flat rows. For hubs (Skills, Flows), allow *one* level of elevation (e.g. `surfaceBordered`) for tiles.
- **Rounded corners:** `rounded-lg` for buttons/inputs, `rounded-xl` for panels – align with Supabase.

---

## 3. Component Redesign Proposals

### 3.1 Reasoning & Confidence Visualization

**Problem:** Reasoning and evidence strength are buried in dense cards and small numbers.

**Proposal: Introduce a “Consensus / Evidence Summary” pattern**

1. **Consensus-style bar (when applicable)**  
   - Horizontal segmented bar: e.g. Strong / Moderate / Weak, or Yes / Mixed / No.  
   - Each segment: color + percentage + optional filter.  
   - Hover: tooltip with supporting sources (title, year, citations, authors).  
   - Use WeFlora teal for “Strong/Yes,” amber for “Moderate/Mixed,” slate for “Weak/No.”

2. **Key Claims + Evidence table**  
   - Columns: Claim | Evidence Strength | Reasoning | Sources.  
   - Evidence Strength: 6–8 vertical bars (Strong = 8 green, Moderate = 6 amber).  
   - Reasoning: Short sentence summarizing the logic.  
   - Sources: Clickable refs, PDF links.

3. **ContributionBar evolution**  
   - In RunTimeline/EvidenceCard: Keep bar, but make it taller and more visible; ensure teal/amber/slate mapping is consistent.

**Affected areas:** `ReasoningTimeline`, `EvidenceMap`, `RunTimeline` (EvidenceCard), `NodeDetailsPanel`, `ActionCards` evidence display.

---

### 3.2 Flow Builder / Stepper Redesign

**Problem:** PCIV and Planning steppers feel flat; active/completed states are subtle.

**Proposal: “Deep Search”–style vertical flow**

1. **Vertical timeline**
   - Single vertical line in WeFlora teal.
   - Solid circles for completed steps; ring for active step.
   - Connector line uses `flowLine` token.

2. **Step cards**
   - **Completed:** Light grey background, muted text, green checkmark.
   - **Active:** WeFlora teal background, white text, clear CTA (“Next,” “Validate,” etc.).
   - **Blocked:** Amber accent, “Needs input” message.
   - Collapsible sub-steps where applicable (e.g. PCIV Map stage details).

3. **Summary stats (PCIV / Planning header)**
   - Horizontal metrics: e.g. “Sources: 3 | Fields: 12/15 | Unresolved: 2”.
   - Info icons for tooltips (definitions of each stage).

**Affected areas:** `PCIVFlow`, `RightSidebarStepper`, `ImportStage`, `MapStage`, `ValidateStage`, `ContextIntakeStep`.

---

### 3.3 Evidence Map

**Problem:** Functional but feels disconnected; confidence is small text on nodes.

**Proposal**

1. **Node styling**
   - Larger nodes with clearer confidence indicator (e.g. ring thickness or inner fill %).
   - Selected node: WeFlora teal ring, stronger shadow.
   - Confidence label: more prominent, e.g. “Strong / 85%”.

2. **Panel consistency**
   - Header/toolbar: Match PageShell typography.
   - View mode pills: Use `chipActive` / chip pattern.
   - What-if panel: Clean surface, consistent tokens.

3. **Color semantics**
   - Teal for high confidence / positive; amber for medium; slate for low/neutral.

---

### 3.4 Living Record (RunTimeline / Sessions)

**Problem:** DESIGN_CONTRACT forbids cards, but current layout can feel dense and hard to scan.

**Proposal**

1. **Keep flat rows** – no card borders, no drop shadows.
2. **Stronger visual hierarchy**
   - Step header: title + status badge + timestamp on one line.
   - “What happened” always visible.
   - Inputs/Outputs/Evidence as compact lists with clear separators.

3. **Evidence section**
   - Optional “Evidence strength” summary when multiple sources: small Consensus-style mini-bar or “Strong / Moderate” badge.
   - Citations: inline, clickable, consistent with Key Claims table.

4. **Status badges**
   - Use existing contract (ok=teal, insufficient=amber, error=red, running=slate).
   - Ensure badges are compact but legible.

---

### 3.5 Sidebar & Navigation

**Problem:** Sidebar is functional but could better communicate “WeFlora” and active state.

**Proposal**

1. **Logo**
   - Keep teal container; ensure it reads clearly as WeFlora.

2. **Nav items**
   - Active: `bg-weflora-mint/30`, `text-weflora-teal` (current).
   - Add subtle teal left border for active item (optional, Supabase-style).
   - Icons: Slightly larger, consistent stroke weight.

3. **Bottom user menu**
   - Keep; ensure hover/focus states use tokens.

---

### 3.6 PageShell & Hub Pages

**Proposal**

1. **PageShell**
   - Add optional `mb-8` to header (per contract).
   - Ensure tabs row (if present) uses divider, not heavy border.

2. **Skills Index / Flows Index**
   - Tiles: One level of elevation (`surfaceBordered`), clear “Run” / “View” CTA.
   - Empty states: Illustration or icon + guidance text.
   - Typography: Match contract H1/H2.

3. **Vault / Sessions**
   - Table-like rows: `tableRow`, `tableRowSelected`.
   - Filters: Compact, token-based.
   - Primary action always visible (Upload, Start Review, Run Skill).

---

## 4. Implementation Phases

### Phase 1: Foundation (Low Risk)

- Extend `tokens.ts` with new flow/consensus/evidence tokens.
- Add Tailwind utilities if needed.
- Audit typography application (ensure all pages use contract classes).
- **Deliverable:** Updated token set, no breaking visual changes.

### Phase 2: Flow & Stepper

- Redesign `RightSidebarStepper` with vertical timeline and active-state treatment.
- Redesign PCIV stage header and step cards (Import, Map, Validate).
- **Deliverable:** Planning and PCIV flows feel like a cohesive “Deep Search” experience.

### Phase 3: Reasoning & Confidence

- Implement Consensus-style bar component (reusable).
- Implement Key Claims + Evidence table component.
- Integrate into ReasoningTimeline, EvidenceMap, RunTimeline.
- **Deliverable:** Evidence and confidence are visually clear at a glance.

### Phase 4: Evidence Map & Living Record

- Refine EvidenceMap nodes and panel styling.
- Refine RunTimeline / Session detail layout and evidence display.
- **Deliverable:** Evidence map and Living Record match new system.

### Phase 5: Polish & Consistency

- Sidebar refinements.
- Hub pages (Skills, Flows, Vault) visual pass.
- Empty states, error states, loading states.
- **Deliverable:** “One system” feel across all pages.

---

## 5. Validation Questions (For You)

Before implementation, your input would help:

1. **Consensus Meter applicability**
   - Do we have (or plan to have) data that maps to Yes/Mixed/No or Strong/Moderate/Weak at the report/planning level?
   - If not, should the Consensus bar be reserved for future use, or should we design a “confidence distribution” variant (e.g. High / Medium / Low %)?

2. **Flow builder scope**
   - Is the main “flow builder” today the PCIV (Context Intake) flow, the Planning stepper, or both?
   - Do you want a more visual node-based flow (like EigenPal) for Skills/Flows, or is the current list/stepper sufficient?

3. **Card policy**
   - DESIGN_CONTRACT forbids cards for Living Ledger. For Skills Index, Flows Index, and similar hubs, are bordered tiles acceptable?
   - Should we introduce a single “hub tile” component that’s allowed for those pages?

4. **“Creative and fancy”**
   - Where should personality show? (e.g. micro-interactions on success, subtle gradients on primary buttons, illustration in empty states?)
   - Any areas that must stay strictly minimal (e.g. Ledger, evidence tables)?

5. **Supabase alignment**
   - Do you want us to adopt specific Supabase components (e.g. Button, Card, Badge) if available, or only use them as visual inspiration?

---

## 6. Files to Modify (Phase-by-Phase)

### Phase 1

- `src/ui/tokens.ts`
- `tailwind.config.js` (if new utilities)
- `DESIGN_CONTRACT.md` (addendum for new tokens only)

### Phase 2

- `src/decision-program/ui/decision-accelerator/RightSidebarStepper.tsx`
- `components/planning/pciv/PCIVFlow.tsx`
- `components/planning/pciv/ImportStage.tsx`
- `components/planning/pciv/MapStage.tsx`
- `components/planning/pciv/ValidateStage.tsx`

### Phase 3

- New: `components/ui/ConsensusBar.tsx` (or `EvidenceSummaryBar.tsx`)
- New: `components/ui/KeyClaimsTable.tsx` (or similar)
- `src/decision-program/ui/decision-accelerator/ReasoningTimeline.tsx`
- `components/agentic/RunTimeline.tsx` (EvidenceCard, ContributionBar)

### Phase 4

- `src/decision-program/ui/decision-accelerator/EvidenceMap.tsx`
- `src/decision-program/ui/decision-accelerator/NodeDetailsPanel.tsx`
- `components/agentic/RunDetail.tsx` (layout around RunTimeline)

### Phase 5

- `components/Sidebar.tsx`
- `components/agentic/SkillsIndex.tsx`
- `components/agentic/FlowsIndex.tsx`
- `components/vault/VaultInventoryView.tsx`
- `components/home/HomeRoute.tsx` (if needed)

---

## 7. Success Criteria

- [ ] All pages pass UI_ACCEPTANCE_CHECKLIST.md.
- [ ] DESIGN_CONTRACT is respected (layout, typography, scroll, ledger rules).
- [ ] WeFlora teal is the primary accent; no competing accent colors.
- [ ] Reasoning and confidence are understandable without reading paragraphs.
- [ ] Flow/stepper interactions feel intentional and clear.
- [ ] The app feels like “one system” – Skills, Flows, Sessions, Planning, Vault share the same visual language.
- [ ] Professional and robust, with a touch of “creative and fancy” where appropriate.

---

## 8. Next Steps

1. **You:** Review this plan, answer validation questions (Section 5), and approve or adjust.
2. **We:** Incorporate feedback and refine the plan.
3. **Implementation:** Proceed phase-by-phase, with commits after each phase.
4. **QA:** Validate against UI_ACCEPTANCE_CHECKLIST and DESIGN_CONTRACT after each phase.

---

*This plan is a living document. Revisions will be tracked here.*
