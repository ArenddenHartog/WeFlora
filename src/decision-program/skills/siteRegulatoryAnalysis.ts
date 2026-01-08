import type {
  DerivedConstraints,
  EvidenceFileRef,
  EvidenceItem,
  EvidenceKind,
  EvidenceSource,
  TimelineEntry
} from '../types.ts';
import { DERIVED_POINTER_SPECS } from '../orchestrator/derivedConstraints.ts';
import { executeSkillTemplate } from '../../../services/skills/executeSkillTemplate.ts';

type FieldMatch = {
  pointer: string;
  fieldPath: string;
  kind: EvidenceKind;
  label: string;
  value: string | number | boolean;
  sourceId: string;
  page?: number;
  confidence: number;
};

const now = () => new Date().toISOString();

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

const extractText = (doc: EvidenceFileRef) =>
  doc.content ?? (doc as any).text ?? (doc as any).snippet ?? '';

const normalizeToken = (value: string) => value.trim().replace(/\s+/g, ' ');

const extractPageHint = (content: string, index: number) => {
  const slice = content.slice(Math.max(0, index - 80), index + 80);
  const match = slice.match(/page\s+(\d+)/i);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
};

const matchValue = (
  content: string,
  regex: RegExp,
  parser: (match: RegExpExecArray) => string | number | boolean
): { value: string | number | boolean; page?: number } | null => {
  const match = regex.exec(content);
  if (!match) return null;
  const page = extractPageHint(content, match.index ?? 0);
  return { value: parser(match), page };
};

const buildEvidenceSources = (docs: EvidenceFileRef[]): EvidenceSource[] =>
  docs.map((doc, index) => ({
    id: String(doc.id ?? doc.fileId ?? `doc-${index + 1}`),
    title: doc.title ?? (doc as any).name ?? `Document ${index + 1}`,
    fileId: doc.fileId ?? doc.id,
    url: doc.url,
    retrievedAt: now()
  }));

const setDerivedField = (
  derived: DerivedConstraints,
  fieldPath: string,
  value: string | number | boolean | null,
  confidence: number
) => {
  if (!hasValue(value)) return;
  const segments = fieldPath.split('.');
  let cursor: any = derived;
  for (let i = 0; i < segments.length - 1; i += 1) {
    cursor = cursor[segments[i]];
  }
  const last = segments[segments.length - 1];
  if (!hasValue(cursor[last])) {
    cursor[last] = value;
    derived.meta.confidenceByField = derived.meta.confidenceByField ?? {};
    derived.meta.confidenceByField[fieldPath] = confidence;
  }
};

const buildDerivedConstraintsShell = (): DerivedConstraints => ({
  regulatory: {
    setting: null,
    saltToleranceRequired: null,
    protectedZone: null,
    permitNeeded: null,
    maxHeightClass: null,
    notes: null
  },
  site: {
    lightExposure: null,
    soilType: null,
    moisture: null,
    compactionRisk: null,
    rootingVolumeClass: null,
    crownClearanceClass: null,
    utilitiesPresent: null,
    setbacksKnown: null
  },
  equity: {
    priorityZones: null,
    heatVulnerability: null,
    asthmaBurden: null,
    underservedFlag: null
  },
  biophysical: {
    canopyCover: null,
    lstClass: null,
    distanceToPaved: null,
    floodRisk: null
  },
  meta: {
    derivedFrom: [],
    confidenceByField: {}
  }
});

const buildFieldMatchers = () => {
  const specs = DERIVED_POINTER_SPECS.reduce<Record<string, { fieldPath: string }>>((acc, spec) => {
    acc[spec.pointer] = { fieldPath: spec.fieldPath };
    return acc;
  }, {});
  return [
    {
      pointer: '/context/regulatory/setting',
      kind: 'regulatory' as const,
      label: 'Regulatory setting',
      fieldPath: specs['/context/regulatory/setting']?.fieldPath ?? 'regulatory.setting',
      regex: /(regulatory|zoning)\s+setting\s*:\s*([^\n]+)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2])
    },
    {
      pointer: '/context/regulatory/setting',
      kind: 'regulatory' as const,
      label: 'Regulatory setting',
      fieldPath: specs['/context/regulatory/setting']?.fieldPath ?? 'regulatory.setting',
      regex: /(provincial road|state highway|municipal right-of-way|public park)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[1])
    },
    {
      pointer: '/context/site/light',
      kind: 'site' as const,
      label: 'Light exposure',
      fieldPath: specs['/context/site/light']?.fieldPath ?? 'site.lightExposure',
      regex: /(light exposure|light)\s*:\s*(full sun|partial shade|shade|sunny)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2])
    },
    {
      pointer: '/context/site/soil/type',
      kind: 'site' as const,
      label: 'Soil type',
      fieldPath: specs['/context/site/soil/type']?.fieldPath ?? 'site.soilType',
      regex: /soil\s+type\s*:\s*(clay|loam|sand|silt|peat)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[1])
    },
    {
      pointer: '/context/site/soil/moisture',
      kind: 'site' as const,
      label: 'Soil moisture',
      fieldPath: specs['/context/site/soil/moisture']?.fieldPath ?? 'site.moisture',
      regex: /moisture\s*:\s*(dry|moist|wet|waterlogged)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[1])
    },
    {
      pointer: '/context/site/soil/compaction',
      kind: 'site' as const,
      label: 'Compaction risk',
      fieldPath: specs['/context/site/soil/compaction']?.fieldPath ?? 'site.compactionRisk',
      regex: /compaction\s+(risk|level)\s*:\s*(high|medium|low)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2])
    },
    {
      pointer: '/context/site/space/rootingVolumeClass',
      kind: 'site' as const,
      label: 'Rooting volume',
      fieldPath: specs['/context/site/space/rootingVolumeClass']?.fieldPath ?? 'site.rootingVolumeClass',
      regex: /rooting\s+volume\s*(class)?\s*:\s*(small|medium|large)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2])
    },
    {
      pointer: '/context/site/space/crownClearanceClass',
      kind: 'site' as const,
      label: 'Crown clearance',
      fieldPath: specs['/context/site/space/crownClearanceClass']?.fieldPath ?? 'site.crownClearanceClass',
      regex: /crown\s+clearance\s*(class)?\s*:\s*(low|medium|high)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2])
    },
    {
      pointer: '/context/regulatory/constraints/utilityConflicts',
      kind: 'site' as const,
      label: 'Utility conflicts',
      fieldPath: specs['/context/regulatory/constraints/utilityConflicts']?.fieldPath ?? 'site.utilitiesPresent',
      regex: /(utilities present|utility conflicts)\s*:\s*(yes|no|true|false)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2]).startsWith('y') || normalizeToken(match[2]).startsWith('t')
    },
    {
      pointer: '/context/regulatory/constraints/setbacksKnown',
      kind: 'site' as const,
      label: 'Setbacks known',
      fieldPath: specs['/context/regulatory/constraints/setbacksKnown']?.fieldPath ?? 'site.setbacksKnown',
      regex: /setbacks\s+known\s*:\s*(yes|no|true|false)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[1]).startsWith('y') || normalizeToken(match[1]).startsWith('t')
    },
    {
      pointer: '/context/equity/priority',
      kind: 'equity' as const,
      label: 'Priority zones',
      fieldPath: specs['/context/equity/priority']?.fieldPath ?? 'equity.priorityZones',
      regex: /(priority zone|equity priority)\s*:\s*([^\n]+)/i,
      parser: (match: RegExpExecArray) => normalizeToken(match[2])
    }
  ];
};

const buildKeyFindings = (derived: DerivedConstraints) => {
  const findings: string[] = [];
  if (derived.site.compactionRisk) {
    findings.push(`Soil compaction risk is ${derived.site.compactionRisk} → avoid shallow-rooting species.`);
  }
  if (derived.site.lightExposure) {
    findings.push(`Light exposure: ${derived.site.lightExposure} → filter out mismatched light requirements.`);
  }
  if (derived.regulatory.setting) {
    findings.push(`Regulatory setting: ${derived.regulatory.setting} → align shortlist with local controls.`);
  }
  if (derived.site.utilitiesPresent === true) {
    findings.push('Utilities present → prioritize small-stature, conflict-aware species.');
  }
  if (derived.equity.priorityZones) {
    findings.push(`Equity priority: ${derived.equity.priorityZones} → emphasize shade and cooling benefits.`);
  }
  if (findings.length < 3) {
    findings.push('Some constraints are still unverified → review documents to tighten inputs.');
  }
  return findings.slice(0, 5);
};

const buildSummary = (derived: DerivedConstraints, sources: EvidenceSource[], locationHint?: string) => {
  const derivedCount = Object.values(derived.meta.confidenceByField ?? {}).filter((value) => value >= 0.5).length;
  const sourceLabel = sources.length === 1 ? '1 source' : `${sources.length} sources`;
  const locationNote = locationHint ? ` near ${locationHint}` : '';
  return `Extracted ${derivedCount} constraints from ${sourceLabel}${locationNote}.`;
};

const hasAiKey = () => Boolean((import.meta as any)?.env?.VITE_GOOGLE_API_KEY);

export const runSiteRegulatoryAnalysis = async (args: {
  fileRefs: EvidenceFileRef[];
  locationHint?: string;
  projectId?: string;
}) => {
  const { fileRefs, locationHint } = args;
  const evidenceSources = buildEvidenceSources(fileRefs);
  const derived = buildDerivedConstraintsShell();
  const matches: FieldMatch[] = [];
  const evidenceItems: EvidenceItem[] = [];
  const evidenceByPointer: Record<string, string[]> = {};
  const fieldMatchers = buildFieldMatchers();

  fileRefs.forEach((doc, index) => {
    const content = extractText(doc);
    if (!content) return;
    const sourceId = evidenceSources[index]?.id ?? String(doc.id ?? doc.fileId ?? `doc-${index + 1}`);
    fieldMatchers.forEach((matcher) => {
      const found = matchValue(content, matcher.regex, matcher.parser);
      if (!found) return;
      matches.push({
        pointer: matcher.pointer,
        fieldPath: matcher.fieldPath,
        kind: matcher.kind,
        label: matcher.label,
        value: found.value,
        sourceId,
        page: found.page,
        confidence: 0.78
      });
    });
  });

  matches.forEach((match, index) => {
    setDerivedField(derived, match.fieldPath, match.value, match.confidence);
    const evidenceItem: EvidenceItem = {
      id: `evidence-${Date.now()}-${index}`,
      kind: match.kind,
      claim: `${match.label}: ${match.value}`,
      citations: [
        {
          sourceId: match.sourceId,
          locator: match.page ? { page: match.page } : undefined,
          confidence: match.confidence
        }
      ]
    };
    evidenceItems.push(evidenceItem);
    evidenceByPointer[match.pointer] = [...(evidenceByPointer[match.pointer] ?? []), evidenceItem.id];
  });

  if (hasAiKey() && fileRefs.some((doc) => doc.file)) {
    try {
      const skillResult = await executeSkillTemplate({
        templateId: 'site_regulatory_analysis',
        row: { rowLabel: locationHint || 'Strategic site analysis' },
        params: { locationHint: locationHint ?? '' },
        contextFiles: fileRefs.flatMap((doc) => (doc.file ? [doc.file] : [])),
        attachedFileNames: fileRefs.map((doc) => doc.title ?? doc.file?.name ?? 'document'),
        projectContext: locationHint
      });
      if (skillResult.ok && skillResult.rawText) {
        derived.meta.confidenceByField = derived.meta.confidenceByField ?? {};
        derived.meta.confidenceByField['analysis.aiUsed'] = 0.4;
      }
    } catch (error) {
      console.warn('site_regulatory_analysis_skill_failed', error);
    }
  }

  derived.meta.derivedFrom = evidenceItems;

  const timelineEntry: TimelineEntry = {
    id: `timeline-${Date.now()}`,
    stepId: 'site:strategic-site-regulatory-analysis',
    phase: 'site',
    title: 'Strategic site & regulatory analysis',
    summary: buildSummary(derived, evidenceSources, locationHint),
    keyFindings: buildKeyFindings(derived),
    evidence: evidenceItems,
    artifacts: [
      {
        id: 'artifact-constraints',
        kind: 'constraints',
        label: 'View constraints',
        href: '#planning-constraints'
      }
    ],
    status: evidenceItems.length > 0 ? 'done' : 'needs_input',
    createdAt: now()
  };

  return {
    derivedConstraints: derived,
    evidenceSources,
    evidenceItems,
    timelineEntry,
    evidenceByPointer
  };
};
