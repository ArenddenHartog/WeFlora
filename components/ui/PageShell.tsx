import React from 'react';
import {
  pageBg,
  pagePadding,
  pageMax,
  h1,
  muted,
  iconWrap,
} from '../../src/ui/tokens';

interface PageShellProps {
  /** Icon node rendered inside the canonical iconWrap */
  icon?: React.ReactNode;
  /** Page title (h1) */
  title: string;
  /** Optional meta / subtitle beneath the title — prefer actionable text, NOT generic descriptions */
  meta?: React.ReactNode;
  /** Right-aligned primary actions group */
  actions?: React.ReactNode;
  /** Below-header row: tabs, search, filters */
  tabs?: React.ReactNode;
  /** Page body */
  children: React.ReactNode;
}

/**
 * PageShell — canonical layout wrapper (mirrors Worksheets header).
 *
 * Rules:
 * - Always pageBg, pagePadding, pageMax
 * - No min-h-screen (parent layout handles height)
 * - No internal scroll — parent AppLayout owns the scroll context
 * - Icon uses iconWrap (teal icon, mint bg with border)
 */
const PageShell: React.FC<PageShellProps> = ({
  icon,
  title,
  meta,
  actions,
  tabs,
  children,
}) => {
  return (
    <div className={`w-full ${pageBg}`} data-layout-root>
      <div className={pageMax}>
        {/* ── Header ───────────────────────────────────── */}
        <header className={`sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 ${pageBg} px-4 py-4 md:px-8`}>
          <div className="flex items-center gap-3 min-w-0">
            {icon ? (
              <div className={iconWrap}>{icon}</div>
            ) : null}
            <div className="min-w-0">
              <h1 className={h1}>{title}</h1>
              {meta ? <div className={`mt-1 ${muted}`}>{meta}</div> : null}
            </div>
          </div>
          {actions ? (
            <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
          ) : null}
        </header>

        {/* ── Tabs / Search row ────────────────────────── */}
        {tabs ? (
          <div className="border-b border-slate-200 px-4 py-2 md:px-8">{tabs}</div>
        ) : null}

        {/* ── Body ─────────────────────────────────────── */}
        <div className={pagePadding}>{children}</div>
      </div>
    </div>
  );
};

export default PageShell;
