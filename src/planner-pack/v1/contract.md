# Planner Pack v1 Contract

## Primary Object: Intervention
An Intervention is the single primary object. It represents a greening intervention for a street, park, or corridor. Required metadata includes name, municipality, and geometry (polygon or corridor line + buffer width). Optional project reference is supported via scope metadata.

## Evidence Model
Evidence flows in a strict chain:

**Sources → Runs → Artifacts**

- Sources capture uploaded inventories, proxy baselines, and any provided references.
- Runs log the worker step, inputs, and assumptions.
- Artifacts are the durable, submission-ready outputs and are versioned.

Artifacts embed evidence links back to:
- Geometry
- Source records
- Worker steps (run ID)

## Evidence Supporting Compliance
Every compliance artifact must include the section:
**“Here is the evidence supporting compliance”**

Evidence entries must be linkable to a source or system operation. Baseline data is always labeled as **“Baseline proxy dataset.”**

## Assumptions Policy
- Assumptions are disclosed, never hidden.
- Assumptions are stored on runs and echoed in artifacts.
- Inputs changing auto-supersede prior artifacts (new versions).
- Users can override or correct assumptions; the system logs overrides.

UI expectation:
- Assumptions are visible in the artifact preview (no defensive or hedged language).
- Re-run creates a new version and updates the submission-ready status.

## Submission-Ready (v1)
Submission-ready means:
- Planner Pack generated (Memo, Options, Procurement Pack, Email Draft)
- Web-first preview available
- One-click export (HTML download or print-to-PDF)

Email draft is provided but not sent by the system in v1.
