## AI UX Contract (Phase 2)

### Presence Principles (P1–P4)
- **P1 — One primary composer**: Research composition happens in `ChatInput` (Home/Chat). Other surfaces may *escalate into* the composer but should not compete with it.
- **P2 — Controlled “Ask” surfaces**: “Ask FloraGPT” affordances must only exist on allowlisted surfaces (see `src/config/aiPresence.ts`). No new Ask buttons outside the allowlist.
- **P3 — Search first, research second**: Global search defaults to “Search WeFlora”. Escalation into research is a secondary action (“Ask FloraGPT: …”) shown *below* search results.
- **P4 — Evidence is visible**: AI output should carry clear provenance, with a consistent Evidence Glow treatment and an evidence panel for details.

### Evidence Glow rules
- **EG1 — Minimal tint only**: Evidence Glow must not change layout; only adds subtle tokenized tint + border.
- **EG2 — Click reveals provenance**: Clicking evidence opens the evidence panel with provenance (label, sources if available, generatedAt).
- **EG3 — Status semantics**:
  - `generated`: AI produced content (no explicit citations)
  - `verified`: citations/evidence present
  - `warning`: mixed/partial evidence
  - `error`: failed generation or conflicting evidence

### Token usage (AI)
- **AI tint**: `bg-weflora-teal/10`, `border-weflora-teal/20`, `text-weflora-dark`
- **Status**: `weflora-success`, `weflora-amber`, `weflora-red`
- **No purple accents** in AI contexts (`purple-*` is disallowed).

### Acceptance criteria
- **A (Presence)**: Only allowlisted surfaces can show “Ask FloraGPT” affordances; GlobalTopBar only offers escalation row.
- **B (Search → Ask)**: GlobalTopBar shows WeFlora results first, then one “Ask FloraGPT: …” row that pre-fills the composer (no auto-send).
- **C (Evidence Glow)**: AI output shows Evidence Glow + opens evidence panel with provenance when clicked.

