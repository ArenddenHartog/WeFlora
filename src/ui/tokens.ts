/**
 * WeFlora Design Tokens — Single Source of Truth
 *
 * All target pages (Vault, Review, Skills, Flows, Sessions) MUST import
 * classes from here instead of hard-coding Tailwind strings.
 *
 * Design philosophy:
 * - Clean minimalism (ChatGPT-like: light dividers, no heavy card borders)
 * - IDE-like layout patterns (Phylo/Benchling: Plan/Results in a right rail)
 * - Supabase design system baseline (layout clarity, accessibility)
 * - WeFlora accent coloring preserved (teal/mint)
 *
 * Single scroll container rule: ONLY PDF preview may have nested scroll.
 */

/* ─── Page Layout ─────────────────────────────────────── */
export const pageBg = 'bg-white';
export const pagePadding = 'p-4 md:p-8';
export const pageMax = 'max-w-[1400px] mx-auto';

/* ─── Typography ──────────────────────────────────────── */
export const h1 = 'text-2xl font-bold text-slate-800';
export const h2 = 'text-lg font-bold text-slate-800';
export const h3 = 'text-sm font-semibold text-slate-800';
export const muted = 'text-sm text-slate-500';
export const body = 'text-sm text-slate-700';
export const label = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wide';

/* ─── Dividers & Separators (clean minimalism) ────────── */
/** Use instead of heavy card borders. Very light line. */
export const divider = 'border-b border-slate-100';
/** Slightly more visible divider (section boundaries). */
export const dividerMedium = 'border-b border-slate-200';
/** Vertical divider for side-by-side layouts. */
export const dividerVertical = 'border-l border-slate-100';

/* ─── Surfaces (replace heavy card borders) ───────────── */
/**
 * Primary surface: subtle background, no thick border.
 * Use for sections, panels, modules.
 */
export const surface = 'bg-white rounded-xl';
/** Surface with very light border (when distinction needed). */
export const surfaceBordered = 'bg-white rounded-xl border border-slate-100';
/** Hub tile: subtle border for Skills/Flows index. Keep lining very subtle. */
export const hubTile = 'bg-white rounded-xl border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
/** Inset surface: slightly recessed (for nested content). */
export const surfaceInset = 'bg-slate-50/50 rounded-lg';
/** Elevated surface: shadow instead of border (for modals, popovers). */
export const surfaceElevated = 'bg-white rounded-xl shadow-sm';

/* ─── Chips & Badges ──────────────────────────────────── */
export const chip = 'text-xs font-semibold rounded-full px-2 py-0.5 border border-slate-100';
export const chipActive = 'text-xs font-semibold rounded-full px-2 py-0.5 bg-weflora-mint/20 text-weflora-dark border border-weflora-mint/30';

/* ─── Buttons ─────────────────────────────────────────── */
export const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-weflora-teal px-4 py-2 text-xs font-semibold text-white hover:bg-weflora-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const btnGhost =
  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const btnDanger =
  'inline-flex items-center gap-2 rounded-lg bg-weflora-rose px-4 py-2 text-xs font-semibold text-white hover:bg-weflora-rose/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
/** Small link-style action button (for "Fix it" CTAs). */
export const btnLink =
  'inline-flex items-center gap-1 text-xs font-semibold text-weflora-teal hover:text-weflora-dark hover:underline';

/* ─── Icon Wrap (canonical header icon) ───────────────── */
export const iconWrap =
  'h-10 w-10 rounded-xl flex items-center justify-center bg-weflora-mint/10 text-weflora-teal';

/* ─── Section Card Guidance ───────────────────────────── */
/**
 * sectionCardForbidden: Do NOT introduce card grids everywhere.
 * Use table-like lists and structured sections.
 * Cards are allowed ONLY for hub tiles (Skills Hub, Flows Hub),
 * not for ledger/events.
 */
export const sectionCardForbidden =
  'Do not use card grids for lists or events. Use table-like rows.';

/* ─── Table / List rows ───────────────────────────────── */
export const tableHeaderRow =
  'border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wide';
export const tableRow =
  'border-b border-slate-50 text-sm text-slate-700 hover:bg-slate-50/50 transition-colors';
export const tableRowSelected =
  'bg-weflora-mint/5 border-l-2 border-weflora-teal';

/* ─── Preview area (ONLY allowed nested scroll) ───────── */
export const previewArea =
  'min-h-[320px] max-h-[60vh] overflow-auto rounded-lg border border-slate-100 bg-slate-50/50';

/* ─── Status badge helper (muted palette, WeFlora-aligned) ── */
export const statusReady = 'bg-weflora-emeraldLight text-weflora-emerald border border-weflora-teal/20';
export const statusWarning = 'bg-weflora-amberLight text-weflora-amberDark border border-weflora-amber/30';
export const statusError = 'bg-weflora-redLight text-weflora-redDark border border-weflora-red/30';
export const statusNeutral = 'bg-slate-50 text-slate-600 border border-slate-100';

/* ─── Relevance (decision signal) ─────────────────────── */
export const relevanceHigh = 'bg-weflora-mint/10 text-weflora-dark border border-weflora-mint/20';
export const relevanceMedium = 'bg-weflora-amberLight text-weflora-amberDark border border-weflora-amber/30';
export const relevanceLow = 'bg-slate-50 text-slate-500 border border-slate-100';

/* ─── Flow / Stepper (vertical timeline) ────────────────── */
/** Vertical timeline connector line. */
export const flowLine = 'border-l-2 border-weflora-teal/60';
/** Completed step: muted, with teal accent. */
export const flowStepDone = 'bg-slate-50/80 rounded-lg border border-weflora-teal/10';
/** Active step: primary surface with teal background. */
export const flowStepActive = 'bg-weflora-teal text-white rounded-lg';
/** Blocked step: amber accent. */
export const flowStepBlocked = 'bg-weflora-amberLight border border-weflora-amber/30';

/* ─── Consensus / Evidence strength bars ──────────────── */
/** Strong evidence segment (e.g. Consensus Meter, Key Claims). */
export const consensusBarStrong = 'bg-weflora-teal';
/** Moderate evidence segment. */
export const consensusBarMedium = 'bg-weflora-amber';
/** Weak / mixed evidence segment. */
export const consensusBarWeak = 'bg-slate-300';

/* ─── Memory signals (Vault as cognitive memory) ──────── */
export const memorySignalLabel = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide';
export const memorySignalValue = 'text-sm font-semibold text-slate-800';

/* ─── Agent suggestion ────────────────────────────────── */
export const agentSuggestionBox =
  'rounded-xl border border-dashed border-weflora-mint/40 bg-weflora-mint/5 p-4';
export const agentSuggestionLabel =
  'text-xs font-semibold text-weflora-teal';

/* ─── Cognitive loop badge ────────────────────────────── */
export const cognitiveLoopBadge =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border';
export const loopMemory = 'bg-weflora-violetLight text-weflora-violetDark border-weflora-violet/20';
export const loopUnderstand = 'bg-weflora-amberLight text-weflora-amberDark border-weflora-amber/30';
export const loopReason = 'bg-weflora-violetLight text-weflora-violetDark border-weflora-violet/20';
export const loopAct = 'bg-weflora-emeraldLight text-weflora-emerald border-weflora-emerald/20';
export const loopLearn = 'bg-weflora-mint/10 text-weflora-dark border-weflora-mint/20';

/* ─── IDE-like evidence rail ──────────────────────────── */
/** Right rail container (desktop: sticky sidebar, mobile: collapsible). */
export const evidenceRail = 'space-y-4 lg:sticky lg:top-4 lg:self-start';
/** Rail section: clean surface with subtle top border. */
export const railSection = 'pt-4 first:pt-0';
/** Rail section header. */
export const railSectionHeader = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2';

/* ─── Readiness panel (unified for Flows + Skills) ────── */
export const readinessPanel = 'rounded-lg bg-slate-50/50 p-3';
export const readinessPassed = 'rounded-lg bg-weflora-emeraldLight/50 p-3';
export const readinessBlocked = 'rounded-lg bg-weflora-redLight/50 p-3';
export const readinessWarning = 'rounded-lg bg-weflora-amberLight/50 p-3';

/* ─── Confidence display guard ────────────────────────── */
/**
 * Safe confidence formatting. NEVER display NaN/undefined.
 * Returns the formatted string and whether it's a real value.
 */
export function formatConfidence(
  value: number | null | undefined,
): { display: string; isReal: boolean } {
  if (value == null || !Number.isFinite(value)) {
    return { display: '—', isReal: false };
  }
  return { display: value.toFixed(2), isReal: true };
}
