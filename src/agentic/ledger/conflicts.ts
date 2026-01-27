export type ConflictMap = {
  byStep: Record<string, string[]>;
  all: string[];
};

export type StepRecord = {
  step_id: string;
  writes?: string[];
};

export const buildWriteConflictMap = (steps: StepRecord[]): ConflictMap => {
  const byStep: Record<string, string[]> = {};
  const all: string[] = [];

  steps.forEach((step) => {
    const writes = step.writes ?? [];
    const duplicates = writes.filter((item, idx) => writes.indexOf(item) !== idx);
    if (duplicates.length > 0) {
      const unique = Array.from(new Set(duplicates));
      byStep[step.step_id] = unique;
      all.push(...unique);
    }
  });

  return { byStep, all: Array.from(new Set(all)) };
};
