# PRD — WeFlora Modular Agentic OS (Agent-first, Minimal Disruption)

## 1. Goal
Deliver a working, coherent WeFlora system that:
- Ingests diverse greening data (uploads/manual/geometry)
- Normalizes it via Ops (FME-like)
- Runs single Skills or Skill-strings (Flows) in sequence/parallel
- Produces an auditable Living Record (ledger) and usable Artifacts
- Allows follow-up into Worksheets/Reports/Exports/Action stubs
- Is coherent and usable enough to validate with real NL urban planners

## 2. Non-goals (for this phase)
- Full connector ecosystem (Obsurv/Greehill/etc.) — only stubs + interface
- Fully automated external submission — v1 = export + email draft
- Perfect NL compliance automation — v1 = evidence-backed, assumption-disclosed outputs

## 3. Target Users (v1 validation)
Primary: Urban planners / consultants (NL municipalities)
Secondary: Arborists / municipal asset managers

## 4. Core Product Concepts
### 4.1 Vault (Data Vault)
A versioned container of all inputs, extracted entities, geometry, evidence, and assumptions.
- Supports uploads: CSV/XLSX/PDF/DOCX/GeoJSON/images/text
- Supports manual input blocks (forms/notes)
- Supports geometry creation: polygon + corridor (line→buffer)
- Supports table extraction / authored tables (species lists, procurement lists)
- Has completeness detection to guide next steps

### 4.2 Ops (FME-like)
Deterministic transforms that normalize/enrich data:
- Extract table from file, map columns
- Normalize species names/codes
- Validate required fields
- Derive corridor metrics from geometry
- Join / filter / aggregate for analysis

### 4.3 Skills (Agent Profiles)
Independent tools that transform vault context into outcomes:
- Can run alone (loose use cases) OR be chained in flows
- Must declare:
  - required pointers
  - produced pointers
  - output schema pattern
  - partial allowed behavior (insufficient_data)

### 4.4 Flows (Agent Strings)
Saved templates that orchestrate Skills/Ops:
- topology: sequence / parallel / mixed
- produces packs (bundles of artifacts) OR single outputs

### 4.5 Ledger (Living Record)
Append-only EventRecords.
UI is a pure renderer over the ledger:
- shows what happened
- inputs/outputs pointers
- evidence + assumptions
- artifacts produced
- follow-ups only when insufficient_data

### 4.6 Artifacts
Durable user-facing outputs:
- species_list_matrix → promote to Worksheet
- memo/options/procurement/email/maintenance → promote to Report/export
- score_breakdown → show breakdown + promote to Worksheet/Report
- bundle → “Planner Pack” is a Flow output (a bundle of artifacts), not one artifact

## 5. User Journey (Single Guided Flow — must exist)
One route/wizard that covers:
1) Input (upload/manual/geometry)
2) Select Skills / Flow template
3) Confirm: sequence vs parallel for multi-skill
4) Run
5) Review: artifacts + next actions

No dead pages. No “browse-only” skills without a Run entry.

## 6. Functional Requirements
### 6.1 Vault
- Upload modal supports files + tags + short description
- Geometry step supports corridor (line + width)
- Table import supports mapping columns (species list)
- Completeness engine flags missing pointers:
  - blocking vs warning
  - suggested fix action type

### 6.2 Skills
- Every Skill has a “Run” entrypoint
- Skills can run with insufficient data:
  - must emit `insufficient_data` event
  - must propose follow-up questions + pointers to fill
- Skills produce outputs as pointers and/or artifacts

### 6.3 Flows
- Users can pick a pre-engineered Flow (e.g., Planner Pack)
- Users can build a simple agent string (select multiple skills)
- System asks: sequence or parallel (default: sequence)

### 6.4 Ledger & Living Record UI
- Single scroll container
- Timeline only (no cards, no tabs)
- Every step shows:
  - what happened
  - inputs/outputs pointers
  - evidence
  - assumptions
  - artifacts produced
- Tone:
  - neutral/scientific for factual steps
  - gently guiding only for conversational threads or insufficient_data

### 6.5 Artifacts & Follow-up
- Each artifact declares “Next actions”:
  - Promote to Worksheet
  - Promote to Report
  - Export (PDF/DOCX/CSV/JSON)
  - Draft email (v1)
- Species list outputs default to `species_list_matrix` (draft worksheet-ready)

## 7. Design & UX Requirements
- Must comply with DESIGN_CONTRACT.md
- “Worksheets” typography is the canonical style baseline
- Icons always in colored containers
- No nested scroll; no green background fields
- Remove decorative subtitles/metadata clutter
- Living Record must “speak” clearly (human-readable messages)

## 8. Data & Contract Requirements
- All contracts are locked by TypeScript:
  - Vault, Ledger, RunContext, SkillProfile, FlowTemplate, ArtifactRecord
- New features must extend contracts, not ad-hoc UI state

## 9. Success Metrics (validation phase)
- A planner can:
  - upload a species list + corridor geometry
  - run a single skill (e.g., compliance) and get a matrix artifact
  - run a flow (Planner Pack) and get a bundle of artifacts
  - understand evidence/assumptions and export an email draft
- No broken scrolling
- Ledger explains failures and insufficient data paths

## 10. Rollout Plan
Phase 1 (Foundation):
- Ship contracts + ledger renderer + wizard entry
- Convert 3–5 skills to emit ledger events + artifacts

Phase 2 (Runner + Flows):
- Flow execution (sequence/parallel)
- Planner Pack Flow becomes a template producing a bundle

Phase 3 (UI normalization):
- Skills/Flows/Sessions pages rebuilt to same design system
- Make “Start a session” the dominant entry

Phase 4 (Vault expansion):
- More ops, better extraction, connector stubs become real
