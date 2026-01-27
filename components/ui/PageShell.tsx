import React from 'react';

interface PageShellProps {
  icon?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  children: React.ReactNode;
}

const PageShell: React.FC<PageShellProps> = ({ icon, title, meta, actions, tabs, children }) => {
  return (
    <div className="w-full bg-white" data-layout-root>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          {icon ? <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-weflora-mint/20 text-weflora-teal">{icon}</div> : null}
          <div>
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {tabs ? <div className="border-b border-slate-200 px-4 py-2">{tabs}</div> : null}
      <div className="px-4 py-6">{children}</div>
    </div>
  );
};

export default PageShell;
