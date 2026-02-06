/**
 * WeFlora Design Tokens — Single Source of Truth
 *
 * All target pages (Vault, Review, Skills, Flows, Sessions) MUST import
 * classes from here instead of hard-coding Tailwind strings.
 *
 * The tokens mirror the Worksheets layout as the canonical reference.
 */

/* ─── Page Layout ─────────────────────────────────────── */
export const pageBg = 'bg-white';
export const pagePadding = 'p-4 md:p-8';
export const pageMax = 'max-w-[1400px] mx-auto';

/* ─── Typography ──────────────────────────────────────── */
export const h1 = 'text-2xl font-bold text-slate-800';
export const h2 = 'text-lg font-bold text-slate-800';
export const muted = 'text-sm text-slate-500';
export const body = 'text-sm text-slate-700';

/* ─── Chips & Badges ──────────────────────────────────── */
export const chip = 'text-xs font-semibold rounded-full px-2 py-1 border';

/* ─── Buttons ─────────────────────────────────────────── */
export const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-weflora-teal px-4 py-2 text-xs font-semibold text-white hover:bg-weflora-dark disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
export const btnDanger =
  'inline-flex items-center gap-2 rounded-lg bg-weflora-red px-4 py-2 text-xs font-semibold text-white hover:bg-weflora-red/90 disabled:opacity-50 disabled:cursor-not-allowed';

/* ─── Icon Wrap (canonical header icon) ───────────────── */
export const iconWrap =
  'h-10 w-10 rounded-xl flex items-center justify-center bg-weflora-mint/10 border border-weflora-mint text-weflora-teal';

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
  'border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wide';
export const tableRow =
  'border-b border-slate-100 text-sm text-slate-700 hover:bg-slate-50 transition-colors';
export const tableRowSelected =
  'bg-weflora-mint/10 border-l-2 border-weflora-teal';

/* ─── Preview area (ONLY allowed nested scroll) ───────── */
export const previewArea =
  'min-h-[320px] max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50';

/* ─── Status badge helper ─────────────────────────────── */
export const statusReady = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
export const statusWarning = 'bg-amber-50 text-amber-700 border border-amber-200';
export const statusError = 'bg-rose-50 text-rose-700 border border-rose-200';
export const statusNeutral = 'bg-slate-50 text-slate-600 border border-slate-200';

/* ─── Relevance (decision signal) ─────────────────────── */
export const relevanceHigh = 'bg-weflora-mint/20 text-weflora-dark border border-weflora-mint';
export const relevanceMedium = 'bg-amber-50 text-amber-700 border border-amber-200';
export const relevanceLow = 'bg-slate-50 text-slate-500 border border-slate-200';

/* ─── Memory signals (Vault as cognitive memory) ──────── */
export const memorySignalLabel = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide';
export const memorySignalValue = 'text-sm font-semibold text-slate-800';

/* ─── Agent suggestion (future-ready) ─────────────────── */
export const agentSuggestionBox =
  'rounded-xl border border-dashed border-weflora-mint bg-weflora-mint/5 p-4';
export const agentSuggestionLabel =
  'text-xs font-semibold text-weflora-teal';

/* ─── Cognitive loop badge ────────────────────────────── */
export const cognitiveLoopBadge =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border';
export const loopMemory = 'bg-blue-50 text-blue-700 border-blue-200';
export const loopUnderstand = 'bg-amber-50 text-amber-700 border-amber-200';
export const loopReason = 'bg-violet-50 text-violet-700 border-violet-200';
export const loopAct = 'bg-emerald-50 text-emerald-700 border-emerald-200';
export const loopLearn = 'bg-weflora-mint/20 text-weflora-dark border-weflora-mint';
