import type { EvidenceItem, EvidenceRef, ExecutionLogEntry, Phase, TimelineEntry } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';

export type ReasoningTimelineItem = {
  id: string;
  stepId?: string;
  phase?: Phase;
  title: string;
  summary: string;
  keyFindings: string[];
  evidence?: EvidenceItem[];
  evidenceRefs?: EvidenceRef[];
  artifacts?: Array<{ label: string; href: string }>;
  details?: string[];
  status?: TimelineEntry['status'];
};

const LOG_RULES: Array<{ match: RegExp; title: string; summary: string; findings: string[] }> = [
  {
    match: /Execution state created/i,
    title: 'Initialized planning context',
    summary: 'Captured the baseline inputs and prepared the planning workspace.',
    findings: [
      'Captured baseline inputs for site, regulatory, equity, species, and supply context.',
      'Prepared the run workspace for live planning updates.',
      'Ready to begin site analysis and shortlist generation.'
    ]
  },
  {
    match: /Applied safe defaults/i,
    title: 'Applied recommended defaults',
    summary: 'Filled recommended inputs so the analysis can continue with clear baselines.',
    findings: [
      'Applied defaults for missing recommended inputs.',
      'Kept the planning run moving without blocking required fields.',
      'Documented assumptions for transparency in downstream steps.'
    ]
  },
  {
    match: /Agent patch application failed/i,
    title: 'Encountered an update issue',
    summary: 'One of the updates failed while recording outputs. Review inputs and retry.',
    findings: [
      'A step output failed to record correctly.',
      'Review the latest inputs to resolve the update issue.',
      'Re-run the impacted step once the issue is addressed.'
    ]
  },
  {
    match: /Agent not found/i,
    title: 'Analysis capability unavailable',
    summary: 'A required planning capability is missing for this step.',
    findings: [
      'A skill needed for this step is unavailable.',
      'Outputs for this phase are incomplete until the capability is restored.',
      'Review configuration or rerun when the capability is available.'
    ]
  }
];

const normalizeSummary = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/waiting for missing|required inputs/i.test(trimmed)) return '';
  if (/queued for execution/i.test(trimmed)) return '';
  if (/executing agents/i.test(trimmed)) return '';
  if (/completed with current inputs/i.test(trimmed)) return '';
  if (/agent completed/i.test(trimmed)) return '';
  return trimmed;
};

const formatOutcomeTitle = (title: string) => {
  const trimmed = title.trim();
  const lower = trimmed.toLowerCase();
  const conversions: Array<{ prefix: string; past: string }> = [
    { prefix: 'generate ', past: 'Generated ' },
    { prefix: 'derive ', past: 'Derived ' },
    { prefix: 'score ', past: 'Scored ' },
    { prefix: 'run ', past: 'Completed ' },
    { prefix: 'reconcile ', past: 'Reconciled ' },
    { prefix: 'match ', past: 'Matched ' },
    { prefix: 'rank ', past: 'Ranked ' },
    { prefix: 'summarize ', past: 'Summarized ' }
  ];
  const match = conversions.find(({ prefix }) => lower.startsWith(prefix));
  if (match) {
    return `${match.past}${trimmed.slice(match.prefix.length)}`;
  }
  return `Updated ${trimmed}`;
};

const collectLogDetails = (logs: ExecutionLogEntry[]) =>
  logs
    .map((entry) => entry.message)
    .filter(
      (message) =>
        !/step blocked/i.test(message) &&
        !/agent completed/i.test(message) &&
        !/execution state created/i.test(message)
    )
    .filter((message, index, arr) => arr.indexOf(message) === index)
    .slice(0, 4);

const buildArtifacts = (pointers: string[] = []) => {
  const mapping: Record<string, { label: string; href: string }> = {
    '/draftMatrix': { label: 'View draft matrix', href: '#draft-matrix' },
    '/context/site/constraints': { label: 'View site constraints', href: '#planning-constraints' },
    '/derivedConstraints': { label: 'View constraints', href: '#planning-constraints' },
    '/context/species/diversityCheck': { label: 'View diversity check', href: '#planning-inputs' },
    '/context/supply/availabilityStatus': { label: 'View supply status', href: '#planning-inputs' }
  };
  return pointers.map((pointer) => mapping[pointer]).filter(Boolean) as Array<{ label: string; href: string }>;
};

const buildFallbackFindings = (step: StepperStepViewModel): string[] => {
  const base = step.title.toLowerCase();
  if (step.producesPointers?.includes('/draftMatrix')) {
    return [
      `Updated the draft matrix during ${base}.`,
      'Connected site constraints to shortlist selection.',
      'Prepared outputs for the next planning phase.'
    ];
  }
  if (step.producesPointers?.includes('/context/site/constraints')) {
    return [
      'Summarized site conditions into usable constraints.',
      'Flagged risks that shape species viability.',
      'Documented constraints for downstream filtering.'
    ];
  }
  return [
    `Recorded new outcomes from ${base}.`,
    'Captured key constraints and signals for downstream work.',
    'Prepared the next planning step with updated context.'
  ];
};

export const buildReasoningTimelineItems = (
  steps: StepperStepViewModel[],
  logs: ExecutionLogEntry[],
  evidenceIndex?: Record<string, EvidenceRef[]>
): ReasoningTimelineItem[] => {
  const items: ReasoningTimelineItem[] = [];
  const globalLogs = logs.filter((entry) => !entry.data?.stepId);
  globalLogs.forEach((entry) => {
    const match = LOG_RULES.find((rule) => rule.match.test(entry.message));
    if (match) {
      items.push({
        id: `log-${entry.timestamp}`,
        title: match.title,
        summary: match.summary,
        keyFindings: match.findings
      });
    }
  });

  steps.forEach((step) => {
    const evidenceRefs = evidenceIndex?.[step.stepId] ?? [];
    const stepLogs = logs.filter((entry) => entry.data?.stepId === step.stepId);
    const details = collectLogDetails(stepLogs);
    const summaryFromStep = normalizeSummary(step.summary);
    const reasoning = step.reasoningSummary ?? [];
    const artifacts = buildArtifacts(step.producesPointers ?? []);
    const findings = reasoning.length > 0 ? reasoning.slice(0, 5) : details.slice(0, 5);
    const fallbackFindings = buildFallbackFindings(step);
    const resolvedFindings = findings.length > 0 ? findings : fallbackFindings;
    const summary =
      summaryFromStep ||
      (step.status === 'blocked'
        ? 'Awaiting required inputs to continue this analysis.'
        : `Captured the latest outcomes from ${step.title.toLowerCase()}.`);

    reasoning.forEach((item, index) => {
      items.push({
        id: `${step.stepId}-reason-${index}`,
        stepId: step.stepId,
        phase: step.phase,
        title: item,
        summary,
        keyFindings: resolvedFindings,
        evidenceRefs,
        artifacts,
        details
      });
    });

    if (reasoning.length === 0 && (step.status === 'done' || step.status === 'running' || step.status === 'blocked')) {
      items.push({
        id: `${step.stepId}-outcome`,
        stepId: step.stepId,
        phase: step.phase,
        title: step.status === 'done' ? formatOutcomeTitle(step.title) : step.title,
        summary,
        keyFindings: resolvedFindings,
        evidenceRefs,
        artifacts,
        details
      });
    }
  });

  return items;
};

export const mergeTimelineEntries = (
  timelineEntries: TimelineEntry[] | undefined,
  fallbackItems: ReasoningTimelineItem[]
): ReasoningTimelineItem[] => {
  if (!timelineEntries || timelineEntries.length === 0) {
    return fallbackItems;
  }

  const mapped = timelineEntries.map((entry) => ({
    id: entry.id,
    stepId: entry.stepId,
    phase: entry.phase,
    title: entry.title ?? entry.summary,
    summary: entry.summary,
    keyFindings: entry.keyFindings,
    evidence: entry.evidence,
    artifacts: entry.artifacts,
    status: entry.status
  }));

  return [...mapped, ...fallbackItems.filter((item) => !item.stepId)];
};
