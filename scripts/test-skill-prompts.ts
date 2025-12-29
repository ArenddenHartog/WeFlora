import { strict as assert } from "node:assert";
import { SKILL_TEMPLATES } from "../services/skillTemplates.ts";
import { SKILL_PROMPT_FIXTURES } from "../services/skills/skillPromptFixtures.ts";

let failures = 0;

SKILL_PROMPT_FIXTURES.forEach((fixture) => {
  const template = SKILL_TEMPLATES[fixture.id];
  assert.ok(template, `Missing template for ${fixture.id}`);

  const prompt = template.buildPrompt({
    row: fixture.row,
    params: fixture.params,
    attachedFileNames: fixture.attachedFileNames,
    projectContext: fixture.projectContext
  });

  try {
    assert.equal(prompt, fixture.expectedPrompt, `Prompt mismatch for ${fixture.id}`);
  } catch (error) {
    failures += 1;
    console.error(String(error));
  }
});

if (failures > 0) {
  console.error(`\n${failures} skill prompt fixture(s) failed.`);
  process.exit(1);
}

console.log("All skill prompt fixtures passed.");
