import type { AgentProfile, InputFieldSpec, JsonSchema } from '../../decision-program/contracts/types';

export type ContractRecordType = 'Policy' | 'SpeciesList' | 'Site' | 'Vision' | 'Climate' | 'Other';

export type InputPointerSpec = {
  pointer: string;
  type: 'file' | 'record_ref' | 'scalar';
  required: boolean;
  allowedSources: Array<'Vault' | 'Manual' | 'Session Upload'>;
  notes?: string;
};

export type RequiredContextSpec = {
  recordType: ContractRecordType;
  requiredFields: Array<{ name: string; type: string; required: boolean }>;
  acceptedSources: string[];
  confidenceThreshold: number;
  optional?: boolean;
};

export type OutputContractSpec = {
  writes: string[];
  mutations: string[];
  artifacts: Array<{ label: string; format: string }>;
  payloadSchema: JsonSchema;
};

export type EvidenceRulesSpec = {
  required: boolean;
  allowedSources: string[];
  citationFormat: string;
  downgradeOnMissing: boolean;
};

export type SkillContractMeta = {
  inputPointers: InputPointerSpec[];
  requiredContext: RequiredContextSpec[];
  output: OutputContractSpec;
  evidenceRules: EvidenceRulesSpec;
};

const pointerForInput = (input: InputFieldSpec) => input.pointer ?? `/inputs/${input.key}`;

const mapInputToPointerSpec = (input: InputFieldSpec): InputPointerSpec => {
  const sourceMap: Record<InputFieldSpec['source'], InputPointerSpec['type']> = {
    value: 'scalar',
    pointer: 'record_ref',
    file: 'file'
  };

  const allowedSources: InputPointerSpec['allowedSources'] = input.source === 'value'
    ? ['Manual']
    : input.source === 'file'
      ? ['Vault', 'Session Upload']
      : ['Vault'];

  return {
    pointer: pointerForInput(input),
    type: sourceMap[input.source],
    required: input.required,
    allowedSources,
    notes: input.description
  };
};

const basePolicyFields = [
  { name: 'jurisdiction', type: 'string', required: true },
  { name: 'effective_date', type: 'date', required: true },
  { name: 'clauses', type: 'array', required: true }
];

const baseSpeciesFields = [
  { name: 'species', type: 'string', required: true },
  { name: 'dbh', type: 'number', required: true },
  { name: 'quantity', type: 'number', required: true }
];

const baseSiteFields = [
  { name: 'location', type: 'string', required: true },
  { name: 'constraints', type: 'array', required: true },
  { name: 'land_use', type: 'string', required: false }
];

const baseVisionFields = [
  { name: 'objective', type: 'string', required: true },
  { name: 'targets', type: 'array', required: true }
];

const baseClimateFields = [
  { name: 'risk_factors', type: 'array', required: true },
  { name: 'mitigations', type: 'array', required: true }
];

const inferContextBlocks = (profile: AgentProfile): RequiredContextSpec[] => {
  const tags = new Set(profile.tags.map((tag) => tag.toLowerCase()));
  const blocks: RequiredContextSpec[] = [];

  const addBlock = (recordType: ContractRecordType, fields: RequiredContextSpec['requiredFields'], sources: string[], threshold = 0.8) => {
    blocks.push({
      recordType,
      requiredFields: fields,
      acceptedSources: sources,
      confidenceThreshold: threshold
    });
  };

  if (profile.category === 'compliance' || tags.has('policy') || profile.id.includes('policy')) {
    addBlock('Policy', basePolicyFields, ['PDF', 'DOCX'], 0.8);
  }
  if (profile.category === 'biodiversity' || tags.has('species') || tags.has('inventory') || profile.id.includes('species')) {
    addBlock('SpeciesList', baseSpeciesFields, ['CSV', 'XLSX'], 0.7);
  }
  if (profile.category === 'site' || tags.has('site')) {
    addBlock('Site', baseSiteFields, ['PDF', 'DOCX', 'CSV'], 0.7);
  }
  if (profile.category === 'planning' || tags.has('vision')) {
    addBlock('Vision', baseVisionFields, ['PDF', 'DOCX', 'TXT'], 0.7);
  }
  if (profile.category === 'climate_resilience' || tags.has('climate')) {
    addBlock('Climate', baseClimateFields, ['PDF', 'DOCX', 'CSV'], 0.7);
  }

  if (blocks.length === 0) {
    blocks.push({
      recordType: 'Other',
      requiredFields: [{ name: 'summary', type: 'string', required: true }],
      acceptedSources: ['PDF', 'DOCX', 'TXT'],
      confidenceThreshold: 0.6,
      optional: true
    });
  }

  return blocks;
};

const inferArtifacts = (profile: AgentProfile): OutputContractSpec['artifacts'] => {
  if (profile.category === 'compliance') {
    return [{ label: 'Memo', format: 'PDF' }];
  }
  if (profile.category === 'planning') {
    return [{ label: 'Worksheet', format: 'Worksheet' }];
  }
  if (profile.category === 'documentation') {
    return [{ label: 'Report', format: 'PDF' }];
  }
  return [{ label: 'Summary', format: 'JSON' }];
};

export const buildSkillContractMeta = (profile: AgentProfile): SkillContractMeta => {
  const inputPointers = profile.inputs.map(mapInputToPointerSpec);
  const requiredContext = inferContextBlocks(profile);
  const output: OutputContractSpec = {
    writes: profile.writes ?? [],
    mutations: profile.writes ?? [],
    artifacts: inferArtifacts(profile),
    payloadSchema: profile.output.payload_schema
  };
  const evidenceRules: EvidenceRulesSpec = {
    required: profile.category === 'compliance' || profile.category === 'planning',
    allowedSources: ['Vault', 'Session Upload', 'Manual'],
    citationFormat: 'stable_id + locator',
    downgradeOnMissing: true
  };

  return { inputPointers, requiredContext, output, evidenceRules };
};

export const collectRequiredContextSummary = (profiles: AgentProfile[]) => {
  const tally = new Map<ContractRecordType, number>();
  profiles.forEach((profile) => {
    const required = inferContextBlocks(profile);
    required.forEach((item) => {
      tally.set(item.recordType, (tally.get(item.recordType) ?? 0) + (item.optional ? 0 : 1));
    });
  });

  return Array.from(tally.entries()).map(([recordType, count]) => ({ recordType, count }));
};

export const getSkillContextTypes = (profile: AgentProfile): ContractRecordType[] => {
  return inferContextBlocks(profile).map((item) => item.recordType);
};
