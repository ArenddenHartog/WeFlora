export const buildRepairPrompt = (errors: string[]) => `
The previous JSON did not validate against the schema.
Fix the JSON so it validates. Do not add commentary.
Validation errors:
- ${errors.join('\n- ')}
`.trim();
