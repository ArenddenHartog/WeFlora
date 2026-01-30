# Migration Notes – Agentic UI & Data Alignment

This migration realigns WeFlora to its original vision:
**Vault → Ops → Agents → Ledger → UI**

---

## 1. Data Model Alignment

### Vault
- Single `vault_id`
- Versioned via `version++`
- Domain-based pointers:
  - /inputs/*
  - /context/*
  - /derived/*
  - /outputs/*
  - /artifacts/*
  - /audit/*

Old ad-hoc data paths must be migrated into these domains.

---

### Ledger
- UI must render ONLY from EventRecords
- No derived UI state allowed
- Living Record = pure renderer

---

### RunContext
- Single object passed to:
  - Agents
  - Ledger
  - UI
- No duplicated run/session metadata

---

## 2. UI Refactor Scope

Required:
- Remove page-level scroll hacks
- Introduce PageShell consistently
- Align typography to Worksheets standard
- Remove decorative cards from ledger views

---

## 3. Deprecated Patterns

- Old “agent output blocks”
- Card-based timelines
- Mixed conversational + factual rendering
- Page-specific typography systems

---

## 4. Migration Strategy

1. Lock contracts (data + UI)
2. Refactor one vertical slice:
   - Skill → Run → Ledger → UI
3. Apply pattern globally
4. Only then add features

---

## 5. Success Criteria

- Same data renders identically everywhere
- UI explains agent behavior clearly
- First-time users can:
  - run a Skill
  - combine Skills into a Flow
  - understand outcomes

If the system drifts again, stop and realign.
