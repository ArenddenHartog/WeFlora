import type { SkillOutputType } from "../../types";

export type OutputFormatOptions = {
  allowedEnums?: string[];
  allowedUnits?: string[];
  allowedPeriods?: string[];
  allowedCurrencies?: string[];
  defaultUnit?: string;
  defaultPeriod?: string;
};

export const getOutputFormatHint = (
  outputType: SkillOutputType,
  options?: OutputFormatOptions
): string => {
  switch (outputType) {
    case "badge":
      return `Compliant|Rejected|Insufficient Data — reason`;
    case "score":
      return `NN/100 — reason`;
    case "currency":
      return `€NNN/${options?.defaultPeriod || "period"} — reason`;
    case "quantity":
      return `N ${options?.defaultUnit || "UNIT"}/${options?.defaultPeriod || "period"} — reason`;
    case "enum":
      return `${options?.allowedEnums?.join("|") || "Value"} — reason`;
    case "range":
      return `Min–Max — reason`;
    case "text":
    default:
      return `<statement> — reason`;
  }
};

export const buildRetryInstruction = (
  outputType: SkillOutputType,
  error: string,
  options?: OutputFormatOptions
): string => {
  const formatHint = getOutputFormatHint(outputType, options);
  return [
    `Previous output was invalid: "${error}".`,
    "CRITICAL: Your output MUST match the format exactly.",
    `Expected format: ${formatHint}.`,
    "Do NOT include markdown blocks, preambles, or extra text.",
    "Return only the value and the reason separated by \" — \"."
  ].join("\n");
};
