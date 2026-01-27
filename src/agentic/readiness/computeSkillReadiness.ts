import type { AgentProfile, InputFieldSpec, JsonSchema, JsonPointer } from '../../decision-program/contracts/types';
import type {
  CandidateContext,
  CandidateMatch,
  ComputeReadinessArgs,
  InputCoverage,
  ReadinessStatus,
  SkillBinding,
  SkillBindings,
  SkillReadinessResult,
  VaultRecord,
  VaultScopeRef
} from './types';

const DEFAULT_MIN_CONF = 0.8;

const normalizePointer = (pointer: string): string => pointer.replace(/~1/g, '/').replace(/~0/g, '~');

const getByPointer = (data: Record<string, unknown>, pointer: JsonPointer): unknown => {
  if (!pointer || pointer === '/') return data;
  const parts = pointer
    .split('/')
    .slice(1)
    .map((part) => normalizePointer(part));
  let current: any = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const scoreToLevel = (score: number): 'High' | 'Medium' | 'Low' => {
  if (score >= 0.7) return 'High';
  if (score >= 0.4) return 'Medium';
  return 'Low';
};

const matchesMime = (mime: string, accept: string[]) => {
  return accept.some((rule) => {
    if (rule.endsWith('/*')) {
      const prefix = rule.replace('/*', '');
      return mime.startsWith(prefix);
    }
    return mime === rule;
  });
};

const checkSchema = (value: unknown, schema?: JsonSchema): boolean => {
  if (!schema || schema.type === undefined) return true;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (!type) return true;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  if (type === 'number') return typeof value === 'number';
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  return true;
};

const preferScopeScore = (record: VaultRecord, preferScope?: VaultScopeRef) => {
  if (!preferScope) return { score: 0, reason: 'scope neutral' };
  if (preferScope.kind === record.scope.kind) {
    if (preferScope.kind === 'project' && preferScope.project_id === record.scope.project_id) {
      return { score: 0.15, reason: 'preferred project scope' };
    }
    return { score: 0.08, reason: 'preferred scope' };
  }
  return { score: -0.05, reason: 'non-preferred scope' };
};

const scoreRelevance = (record: VaultRecord, input: InputFieldSpec, pointerPresent: boolean, confidence: number, preferScope?: VaultScopeRef) => {
  let score = 0.2;
  const reasons: string[] = [];

  const scope = preferScopeScore(record, preferScope);
  score += scope.score;
  reasons.push(scope.reason);

  if (pointerPresent) {
    score += 0.15;
    reasons.push('pointer present');
  }

  score += Math.min(confidence, 1) * 0.25;
  reasons.push(`confidence ${confidence.toFixed(2)}`);

  const recencyBoost = record.updated_at ? Math.min(0.1, 1 / (1 + (Date.now() - new Date(record.updated_at).getTime()) / 86400000)) : 0;
  score += recencyBoost;
  if (recencyBoost > 0.02) reasons.push('recent update');

  const tags = (record.tags ?? []).map((tag) => tag.toLowerCase());
  const tokens = [input.label, input.description ?? '']
    .join(' ')
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
  const overlap = tokens.filter((token) => tags.includes(token)).length;
  if (overlap > 0) {
    score += Math.min(overlap * 0.05, 0.15);
    reasons.push('tag overlap');
  }

  score = Math.max(0, Math.min(1, score));
  return { score, level: scoreToLevel(score), reasons };
};

const mapSource = (input: InputFieldSpec): InputCoverage['source'] => {
  if (input.source === 'file') return 'vault_file';
  if (input.source === 'pointer') return 'vault_record';
  return 'manual';
};

const pointerIssues = (pointerPresent: boolean, pointer: JsonPointer): CandidateMatch['issues'] => {
  if (pointerPresent) return [];
  return [{ code: 'pointer_missing', message: `Pointer ${pointer} is missing from record` }];
};

const deriveCandidateMatch = (record: VaultRecord, ctx: CandidateContext): CandidateMatch => {
  const { input, prefs } = ctx;
  const issues: CandidateMatch['issues'] = [];
  const pointer = input.pointer as JsonPointer | undefined;
  let pointerCoverage: CandidateMatch['pointer_coverage'] | undefined;
  let pointerPresent = true;

  if (pointer) {
    const value = getByPointer(record.data, pointer);
    pointerPresent = value !== undefined && value !== null;
    const confidence = record.confidence_by_pointer?.[pointer] ?? record.confidence;
    const provenanceRequired = record.type === 'Policy' || prefs.requireProvenanceDefault;
    const provenanceCount = record.provenance_by_pointer?.[pointer]?.length ?? 0;
    const provenanceOk = provenanceRequired ? provenanceCount > 0 : true;
    const confidenceOk = confidence >= prefs.minConf;
    pointerCoverage = {
      pointer,
      present: pointerPresent,
      confidence,
      confidence_ok: confidenceOk,
      provenance_count: provenanceCount,
      provenance_ok: provenanceOk
    };

    if (!pointerPresent) {
      issues.push(...pointerIssues(pointerPresent, pointer));
    }
    if (!checkSchema(value, input.schema)) {
      issues.push({ code: 'schema_mismatch', message: `Value does not match schema for ${pointer}` });
    }
    if (confidence < prefs.minConf) {
      issues.push({ code: 'low_confidence', message: `Confidence ${confidence.toFixed(2)} below ${prefs.minConf}`, observed: confidence, threshold: prefs.minConf });
    }
    if (!provenanceOk) {
      issues.push({ code: 'missing_provenance', message: 'Required provenance missing' });
    }
  }

  let fileCoverage: CandidateMatch['file_coverage'] | undefined;
  if (input.file?.accept && input.file.accept.length > 0) {
    const matchedFiles = (record.files ?? []).filter((file) => matchesMime(file.mime, input.file?.accept ?? []));
    fileCoverage = { matched: matchedFiles.length > 0, matched_files: matchedFiles };
    if (matchedFiles.length === 0) {
      issues.push({ code: 'file_type_mismatch', message: 'No matching file type found' });
    }
  }

  const confidence = pointerCoverage?.confidence ?? record.confidence;
  const relevance = scoreRelevance(record, input, pointerPresent, confidence, prefs.preferScope);

  return {
    vault_id: record.vault_id,
    title: record.title,
    type: record.type,
    scope: record.scope,
    pointer_coverage: pointerCoverage,
    file_coverage: fileCoverage,
    confidence,
    relevance,
    issues
  };
};

const findCandidatesForInput = (ctx: CandidateContext): CandidateMatch[] => {
  const { input, vault, prefs } = ctx;
  if (input.source === 'value') return [];
  const candidates = vault
    .filter((record) => {
      if (input.source === 'file') {
        if (!record.files || record.files.length === 0) return false;
        if (input.file?.accept?.length) {
          return record.files.some((file) => matchesMime(file.mime, input.file?.accept ?? []));
        }
      }
      return true;
    })
    .map((record) => deriveCandidateMatch(record, { input, vault, prefs }));

  return candidates.sort((a, b) => b.relevance.score - a.relevance.score);
};

const resolveSelectedBinding = (
  input: InputFieldSpec,
  candidates: CandidateMatch[],
  existingBindings?: Partial<SkillBindings>
): SkillBinding | undefined => {
  const existing = existingBindings?.inputs?.[input.key];
  if (existing) return existing;

  if (input.source === 'value') return undefined;

  const preferred = candidates.find((candidate) => {
    const pointerOk = candidate.pointer_coverage?.present ?? true;
    const confOk = candidate.pointer_coverage?.confidence_ok ?? true;
    const provOk = candidate.pointer_coverage?.provenance_ok ?? true;
    const fileOk = candidate.file_coverage?.matched ?? true;
    return pointerOk && confOk && provOk && fileOk;
  }) ?? candidates[0];

  if (!preferred) return undefined;

  if (input.source === 'file' && preferred.file_coverage?.matched_files?.length) {
    return { kind: 'vault_file', file_id: preferred.file_coverage.matched_files[0].file_id, vault_id: preferred.vault_id };
  }

  return { kind: 'vault_record', vault_id: preferred.vault_id, pointer: input.pointer };
};

const computeInputIssues = (input: InputFieldSpec, candidates: CandidateMatch[], selected?: SkillBinding): InputCoverage['issues'] => {
  const issues: InputCoverage['issues'] = [];
  if (input.required && candidates.length === 0 && input.source !== 'value') {
    issues.push({ code: 'no_candidates', message: 'No vault candidates found.' });
  }
  if (input.required && !selected) {
    if (input.source === 'value') {
      issues.push({ code: 'needs_manual', message: 'Manual input required.' });
    } else {
      issues.push({ code: 'missing_required', message: 'Required input missing.' });
    }
  }
  return issues;
};

const buildBindings = (profile: AgentProfile, coverage: InputCoverage[]): SkillBindings => {
  const inputs: SkillBindings['inputs'] = {};
  coverage.forEach((item) => {
    if (item.selected) inputs[item.input_key] = item.selected;
  });

  const reads: SkillBindings['reads'] = {};
  profile.reads.forEach((pointer) => {
    const matchingInput = coverage.find((item) => item.pointer === pointer && item.selected);
    if (matchingInput?.selected) {
      reads[pointer] = { kind: 'from_input', input_key: matchingInput.input_key };
      return;
    }
    const anyBinding = coverage.find((item) => item.selected && (item.selected.kind === 'vault_record' || item.selected.kind === 'vault_file'));
    if (anyBinding?.selected) {
      reads[pointer] = anyBinding.selected;
    }
  });

  return { inputs, reads };
};

const computeStatus = (coverage: InputCoverage[], prefs: { minConf: number }): ReadinessStatus => {
  let status: ReadinessStatus = 'ready';
  let needsReview = false;

  for (const input of coverage) {
    if (!input.required) continue;
    if (!input.selected) {
      if (input.source === 'manual') return 'missing';
      if (input.source === 'vault_record' || input.source === 'vault_file') return 'blocked';
      return 'missing';
    }

    const selected = input.selected;
    if (selected && selected.kind === 'vault_record') {
      const candidate = input.candidates.find((item) => item.vault_id === selected.vault_id);
      if (candidate?.issues.some((issue) => issue.code === 'missing_provenance')) {
        needsReview = true;
      }
      if (candidate?.issues.some((issue) => issue.code === 'low_confidence')) {
        needsReview = true;
      }
    }
  }

  if (needsReview) status = 'needs_review';
  return status;
};

const summarize = (profile: AgentProfile, coverage: InputCoverage[], status: ReadinessStatus) => {
  const reasons: string[] = [];
  const missing = coverage.filter((item) => item.required && !item.selected).map((item) => item.input_key);
  const warnings = coverage
    .flatMap((item) => item.candidates.flatMap((candidate) => candidate.issues))
    .map((issue) => issue.message);

  if (status === 'blocked') reasons.push('Blocked due to missing required vault context.');
  if (status === 'missing') reasons.push('Missing required inputs.');
  if (status === 'needs_review') reasons.push('Needs review due to confidence or provenance gaps.');

  return {
    summary: `${profile.title} readiness: ${status}.`,
    reasons,
    missing_inputs: missing,
    warnings
  };
};

const buildActions = (profile: AgentProfile, coverage: InputCoverage[]) => {
  const add_now: SkillReadinessResult['actions']['add_now'] = [];
  const fill_manually: SkillReadinessResult['actions']['fill_manually'] = [];
  const review_queue: SkillReadinessResult['actions']['review_queue'] = [];

  coverage.forEach((item) => {
    if (!item.selected && item.required) {
      add_now.push({
        input_key: item.input_key,
        suggested_accept: profile.inputs.find((input) => input.key === item.input_key)?.file?.accept,
        suggested_control: profile.inputs.find((input) => input.key === item.input_key)?.ui?.control
      });
      if (item.source === 'manual') {
        fill_manually.push({ input_key: item.input_key });
      }
    }

    item.candidates.forEach((candidate) => {
      if (candidate.issues.some((issue) => issue.code === 'missing_provenance')) {
        review_queue.push({ input_key: item.input_key, vault_id: candidate.vault_id });
      }
    });
  });

  return { add_now, fill_manually, review_queue };
};

const metrics = (coverage: InputCoverage[]) => {
  const required = coverage.filter((item) => item.required);
  const requiredSatisfied = required.filter((item) => item.selected);
  const missingRequired = required.filter((item) => !item.selected);
  const needsReview = coverage.filter((item) => item.candidates.some((candidate) => candidate.issues.some((issue) => issue.code === 'low_confidence' || issue.code === 'missing_provenance')));

  return {
    required_total: required.length,
    required_satisfied: requiredSatisfied.length,
    missing_required: missingRequired.length,
    needs_review: needsReview.length
  };
};

export function computeSkillReadiness(args: ComputeReadinessArgs): SkillReadinessResult {
  const { profile, vault, existingBindings, opts } = args;
  const minConf = opts?.min_confidence_default ?? DEFAULT_MIN_CONF;
  const preferScope = opts?.prefer_scope;
  const requireProvenanceDefault = opts?.require_provenance_default ?? false;

  const prefs = { minConf, preferScope, requireProvenanceDefault };

  const coverage: InputCoverage[] = profile.inputs.map((input) => {
    const candidates = findCandidatesForInput({ input, vault, prefs });
    const selected = resolveSelectedBinding(input, candidates, existingBindings);
    const issues = computeInputIssues(input, candidates, selected);

    return {
      input_key: input.key,
      required: input.required,
      source: mapSource(input),
      pointer: input.pointer,
      candidates,
      selected,
      issues
    };
  });

  const bindings = buildBindings(profile, coverage);
  const status = computeStatus(coverage, { minConf });

  return {
    status,
    profile_id: profile.id,
    spec_version: profile.spec_version,
    schema_version: profile.schema_version,
    coverage,
    bindings,
    explanation: summarize(profile, coverage, status),
    actions: buildActions(profile, coverage),
    metrics: metrics(coverage)
  };
}
