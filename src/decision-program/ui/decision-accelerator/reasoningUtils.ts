import type { EvidenceRef, ExecutionLogEntry } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';

export type ReasoningTimelineItem = {
  id: string;
  title: string;
  summary: string;
  evidence?: EvidenceRef[];
  details?: string[];
};

const LOG_RULES: Array<{ match: RegExp; title: string; summary: string }> = [
  {
    match: /Execution state created/i,
    title: 'Initialized planning context',
    summary: 'Captured the baseline inputs and prepared the planning workspace.'
  },
  {
    match: /Applied safe defaults/i,
    title: 'Applied recommended defaults',
    summary: 'Filled recommended inputs so the analysis can continue with clear baselines.'
  },
  {
    match: /Agent patch application failed/i,
    title: 'Encountered an update issue',
    summary: 'One of the updates failed while recording outputs. Review inputs and retry.'
  },
  {
    match: /Agent not found/i,
    title: 'Analysis capability unavailable',
    summary: 'A required planning capability is missing for this step.'
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
        summary: match.summary
      });
    }
  });

  steps.forEach((step) => {
    const evidence = evidenceIndex?.[step.stepId] ?? [];
    const stepLogs = logs.filter((entry) => entry.data?.stepId === step.stepId);
    const details = collectLogDetails(stepLogs);
    const summaryFromStep = normalizeSummary(step.summary);
    const reasoning = step.reasoningSummary ?? [];

    reasoning.forEach((item, index) => {
      items.push({
        id: `${step.stepId}-reason-${index}`,
        title: item,
        summary: summaryFromStep || 'Documented the evidence and constraints that informed this finding.',
        evidence,
        details
      });
    });

    if (reasoning.length === 0 && step.status === 'done') {
      items.push({
        id: `${step.stepId}-outcome`,
        title: formatOutcomeTitle(step.title),
        summary: summaryFromStep || 'Synthesized inputs into an actionable planning outcome.',
        evidence,
        details
      });
    }
  });

  return items;
};
