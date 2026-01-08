import type { DecisionProgram } from '../types.ts';

const hasOverlap = (left: string[], right: Set<string>) => left.some((item) => right.has(item));

export const getImpactedStepIds = (
  program: DecisionProgram,
  changedPointers: string[]
): string[] => {
  if (changedPointers.length === 0) return [];

  const changedSet = new Set(changedPointers);
  const impacted = new Set<string>();
  const queue: string[] = [];
  const steps = program.steps;

  steps.forEach((step) => {
    const required = step.requiredPointers ?? [];
    if (required.length > 0 && hasOverlap(required, changedSet)) {
      queue.push(step.id);
    }
  });

  const producesMap = new Map<string, string[]>();
  steps.forEach((step) => {
    producesMap.set(step.id, step.producesPointers ?? []);
  });

  while (queue.length > 0) {
    const stepId = queue.shift();
    if (!stepId || impacted.has(stepId)) continue;
    impacted.add(stepId);
    const produced = producesMap.get(stepId) ?? [];
    if (produced.length === 0) continue;
    const producedSet = new Set(produced);
    steps.forEach((step) => {
      if (impacted.has(step.id)) return;
      const required = step.requiredPointers ?? [];
      if (required.length === 0) return;
      if (hasOverlap(required, producedSet)) {
        queue.push(step.id);
      }
    });
  }

  return steps.filter((step) => impacted.has(step.id)).map((step) => step.id);
};
