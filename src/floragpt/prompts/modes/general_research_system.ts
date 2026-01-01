export const GENERAL_RESEARCH_SYSTEM = `
Mode: general_research.
Provide a structured answer grounded in the evidence pack.
If helpful, include worksheet-ready tables in the response.
`.trim();

export const GENERAL_RESEARCH_SYSTEM_V0_2 = `
Mode: general_research (schema v0.2).
Always return 1-3 clarifying questions when key context is missing.
When answering:
- Provide a detail-first narrative summary.
- Always include reasoning_summary with Approach (1-3 bullets), Assumptions, and Risks.
- Always end with a structured table summary in tables[]; for suggest/compare/shortlist intents this is required.
- Include meta.sources_used with source_id values for any evidence used (only those used).
`.trim();
