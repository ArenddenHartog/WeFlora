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
**“Here is the evidence supporting compliance.”**

Evidence entries must be linkable to a source or system operation. Baseline data is always labeled as **“Baseline proxy dataset.”**

## Assumptions Policy
- Assumptions are disclosed, never hidden.
- Assumptions are stored on runs and echoed in artifacts.
- Inputs changing auto-supersede prior artifacts (new versions).
- Users can override or correct assumptions; the system logs overrides.

UI expectation:
- Assumptions are visible in the Assumptions module as a 3-column grid (Claim, Basis, How to validate) with confidence and owner.
- No duplication: assumptions are not repeated in every artifact preview (unless explicitly auditing historical changes).
- Re-run creates a new version and updates the submission-ready status.

## Living Record Semantics (v1.1)
- Planner Pack is a living record workspace: a web-first, submission-ready record with explicit evidence, assumptions, and export.
- Middle pane should render document-style artifacts with sanitized HTML or markdown and avoid raw tags.
- Record header shows status, confidence, last updated, and export control.
- Timeline order: Memo → Assumptions → Options → Procurement → Maintenance → Email → Check report.

### Confidence & Risk
- Record-level confidence is derived from evidence coverage (geometry, metrics, inventory, zoning evidence) and assumption risk.
- Assumption risk is driven by low-confidence items; high-risk assumptions must be called out in summary.
- Zoning evidence can be proxy in v1.1 but must be labeled as such.

## Maintenance Artifact (v1.1)
Maintenance artifact type: **maintenance**

Required payload fields:
- summary: string[] (at-a-glance lifecycle summary)
- phases: array of phase objects with:
	- phase: string (Year 0–1, 1–3, 3–10)
	- tasks: array of task objects (task, frequency, seasonality, responsibleParty, opexBand, risks, mitigations)

Maintenance output must read like a municipal asset plan: schedule-driven, with frequency, seasonality, responsible party, OPEX bands, and explicit risks/mitigations.

## Submission-Ready (v1)
Submission-ready means:
- Planner Pack generated (Memo, Options, Procurement Pack, Email Draft)
- Web-first preview available
- One-click export (HTML download or print-to-PDF)

Email draft is provided but not sent by the system in v1.

## Testing semantics
**Smoke tests (service role)** verify:
- Schema and adapter correctness
- Worker execution end-to-end

**RLS tests (authenticated token)** verify:
- Security contract for membership-based access
- Viewer vs editor/owner permissions

## Role rules
- Viewer: read-only access
- Editor/Owner: can create, update, and generate artifacts

## Elevation flow
Workers run as viewers by default. Any elevation to editor/owner requires explicit user consent per run.
