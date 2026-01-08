export type Severity = 'low' | 'medium' | 'high' | 'unknown';

export interface SeverityThresholds {
  low: number;
  high: number;
}

const DEFAULT_THRESHOLDS: SeverityThresholds = {
  low: 0.4,
  high: 0.7
};

const normalizeValue = (value: number, thresholds: SeverityThresholds) => {
  if (value > 1 && thresholds.high <= 1) {
    return value / 100;
  }
  return value;
};

export const getSeverity = (value?: number | null, thresholds: SeverityThresholds = DEFAULT_THRESHOLDS): Severity => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  const normalized = normalizeValue(value, thresholds);
  if (normalized <= thresholds.low) return 'low';
  if (normalized <= thresholds.high) return 'medium';
  return 'high';
};

export const getScoreBand = (value?: number | null, thresholds: SeverityThresholds = DEFAULT_THRESHOLDS): Severity =>
  getSeverity(value, thresholds);

export const getBadgeClass = (severity: Severity) => {
  switch (severity) {
    case 'low':
      return 'bg-rose-50 text-rose-700';
    case 'medium':
      return 'bg-amber-50 text-amber-700';
    case 'high':
      return 'bg-emerald-50 text-emerald-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
};
