import type { SkillRowContext } from "./types.ts";

const formatRowContextLines = (row: SkillRowContext): string[] => {
  const lines: string[] = [];
  if (row.rowLabel) lines.push(`- Row label: ${row.rowLabel}`);
  if (row.speciesScientific) {
    lines.push(`- Species (scientific): ${row.speciesScientific}`);
  } else {
    lines.push(`- Species (scientific): (not confidently detected)`);
  }
  if (row.cultivar) lines.push(`- Cultivar: ${row.cultivar}`);
  if (row.commonName) lines.push(`- Common name: ${row.commonName}`);

  const entries: Array<[string, string]> = [];
  if (row.cellsByColumnTitle) {
    entries.push(...Object.entries(row.cellsByColumnTitle));
  }
  if (row.cellsByColumnId) {
    Object.entries(row.cellsByColumnId).forEach(([key, value]) => {
      if (!row.cellsByColumnTitle || row.cellsByColumnTitle[key] === undefined) {
        entries.push([`Column ${key}`, value]);
      }
    });
  }

  entries.forEach(([key, value]) => {
    if (!value || String(value).trim().length === 0) return;
    if ([row.speciesScientific, row.cultivar, row.commonName, row.rowLabel].includes(String(value))) return;
    lines.push(`- ${key}: ${value}`);
  });

  return lines;
};

export const buildSkillContextBlock = (args: {
  row: SkillRowContext;
  attachedFileNames: string[];
  projectContext?: string;
}): string => {
  const { row, attachedFileNames, projectContext } = args;
  const rowLines = formatRowContextLines(row);

  const parts: string[] = [
    "Row context:",
    ...(rowLines.length > 0 ? rowLines : ["- (none)"]),
    "",
    `File context: ${attachedFileNames.length > 0 ? attachedFileNames.join(", ") : "(none)"}`,
  ];

  if (projectContext) {
    parts.push("", "Project context:", projectContext);
  }

  parts.push("", "Instruction: Use species first; then consider other row fields for context.");

  return parts.join("\n");
};
