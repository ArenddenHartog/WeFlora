# WeFlora Stabilization & UX Overhaul — Next Steps

## Overview

This document outlines the phased approach to making WeFlora unbreakable and feel like
the smartest worker in the ecosystem. The goal is to eliminate "does nothing / silent fail / 
flashes / reload loops" and create a cohesive product experience.

---

## Phase 2A — Unbreakable System Baseline

### A.1 Canonical "Async Action" Pattern Everywhere

**Rule:** Every async user action must go through `useSafeAction` or `safeAction` and produce exactly one of:
- Success toast + state update
- Error toast with traceId + DebugPanel entry

**Pass Criteria:**
- [ ] No button with `onClick` that doesn't call a safeAction-wrapped handler
- [ ] No `await supabase...` in UI components without safeAction
- [ ] No `console.error` without user-facing toast

**Implementation Status:** ✅ Implemented
- `safeAction` utility in `utils/safeAction.ts`
- `useSafeAction` hook in `utils/hooks/useSafeAction.ts`
- `formatErrorWithTrace()` for error messages with traceId

---

### A.2 RPC Policy (Hard Rule)

**Rules:**
- **Reads:** Direct table/view reads only (`from().select()`), no RPC
- **Mutations / claims / idempotency:** RPC only, always via `rpcSafe()`

**Pass Criteria:**
- [x] If RPC missing (PGRST202), UI shows: "Backend mismatch: RPC <name> not deployed"
- [x] DebugPanel logs last RPC call name/status/latency

**Implementation Status:** ✅ Implemented
- `rpcSafe()` utility with PGRST202 detection
- Direct table reads for `fetchReviewQueue`, `getVaultForReview`
- RPC only for mutations: `vault_claim_next_review`, `vault_update_review`

---

### A.3 Backend Fingerprint in DebugPanel

**Required Backend Section:**
- [ ] Supabase URL host (e.g., `rwib...supabase.co`)
- [ ] Schema version (from `app_meta` table or fallback)
- [ ] Feature flags (dev/prod)
- [ ] RPC presence check list (green/red):
  - `vault_claim_next_review`
  - `vault_update_review`
  - `planner_bootstrap_intervention`
  - `pciv_bootstrap_scope`

**Pass Criteria:**
- [ ] In production mode, QA can screenshot DebugPanel and immediately see if backend is aligned

**Implementation Status:** 🔄 In Progress (this PR)

---

### A.4 Query Hardening

**Requirements:**
- [ ] Pagination everywhere that lists vault or sessions
- [ ] Memoize readiness computations
- [ ] Normalize pointers index once per inventory fetch

**Pass Criteria:**
- [ ] No UI lag spikes when inventory > 200 rows
- [ ] No repeated readiness recalculation per render

**Implementation Status:** ⏳ Planned

---

## Phase 3 — Make the UI Actually Behave

### B.1 Global Layout Contract Enforcement

**Extract and reuse:**
- `PageHeader` (from Worksheets look & feel)
- `PageShell` (padding, max width, scroll rules)
- `SplitView` (list + detail pattern)
- `EmptyState`, `ErrorState`, `LoadingState`

**Pass Criteria:**
- [ ] Vault / Review / SkillDetail / FlowDetail / SessionDetail share same header typography + spacing
- [ ] No nested scrollbars (only one page scroll container)

**Implementation Status:** 🔄 In Progress (this PR)

---

### B.2 URL-driven Selection Everywhere

**Pattern:**
- `?selected=<id>` or `/module/:id` (pick one per module)
- No ephemeral "panel flash then disappears" state

**Pass Criteria:**
- [x] Selecting an item survives refresh/back/forward

**Implementation Status:** ✅ Implemented for Vault, Review

---

### B.3 "Do Something" Affordances Everywhere

**Every hub and detail must have a primary action:**
- Vault: Upload, Start Review, Run Skill
- Skill: Run Skill
- Flow: Run Flow, Save Draft
- Session: Continue / Export artifact / Open worksheet/report

**Pass Criteria:**
- [ ] No screen where user wonders "what do I do next?"

**Implementation Status:** ✅ Mostly implemented

---

## Phase 4 — Intelligent Worker Behavior

### C.1 Skill Contract Becomes the UI Backbone

**Skill detail page becomes an "Agent Contract" view:**
- Declared inputs (fields + required pointers)
- Readiness checklist (green/amber/red)
- "What I will do" (deterministic steps)
- "What I will produce" (artifact types + examples)
- Run mode: single-step vs multi-step

**Implementation Status:** ✅ Run tab implemented with readiness banner

---

### C.2 Session Timeline Becomes the "Living Record"

**Session detail renders ledger events:**
- Inputs → processing → outputs
- Evidence/provenance inline
- Insufficient data events prompt follow-up

**Implementation Status:** ✅ RunTimeline component implemented

---

### C.3 Flow Builder v1 Becomes a Real Builder

**Features:**
- Add skills
- Reorder skills
- Mark parallel blocks
- Validation with reasons
- "Run" produces execution graph preview

**Implementation Status:** 🔄 Basic implementation exists

---

## Current Sprint Deliverables

This PR implements:

1. **Backend Fingerprint + RPC Presence Check** in DebugPanel
   - Supabase URL display
   - RPC health checks with visual indicators
   - Schema version detection

2. **Replace Remaining RPC Reads** with direct table reads
   - Grep for `.rpc()` and convert read operations
   - Keep mutations as RPC via `rpcSafe()`

3. **Adopt PageHeader/PageShell** on Skills/Flows/Sessions
   - Consistent typography and spacing
   - Match Worksheets look & feel

---

## File Changes Summary

### New/Modified Files:
- `components/ui/DebugPanel.tsx` — Backend fingerprint section
- `components/agentic/SkillsIndex.tsx` — PageShell adoption
- `components/agentic/SkillDetail.tsx` — PageShell adoption
- `components/agentic/FlowsIndex.tsx` — PageShell adoption
- `components/agentic/FlowDetail.tsx` — PageShell adoption
- `components/agentic/RunsIndex.tsx` — Already uses PageShell ✓
- `components/agentic/RunDetail.tsx` — Already uses PageShell ✓
