import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';
import type { EvidencePack, WorkOrder } from '../types';
import { FLORAGPT_BASE_SYSTEM } from '../prompts/base_system';
import { GENERAL_RESEARCH_SYSTEM } from '../prompts/modes/general_research_system';
import { SUITABILITY_SCORING_SYSTEM } from '../prompts/modes/suitability_scoring_system';
import { SPEC_WRITER_SYSTEM } from '../prompts/modes/spec_writer_system';
import { POLICY_COMPLIANCE_SYSTEM } from '../prompts/modes/policy_compliance_system';
import { buildJsonContract } from '../prompts/json_contract';
import { validateFloraGPTPayload } from '../schemas/validate';
import { buildRepairPrompt } from '../schemas/repairPrompt';
import type { AIService } from '../../../services/aiService';
import { ensureContext } from './ensureContext';
import generalResearchSchema from '../schemas/general_research.v0_1.json';
import suitabilityScoringSchema from '../schemas/suitability_scoring.v0_1.json';
import specWriterSchema from '../schemas/spec_writer.v0_1.json';
import policyComplianceSchema from '../schemas/policy_compliance.v0_1.json';

const modeSystemMap: Record<FloraGPTMode, string> = {
  general_research: GENERAL_RESEARCH_SYSTEM,
  suitability_scoring: SUITABILITY_SCORING_SYSTEM,
  spec_writer: SPEC_WRITER_SYSTEM,
  policy_compliance: POLICY_COMPLIANCE_SYSTEM,
};

const modeSchemaMap: Record<FloraGPTMode, object> = {
  general_research: generalResearchSchema,
  suitability_scoring: suitabilityScoringSchema,
  spec_writer: specWriterSchema,
  policy_compliance: policyComplianceSchema,
};

const parseJsonSafe = (text: string): unknown => {
  const clean = text.replace(/```json\n?|```/g, '').trim();
  return JSON.parse(clean);
};

export type FloraGPTRunResult = {
  ok: boolean;
  payload?: FloraGPTResponseEnvelope;
  rawText?: string;
  errors?: string[];
};

export const runMode = async (args: {
  workOrder: WorkOrder;
  evidencePack: EvidencePack;
  aiService: AIService;
}): Promise<FloraGPTRunResult> => {
  const { workOrder, evidencePack, aiService } = args;

  const contextGate = ensureContext(workOrder);
  if (contextGate) {
    return { ok: true, payload: contextGate };
  }

  const modeSystem = modeSystemMap[workOrder.mode];
  const schema = modeSchemaMap[workOrder.mode];
  const systemInstruction = [
    FLORAGPT_BASE_SYSTEM,
    modeSystem,
    buildJsonContract(schema)
  ].join('\n\n');

  const userPayload = { workOrder, evidencePack };

  const rawText = await aiService.generateFloraGPTResponse({
    systemInstruction,
    userPayload
  });

  try {
    const parsed = parseJsonSafe(rawText) as FloraGPTResponseEnvelope;
    if (parsed.meta?.schema_version && parsed.meta.schema_version !== workOrder.schemaVersion) {
      return { ok: false, rawText, errors: ['meta.schema_version mismatch'] };
    }
    const validation = validateFloraGPTPayload(workOrder.mode, parsed);
    if (validation.ok) {
      return { ok: true, payload: parsed, rawText };
    }

    const repairSystem = [
      FLORAGPT_BASE_SYSTEM,
      modeSystem,
      buildJsonContract(schema),
      buildRepairPrompt(validation.errors || [])
    ].join('\n\n');

    const repairedRaw = await aiService.generateFloraGPTResponse({
      systemInstruction: repairSystem,
      userPayload: { previousOutput: rawText, errors: validation.errors }
    });

    const repairedParsed = parseJsonSafe(repairedRaw) as FloraGPTResponseEnvelope;
    const repairedValidation = validateFloraGPTPayload(workOrder.mode, repairedParsed);
    if (repairedValidation.ok) {
      return { ok: true, payload: repairedParsed, rawText: repairedRaw };
    }

    return { ok: false, rawText, errors: repairedValidation.errors };
  } catch (error) {
    return { ok: false, rawText, errors: ['Failed to parse JSON output.'] };
  }
};
