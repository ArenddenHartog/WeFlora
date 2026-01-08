import { getSkillTemplate } from '../skillTemplates.ts';
import type { SkillTemplateId } from '../skillTemplates.ts';
import type { SkillRowContext } from './types.ts';

export type SkillExecutionResult = {
  ok: boolean;
  rawText?: string;
  displayValue?: string;
  reasoning?: string;
  normalized?: any;
  outputType?: string;
  error?: string;
  model?: string;
  promptHash?: string;
};

// Single source of truth for Skill Template execution across Worksheet + Planning.
export const executeSkillTemplate = async (args: {
  templateId: SkillTemplateId;
  row: SkillRowContext;
  params: Record<string, any>;
  contextFiles: File[];
  attachedFileNames: string[];
  projectContext?: string;
}): Promise<SkillExecutionResult> => {
  const template = getSkillTemplate(args.templateId);
  if (!template) {
    return { ok: false, error: `Missing skill template ${args.templateId}` };
  }

  const compiledPrompt = template.buildPrompt({
    row: args.row,
    params: args.params,
    attachedFileNames: args.attachedFileNames,
    projectContext: args.projectContext
  });

  const { aiService } = await import('../aiService.ts');
  const result = await aiService.runSkillCell({
    prompt: compiledPrompt,
    outputType: template.outputType,
    validator: (raw) => template.validate(raw, args.params),
    contextFiles: args.contextFiles,
    evidenceRequired: template.evidenceRequired,
    noGuessing: template.noGuessing,
    allowedEnums: template.allowedEnums,
    allowedUnits: template.allowedUnits,
    allowedPeriods: template.allowedPeriods,
    allowedCurrencies: template.allowedCurrencies,
    defaultUnit: template.defaultUnit,
    defaultPeriod: args.params.period ?? template.defaultPeriod
  });

  if (!result.ok) {
    return { ok: false, error: result.error || result.reasoning };
  }

  return {
    ok: true,
    rawText: result.rawText,
    displayValue: result.displayValue,
    reasoning: result.reasoning,
    normalized: result.normalized,
    outputType: result.outputType,
    model: result.model,
    promptHash: result.promptHash
  };
};
