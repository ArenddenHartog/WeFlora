import React from 'react';

interface AppPageProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

const AppPage: React.FC<AppPageProps> = ({ title, subtitle, actions, toolbar, children }) => {
  return (
    <div className="bg-white px-8 py-6" data-layout-root>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 truncate">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      {toolbar ? <div className="mt-6">{toolbar}</div> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
};

export default AppPage;
