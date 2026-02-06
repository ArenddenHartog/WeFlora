import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon, SearchIcon } from '../icons';
import PageShell from '../ui/PageShell';
import { flowTemplates } from '../../src/agentic/registry/flows.ts';
import { btnPrimary, btnSecondary, iconWrap, chip } from '../../src/ui/tokens';

const FlowsIndex: React.FC = () => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return flowTemplates;
    return flowTemplates.filter((flow) =>
      [flow.title, flow.description, ...flow.tags].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [search]);

  return (
    <PageShell
      icon={<SparklesIcon className="h-5 w-5" />}
      title="Flows"
      actions={
        <>
          <Link to="/sessions/new" className={btnPrimary}>
            Run Flow
          </Link>
          <Link to="/skills" className={btnSecondary}>
            View Skills
          </Link>
        </>
      }
    >
      <div className="max-w-md relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or tag…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <SparklesIcon className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-sm font-semibold text-slate-700">No flows match your search</p>
          <p className="mt-1 text-xs text-slate-500">Try a different search term.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((flow) => (
            <div
              key={flow.id}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className={iconWrap}>
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-500">v{flow.template_version}</span>
              </div>
              <Link to={`/flows/${flow.id}`} className="mt-4 block">
                <h3 className="text-lg font-bold text-slate-800">{flow.title}</h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{flow.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {flow.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className={`${chip} border-slate-200 text-slate-500`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
              <div className="mt-auto pt-4">
                <Link to={`/sessions/new?intent=flow:${flow.id}`} className={btnSecondary}>
                  Run
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default FlowsIndex;
