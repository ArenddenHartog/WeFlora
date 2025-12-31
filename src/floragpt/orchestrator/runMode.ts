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
import { extractFirstJson } from '../utils/extractJson';
import type { EvidencePack } from '../types';
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

const normalizeIds = (items: any[] | undefined): string[] => {
  if (!items) return [];
  return items
    .map((item) => (typeof item === 'string' ? item : item?.source_id))
    .filter((id): id is string => Boolean(id));
};

const buildCitationErrors = (payload: FloraGPTResponseEnvelope, evidencePack: EvidencePack): string[] => {
  const errors: string[] = [];
  const totalEvidence = evidencePack.globalHits.length + evidencePack.projectHits.length + evidencePack.policyHits.length;
  if (totalEvidence === 0) return errors;

  const sourceIds = new Set(
    [...evidencePack.globalHits, ...evidencePack.projectHits, ...evidencePack.policyHits].map((hit) => hit.sourceId)
  );

  if (payload.mode === 'general_research') {
    const sourcesUsed = normalizeIds((payload.meta as any)?.sources_used);
    if (sourcesUsed.length === 0) {
      errors.push('general_research requires sources_used when evidence exists');
    }
    sourcesUsed.forEach((id) => {
      if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
    });
  }

  if (payload.mode === 'suitability_scoring') {
    const results = payload.data?.results || [];
    results.forEach((result: any, idx: number) => {
      const citations = normalizeIds(result.citations);
      if (citations.length === 0) {
        errors.push(`results[${idx}] requires citations`);
      }
      citations.forEach((id) => {
        if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
      });
    });
  }

  if (payload.mode === 'spec_writer') {
    const citations = normalizeIds(payload.data?.citations);
    if (citations.length === 0) {
      errors.push('spec_writer requires citations when evidence exists');
    }
    citations.forEach((id) => {
      if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
    });
  }

  if (payload.mode === 'policy_compliance') {
    if (evidencePack.policyHits.length > 0) {
      const issues = payload.data?.issues || [];
      issues.forEach((issue: any, idx: number) => {
        const citations = normalizeIds(issue.citations);
        if (citations.length === 0) {
          errors.push(`issues[${idx}] requires citations`);
        }
        citations.forEach((id) => {
          if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
        });
      });
    }
  }

  return errors;
};

const buildCitationRepairPrompt = (errors: string[], evidencePack: EvidencePack) => {
  const sourceIds = [...evidencePack.globalHits, ...evidencePack.projectHits, ...evidencePack.policyHits].map(
    (hit) => hit.sourceId
  );
  return `
${buildRepairPrompt(errors)}
Available source_ids:
- ${sourceIds.join('\n- ')}
Add citations referencing only these source_ids.
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
        modeSystem,
        buildJsonContract(schema),
        buildRepairPrompt(['SchemaVersionMismatch: meta.schema_version must be v0.1'])
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
      const citationErrors = buildCitationErrors(parsed, evidencePack);
      if (citationErrors.length > 0) {
        const repairSystem = [
          FLORAGPT_BASE_SYSTEM,
          modeSystem,
          buildJsonContract(schema),
          buildCitationRepairPrompt(citationErrors, evidencePack)
        ].join('\n\n');

        const repairedRaw = await aiService.generateFloraGPTResponse({
          systemInstruction: repairSystem,
          userPayload: { previousOutput: rawText, errors: citationErrors }
        });
        const repairedExtracted = extractFirstJson(repairedRaw);
        if (!repairedExtracted.jsonText) {
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
        const repairedCitationErrors = buildCitationErrors(repairedParsed, evidencePack);
        if (!repairedValidation.ok || repairedCitationErrors.length > 0) {
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
      modeSystem,
      buildJsonContract(schema),
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
    const repairedCitationErrors = buildCitationErrors(repairedParsed, evidencePack);
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
