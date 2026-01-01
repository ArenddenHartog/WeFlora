export const buildJsonContract = (schema: object) => `
You must output ONLY valid JSON that matches the provided JSON schema.
No markdown, no code fences, no commentary, and no extra keys.
All citations must reference source_id values from the EvidencePack.
Include meta.schema_version with the value "v0.1".
Schema:
${JSON.stringify(schema)}
`.trim();
