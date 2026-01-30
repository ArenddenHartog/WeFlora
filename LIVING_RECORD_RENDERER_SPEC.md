# LIVING_RECORD_RENDERER_SPEC.md

**Status:** Locked  
**Applies to:** Runs / Living Records / Agentic timelines  
**Priority:** P0 (foundational)

---

## 0. Canonical Intent (Non-Negotiable)
The Living Record is the primary epistemic surface of WeFlora.  
It must:
- expose machine reasoning faithfully
- remain inspectable under scrutiny
- scale from lightweight enrichment to full regulatory workflows
- never obscure causality or data flow

If the Living Record is unclear, the system is broken — even if the logic is correct.

---

## 1. Tone Contract (Locked)
### 1.1 Event Classification
Each EventRecord must declare its tone:
```
tone: 'fact' | 'conversational'
```

### 1.2 Tone Rules
| Tone | Language | Interaction | Motion |
| --- | --- | --- | --- |
| fact | Strictly neutral, scientific, declarative | No follow-ups except for insufficient_data | Near-zero |
| conversational | Gently guiding (“This suggests…”) | Inline “Ask follow-up” allowed | Near-zero |

**Forbidden**
- Anthropomorphic language in fact events
- Suggestions phrased as conclusions
- Conversational UI affordances in fact-only flows

---

## 2. Motion & Playfulness (Locked)
- Motion is functional only
- Allowed:
  - fade-in of new events
  - subtle status pulse for running
- Forbidden:
  - sliding panels
  - animated containers
  - attention-grabbing transitions

The system should feel alive, not playful.

---

## 3. Density & Readability (Locked)
### 3.1 Default Mode
- Slightly generous vertical whitespace
- Clear separation between semantic sections
- Comfortable long-form reading

### 3.2 Compact Mode (Optional, Later)
- Notebook-like density
- Larger typography
- Stronger typographic hierarchy
- No reduction of information

This is a renderer variant, not a different layout.

---

## 4. Comparative Runs (Locked)
Runs:
- may be rendered isolated (default)
- may be rendered side-by-side (comparison view)

Comparison is:
- opt-in
- layout-level (not renderer-level)
- uses identical LivingRecordRenderer instances

The renderer itself remains unchanged.

---

## 5. Structural Rules (Hard Constraints)
### 5.1 Scrolling
- Exactly one scroll container per page
- No nested scroll regions
- No internal scroll panes

Violation = automatic rejection.

### 5.2 Containers
- ❌ Cards
- ❌ Panels
- ❌ Accordions
- ❌ Tabs
- ❌ “Expand / collapse”

The Living Record is a continuous document, not a UI kit.

### 5.3 Metadata Suppression
The following are forbidden in the renderer:
- category subtitles
- phase labels
- internal IDs
- schema versions
- “Profile / Inputs / Outputs” meta blocks

Only domain-meaningful labels are allowed.

---

## 6. Timeline Model (Final)
### 6.1 High-Level Layout
```
[ Run Header ]
────────────────────────────
[ Living Record Timeline ]
────────────────────────────
• One vertical flow
• One spine
• One narrative
```

---

## 7. Event Rendering (Final)
Each EventRecord renders as a single, uninterrupted block.

### 7.1 Event Header
```
[ timestamp ]   Agent / Action Name        status
```
- Timestamp: small, muted
- Agent name: primary emphasis
- Status: inline chip (semantic color only)

### 7.2 Mandatory Sections (Always Rendered)
Sections appear in this exact order, even if empty:
1. **What happened**  
   Plain-language explanation of the step’s outcome.
2. **Inputs**  
   Rendered as resolved pointers:
   ```
   /species = Quercus robur
   /policyScope = NL-Utrecht-StreetTrees
   ```
3. **Outputs**  
   Same format, explicitly showing written pointers.
4. **Evidence**  
   List of evidence items with sources. If none:  
   “No evidence captured for this step.”
5. **Assumptions**  
   If none:  
   “No assumptions recorded.”
6. **Artifacts / Actions**  
   Links, generated documents, or next actions.

---

## 8. Insufficient Data Handling (Strict)
When status = insufficient_data:

### 8.1 Mandatory Missing Block
Rendered inline, not as an alert.

**Missing**
- Species mix

**Why this matters**
- Diversity scoring requires species distribution

**Recommended next**
- Provide a species mix to score biodiversity

Tone:
- instructional
- non-alarming
- non-judgmental

---

## 9. Inline Interaction Rules (Final)
### 9.1 Fact Events
- No inline interaction
- Exception: insufficient_data → allowed “Provide missing input”

### 9.2 Conversational Events
- Inline “Ask follow-up”
- Inline refinement prompts allowed
- Must never obscure original output

---

## 10. Color System (Renderer-Specific)
- Base: Worksheets neutral background
- Text-first design
- Color used only for:
  - status
  - spine
  - active affordances
- No background washes
- No tinted containers

---

## 11. Typography Rules
- Same base scale as Worksheets
- Hierarchy via:
  - weight
  - spacing
  - rhythm
- Monospace:
  - pointers
  - identifiers
- Never for prose

---

## 12. Renderer Acceptance Criteria (P0)
The renderer fails if:
- Any section is hidden by default
- Inputs or outputs are summarized instead of shown
- Cards or panels appear
- More than one scrollbar exists
- Status is shown without explanation
- Evidence or assumptions are optional
- Tone is violated

---

## 13. Relationship to Other Surfaces
| Surface | Role |
| --- | --- |
| Skills | Capability definition |
| Flows | Pre-engineered agent strings |
| Sessions (Runs) | Entry point to Living Records |
| Worksheets | Parallel analytical workspace |

The Living Record is the single source of truth across all.

---

## Component Tree (Locked)
This is the exact component hierarchy expected:

```
RunPage
├── RunHeader
│   ├── RunTitle
│   ├── RunScope
│   └── RunStatus
│
└── LivingRecordRenderer
    ├── TimelineSpine
    │
    └── EventList
        ├── EventBlock (repeated)
        │   ├── EventHeader
        │   │   ├── Timestamp
        │   │   ├── AgentTitle
        │   │   └── StatusChip
        │   │
        │   ├── EventNarrative
        │   │   └── WhatHappenedText
        │   │
        │   ├── EventInputs
        │   │   └── PointerList
        │   │
        │   ├── EventOutputs
        │   │   └── PointerList
        │   │
        │   ├── EventEvidence
        │   │   └── EvidenceList
        │   │
        │   ├── EventAssumptions
        │   │   └── AssumptionList
        │   │
        │   └── EventArtifacts
        │       ├── ArtifactLinks
        │       └── InlineActions
        │
        └── (Optional) EventMissingDataBlock
```

**Important**
- No component introduces scroll
- No component collapses content
- Renderer is pure: `EventRecord[] → DOM`
