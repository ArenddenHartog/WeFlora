/**
 * Canonical Status Taxonomy for WeFlora
 * 
 * All entities that move through human or system validation MUST use this status model.
 * This is the single source of truth for status definitions.
 */

/**
 * Canonical status values
 */
export const VAULT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  NEEDS_REVIEW: 'needs_review',
  IN_REVIEW: 'in_review',
  ACCEPTED: 'accepted',
  BLOCKED: 'blocked',
} as const;

export type VaultStatus = typeof VAULT_STATUS[keyof typeof VAULT_STATUS];

/**
 * Status metadata for UI rendering
 */
export interface StatusMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: '✏️' | '⏳' | '⚠️' | '👤' | '✅' | '⛔';
  description: string;
  editable: boolean;
  terminal: boolean;
}

export const STATUS_META: Record<VaultStatus, StatusMeta> = {
  draft: {
    label: 'Draft',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: '✏️',
    description: 'Incomplete, user-created, not yet eligible for review or execution',
    editable: true,
    terminal: false,
  },
  pending: {
    label: 'Pending',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '⏳',
    description: 'System-created, awaiting automated or manual triage',
    editable: false,
    terminal: false,
  },
  needs_review: {
    label: 'Needs Review',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: '⚠️',
    description: 'Requires human validation or enrichment',
    editable: true,
    terminal: false,
  },
  in_review: {
    label: 'In Review',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    icon: '👤',
    description: 'Actively claimed by a reviewer',
    editable: true,
    terminal: false,
  },
  accepted: {
    label: 'Accepted',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: '✅',
    description: 'Validated and approved; eligible for Skills / Flows',
    editable: false,
    terminal: true,
  },
  blocked: {
    label: 'Blocked',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    icon: '⛔',
    description: 'Explicitly rejected or unusable',
    editable: false,
    terminal: true,
  },
};

/**
 * Allowed status transitions
 */
export const ALLOWED_TRANSITIONS: Record<VaultStatus, VaultStatus[]> = {
  draft: ['pending', 'needs_review'],
  pending: ['needs_review', 'blocked'],
  needs_review: ['in_review', 'accepted', 'blocked'],
  in_review: ['accepted', 'needs_review', 'blocked'],
  accepted: [], // immutable
  blocked: ['draft'], // explicit "revive" action only
};

/**
 * Check if a status transition is allowed
 */
export function canTransition(from: VaultStatus, to: VaultStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get possible next statuses from current status
 */
export function getNextStatuses(current: VaultStatus): VaultStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

/**
 * View inclusion matrix - which statuses are visible in which views
 */
export const VIEW_STATUSES = {
  vault_inventory: ['draft', 'pending', 'needs_review', 'in_review', 'accepted', 'blocked'] as VaultStatus[],
  review_queue: ['pending', 'needs_review'] as VaultStatus[],
  active_review: ['in_review'] as VaultStatus[],
  skills_inputs: ['accepted'] as VaultStatus[],
  flows_inputs: ['accepted'] as VaultStatus[],
  sessions: ['draft', 'pending', 'needs_review', 'in_review', 'accepted', 'blocked'] as VaultStatus[], // all, read-only
};

/**
 * Check if a status is visible in a given view
 */
export function isStatusVisibleInView(status: VaultStatus, view: keyof typeof VIEW_STATUSES): boolean {
  return VIEW_STATUSES[view]?.includes(status) ?? false;
}

/**
 * Map legacy review states to canonical status
 */
export function mapLegacyReviewState(legacyState: string): VaultStatus {
  switch (legacyState) {
    case 'Auto-accepted':
      return 'accepted';
    case 'Needs review':
      return 'needs_review';
    case 'Blocked':
      return 'blocked';
    case 'Draft':
      return 'draft';
    default:
      return 'pending';
  }
}

/**
 * Map canonical status to legacy review state for backward compatibility
 */
export function mapToLegacyReviewState(status: VaultStatus): string {
  switch (status) {
    case 'accepted':
      return 'Auto-accepted';
    case 'needs_review':
    case 'pending':
      return 'Needs review';
    case 'blocked':
      return 'Blocked';
    case 'draft':
      return 'Draft';
    case 'in_review':
      return 'Needs review'; // Show as needs review in legacy views
    default:
      return 'Needs review';
  }
}

/**
 * Get status badge class names
 */
export function getStatusBadgeClasses(status: VaultStatus): string {
  const meta = STATUS_META[status];
  return `${meta.bgColor} ${meta.color} ${meta.borderColor} border`;
}
