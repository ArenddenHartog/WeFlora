import type { ExecutionLogEntry } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';

const MESSAGE_CALLOUTS: Array<{ match: RegExp; callout: string }> = [
  { match: /blocked/i, callout: 'Blocked on missing inputs' },
  { match: /route/i, callout: 'Routed output to next step' },
  { match: /patch application failed/i, callout: 'Patch failed on a required pointer' },
  { match: /Applied safe defaults/i, callout: 'Applied safe defaults' },
  { match: /Execution state created/i, callout: 'Initialized planning run' },
  { match: /Agent not found/i, callout: 'Agent unavailable for this step' },
  { match: /completed/i, callout: 'Step completed' }
];

export const deriveReasoningCallouts = (
  step: StepperStepViewModel,
  logs: ExecutionLogEntry[]
): string[] => {
  const callouts: string[] = [];
  const reasoning = step.reasoningSummary ?? [];
  reasoning.forEach((item) => {
    if (!callouts.includes(item)) {
      callouts.push(item);
    }
  });
  const stepLogs = logs.filter((entry) => entry.data?.stepId === step.stepId);
  stepLogs.forEach((entry) => {
    const match = MESSAGE_CALLOUTS.find((rule) => rule.match.test(entry.message));
    if (match && !callouts.includes(match.callout)) {
      callouts.push(match.callout);
    }
  });
  if (callouts.length === 0 && step.summary) {
    callouts.push(step.summary);
  }
  return callouts.slice(0, 3);
};

export const deriveRationaleDetails = (
  step: StepperStepViewModel,
  logs: ExecutionLogEntry[]
): string[] => {
  const details: string[] = [];
  const stepLogs = logs.filter((entry) => entry.data?.stepId === step.stepId);
  stepLogs.forEach((entry) => {
    if (!details.includes(entry.message)) {
      details.push(entry.message);
    }
  });
  if (step.summary && !details.includes(step.summary)) {
    details.unshift(step.summary);
  }
  return details.slice(0, 4);
};
