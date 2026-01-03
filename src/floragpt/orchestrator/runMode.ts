import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';
import type { EvidencePack, WorkOrder } from '../types';
import { FLORAGPT_BASE_SYSTEM } from '../prompts/base_system.ts';
import { GENERAL_RESEARCH_SYSTEM } from '../prompts/modes/general_research_system.ts';
import { SUITABILITY_SCORING_SYSTEM } from '../prompts/modes/suitability_scoring_system.ts';
import { SPEC_WRITER_SYSTEM } from '../prompts/modes/spec_writer_system.ts';
import { POLICY_COMPLIANCE_SYSTEM } from '../prompts/modes/policy_compliance_system.ts';
import { buildJsonContract } from '../prompts/json_contract.ts';
import { validateFloraGPTPayload } from '../schemas/validate.ts';
import { buildRepairPrompt } from '../schemas/repairPrompt.ts';
import type { AIService } from '../../../services/aiService';
import { ensureContext } from './ensureContext.ts';
import { extractFirstJson } from '../utils/extractJson.ts';
import { buildCitationErrors, buildCitationFailurePayload } from './citations.ts';
import { buildToneInstruction } from './tone.ts';
import generalResearchSchema from '../schemas/general_research.v0_2.json';
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
  return JSON.parse(text);
};

export type FloraGPTRunResult = {
  ok: boolean;
  payload?: FloraGPTResponseEnvelope;
  rawText?: string;
  errors?: string[];
  repairAttempted: boolean;
  failureReason?: string | null;
  schemaVersionReceived?: string | null;
};

const buildCitationRepairPrompt = (errors: string[], evidencePack: EvidencePack) => {
  const sourceIds = [...evidencePack.globalHits, ...evidencePack.projectHits, ...evidencePack.policyHits].map(
    (hit) => hit.sourceId
  );
  return `
${buildRepairPrompt(errors)}
Available source_ids:
- ${sourceIds.join('\n- ')}
Add citations referencing only these source_ids. For general_research, populate meta.sources_used with objects shaped like {"source_id": "..."}.
`.trim();
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
  const languageInstruction = `Respond only in ${workOrder.userLanguage} regardless of source language.`;
  const toneInstruction = buildToneInstruction(workOrder);
  const systemInstruction = [
    FLORAGPT_BASE_SYSTEM,
    languageInstruction,
    toneInstruction,
    modeSystem,
    buildJsonContract(schema, workOrder.schemaVersion)
  ].join('\n\n');

  const userPayload = { workOrder, evidencePack };

  const rawText = await aiService.generateFloraGPTResponse({
    systemInstruction,
    userPayload
  });

  try {
    const extracted = extractFirstJson(rawText);
    if (!extracted.jsonText) {
      return {
        ok: false,
        rawText,
        errors: [extracted.reason || 'No JSON found'],
        repairAttempted: false,
        failureReason: 'json-extraction-failed',
        schemaVersionReceived: null
      };
    }

    const parsed = parseJsonSafe(extracted.jsonText) as FloraGPTResponseEnvelope;
    const schemaVersionReceived = parsed.meta?.schema_version ?? null;
    if (schemaVersionReceived !== workOrder.schemaVersion) {
      const repairSystem = [
        FLORAGPT_BASE_SYSTEM,
        languageInstruction,
        modeSystem,
        buildJsonContract(schema, workOrder.schemaVersion),
        buildRepairPrompt([`SchemaVersionMismatch: meta.schema_version must be ${workOrder.schemaVersion}`])
      ].join('\n\n');

      const repairedRaw = await aiService.generateFloraGPTResponse({
        systemInstruction: repairSystem,
        userPayload: { previousOutput: rawText, errors: ['SchemaVersionMismatch'] }
      });

      const repairedExtracted = extractFirstJson(repairedRaw);
      if (!repairedExtracted.jsonText) {
        return {
          ok: false,
          rawText,
          errors: ['SchemaVersionMismatch'],
          repairAttempted: true,
          failureReason: 'schema-version-mismatch',
          schemaVersionReceived
        };
      }

      const repairedParsed = parseJsonSafe(repairedExtracted.jsonText) as FloraGPTResponseEnvelope;
      const repairedValidation = validateFloraGPTPayload(workOrder.mode, repairedParsed);
      if (!repairedValidation.ok) {
        return {
          ok: false,
          rawText,
          errors: repairedValidation.errors,
          repairAttempted: true,
          failureReason: 'schema-version-mismatch',
          schemaVersionReceived
        };
      }
      return { ok: true, payload: repairedParsed, rawText: repairedRaw, repairAttempted: true, schemaVersionReceived: repairedParsed.meta?.schema_version ?? null };
    }

    const validation = validateFloraGPTPayload(workOrder.mode, parsed);
    if (validation.ok) {
      const citationErrors = buildCitationErrors(parsed, evidencePack, workOrder);
      if (citationErrors.length > 0) {
        const repairSystem = [
          FLORAGPT_BASE_SYSTEM,
          languageInstruction,
          modeSystem,
          buildJsonContract(schema, workOrder.schemaVersion),
          buildCitationRepairPrompt(citationErrors, evidencePack)
        ].join('\n\n');

        const repairedRaw = await aiService.generateFloraGPTResponse({
          systemInstruction: repairSystem,
          userPayload: { previousOutput: rawText, errors: citationErrors }
        });
        const repairedExtracted = extractFirstJson(repairedRaw);
        if (!repairedExtracted.jsonText) {
          if (workOrder.mode === 'general_research') {
            return {
              ok: true,
              payload: buildCitationFailurePayload(workOrder),
              rawText,
              repairAttempted: true,
              schemaVersionReceived
            };
          }
          return {
            ok: false,
            rawText,
            errors: citationErrors,
            repairAttempted: true,
            failureReason: 'citation-validation-failed',
            schemaVersionReceived
          };
        }
        const repairedParsed = parseJsonSafe(repairedExtracted.jsonText) as FloraGPTResponseEnvelope;
        const repairedValidation = validateFloraGPTPayload(workOrder.mode, repairedParsed);
        const repairedCitationErrors = buildCitationErrors(repairedParsed, evidencePack, workOrder);
        if (!repairedValidation.ok || repairedCitationErrors.length > 0) {
          if (workOrder.mode === 'general_research') {
            return {
              ok: true,
              payload: buildCitationFailurePayload(workOrder),
              rawText,
              repairAttempted: true,
              schemaVersionReceived
            };
          }
          return {
            ok: false,
            rawText,
            errors: [...(repairedValidation.errors || []), ...repairedCitationErrors],
            repairAttempted: true,
            failureReason: 'citation-validation-failed',
            schemaVersionReceived
          };
        }
        return { ok: true, payload: repairedParsed, rawText: repairedRaw, repairAttempted: true, schemaVersionReceived: repairedParsed.meta?.schema_version ?? null };
      }
      return {
        ok: true,
        payload: parsed,
        rawText,
        repairAttempted: false,
        schemaVersionReceived
      };
    }

    const repairSystem = [
      FLORAGPT_BASE_SYSTEM,
      languageInstruction,
      modeSystem,
      buildJsonContract(schema, workOrder.schemaVersion),
      buildRepairPrompt(validation.errors || [])
    ].join('\n\n');

    const repairedRaw = await aiService.generateFloraGPTResponse({
      systemInstruction: repairSystem,
      userPayload: { previousOutput: rawText, errors: validation.errors }
    });

    const repairedExtracted = extractFirstJson(repairedRaw);
    if (!repairedExtracted.jsonText) {
      return {
        ok: false,
        rawText,
        errors: validation.errors,
        repairAttempted: true,
        failureReason: 'schema-validation-failed',
        schemaVersionReceived
      };
    }
    const repairedParsed = parseJsonSafe(repairedExtracted.jsonText) as FloraGPTResponseEnvelope;
    const repairedValidation = validateFloraGPTPayload(workOrder.mode, repairedParsed);
    const repairedCitationErrors = buildCitationErrors(repairedParsed, evidencePack, workOrder);
    if (repairedValidation.ok && repairedCitationErrors.length === 0) {
      return {
        ok: true,
        payload: repairedParsed,
        rawText: repairedRaw,
        repairAttempted: true,
        schemaVersionReceived: repairedParsed.meta?.schema_version ?? null
      };
    }

    return {
      ok: false,
      rawText,
      errors: [...(repairedValidation.errors || []), ...repairedCitationErrors],
      repairAttempted: true,
      failureReason: 'schema-validation-failed',
      schemaVersionReceived
    };
  } catch (error) {
    return {
      ok: false,
      rawText,
      errors: ['Failed to parse JSON output.'],
      repairAttempted: false,
      failureReason: 'json-parse-error',
      schemaVersionReceived: null
    };
  }
};
