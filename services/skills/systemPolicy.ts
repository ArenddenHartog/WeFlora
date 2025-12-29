import type { SkillOutputType } from "../../types";
import { getOutputFormatHint } from "./outputFormats.ts";

export type SystemPolicyOptions = {
  outputType: SkillOutputType;
  evidenceRequired?: boolean;
  noGuessing?: boolean;
  outputFormatHint?: string;
};

const BASE_SYSTEM_POLICY = `You are a precise, safety-conscious analyst.
Follow the provided output format instructions exactly.
Return a single line with the answer and a brief reason separated by " — ".
Do not include markdown, code blocks, or extra commentary.`;

const SAFETY_POLICY = `If the request is unsafe or outside scope, respond with "Insufficient Data — request not supported".`;

export const buildSystemInstruction = (options: SystemPolicyOptions): string => {
  const formatHint = options.outputFormatHint || getOutputFormatHint(options.outputType);
  const rules: string[] = [BASE_SYSTEM_POLICY, SAFETY_POLICY];

  if (options.evidenceRequired) {
    rules.push(
      "Use only the provided context and documents as evidence. Cite explicit evidence in your reason."
    );
  }

  if (options.noGuessing) {
    rules.push(
      "If the answer is not explicitly supported by the context, respond with " +
        '"Insufficient Data — state what is missing and the next step".'
    );
  }

  if (formatHint) {
    rules.push(`Expected format: ${formatHint}`);
  }

  return rules.join("\n");
};
