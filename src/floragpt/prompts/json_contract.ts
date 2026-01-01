export const buildJsonContract = (schema: object, schemaVersion: 'v0.1' | 'v0.2') => `
You must output ONLY valid JSON that matches the provided JSON schema.
No markdown, no code fences, no commentary, and no extra keys.
All citations must reference source_id values from the EvidencePack.
Include meta.schema_version with the value "${schemaVersion}".
Schema:
${JSON.stringify(schema)}
`.trim();
