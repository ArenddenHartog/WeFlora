# Design / UI/UX Improvements — What We Need From You

To meaningfully improve the WeFlora design (beyond token/color changes) and fix the areas that feel broken, we need your input on the following.

---

## 1. Stepper on Sessions Page ("Hurts My Eyes")

**Current:** A horizontal stepper shows "Memory → Understand → Reason → Act → Learn → Memory" with the active step highlighted.

**Questions:**
- Should we **remove** this stepper entirely, or **redesign** it?
- If redesign: what should it communicate? (e.g. current phase of the cognitive loop, progress through a run, something else?)
- Do you have a reference (screenshot, Figma, or description) of how you’d like it to look?

---

## 2. Living Ledger — "Single Flow of Events/Reasoning"

**Current:** The Living Ledger is split into separate cards (Generated Artifacts, Execution Summary, Provenance, Mutations & Outputs, Diagnostics).

**DESIGN_CONTRACT:** "Living Ledger must read like a scientific logbook, not a dashboard" — flat rows, no cards.

**Questions:**
- Do you want a **single vertical timeline** where all events (steps, artifacts, mutations, evidence, provenance) appear in **one chronological stream**?
- How should hierarchy be shown? (e.g. indentation for sub-events, collapsible sections, phase labels?)
- What order should events follow? (Strict time, or grouped by type with time within each group?)

---

## 3. Flow Canvas — "Completely Broken and Doesn't Respond"

**Current:** The Flow detail page has a List/Graph toggle. The List view uses drag-and-drop (DnD) for reordering steps. The Graph view shows a static SVG diagram.

**Questions:**
- What exactly "doesn't respond"? (e.g. drag-and-drop fails, buttons don’t work, layout issues?)
- Which view are you using when it breaks — List or Graph?
- Do you want the **Graph view** to be the primary experience, with List as a fallback?
- Should the Flow Canvas support **adding/removing steps** (not just reordering)? If yes, how? (e.g. "Add step" buttons between nodes, palette drag to canvas?)

---

## 4. Clear Hierarchies

**Current:** Execution summaries and session details are mostly flat lists with minimal nesting.

**Questions:**
- What hierarchies matter most? (e.g. Run → Steps → Sub-operations, Phase → Steps → Evidence?)
- Do you want **expand/collapse** for long sections?
- Any hierarchy pattern you like from another product (e.g. Linear, Notion, research tools)?

---

## 5. Error When Opening a Skill

**Status:** Addressed by lazy-loading `SkillDetail` to break a suspected circular dependency ("Cannot access 'A' before initialization").

**If the error persists after this change:**
- Please share the **full error message** and **stack trace** from the browser console (F12 → Console).
- Does it happen on first load, or only after navigating from Skills index to a specific skill?

---

## 6. Reference Materials

To align design work with your expectations, any of the following would help:

- **Screenshots or mockups** of the desired Sessions page, Living Ledger, and Flow Canvas
- **User flow descriptions** (e.g. "When I run a flow, I expect to see…")
- **Priority order** for fixes (e.g. 1. Fix Skill error, 2. Fix Flow Canvas, 3. Redesign stepper)
- **Access** to Supabase design components or a design system you’re already using

---

## Next Steps

1. **Skill error:** Deploy and test the lazy-loading change. If the error continues, share the console output.
2. **Design:** Once you answer the questions above, we can implement targeted changes.
3. **Phased approach:** We can tackle one area at a time (e.g. Living Ledger first, then Flow Canvas, then stepper) to avoid large, disruptive rewrites.
