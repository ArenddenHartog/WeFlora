import React, { useMemo } from 'react';
import { ChevronRightIcon, DatabaseIcon, SlidersIcon, SparklesIcon } from './icons';

type ProjectSection = 'overview' | 'worksheets' | 'reports' | 'team' | 'files';

interface ProjectHeaderProps {
  projectName: string;
  activeTab: 'overview' | 'worksheets' | 'reports' | 'team' | 'files';
  onBackToProjects: () => void;
  onNavigateTab: (tab: ProjectSection) => void;
  onToggleSettings: () => void;
  onToggleAsk: () => void;
  canShowSettings: boolean;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  projectName,
  activeTab,
  onBackToProjects,
  onNavigateTab,
  onToggleSettings,
  onToggleAsk,
  canShowSettings,
}) => {
  const tabs = useMemo(() => ['overview', 'worksheets', 'reports', 'team'] as const, []);

  return (
    <header className="flex-none border-b border-slate-200 bg-white">
      <div className="px-4 h-12 flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-2 text-sm text-slate-600">
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-1 text-slate-500 hover:text-weflora-dark transition-colors"
            title="Back to Projects"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Projects</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 truncate">{projectName}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigateTab('files')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
              activeTab === 'files'
                ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-dark'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <DatabaseIcon className="h-4 w-4 text-weflora-teal" />
              Project Files
            </span>
          </button>
          <button
            onClick={onToggleSettings}
            disabled={!canShowSettings}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
              canShowSettings
                ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark'
                : 'bg-white border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
            }`}
            title={canShowSettings ? 'Project Settings' : 'Settings available in Worksheets/Reports'}
          >
            <span className="inline-flex items-center gap-2">
              <SlidersIcon className="h-4 w-4 text-weflora-teal" />
              Project Settings
            </span>
          </button>
          <button
            onClick={onToggleAsk}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <SparklesIcon className="h-4 w-4" />
              Ask FloraGPT
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 h-10 flex items-end gap-6">
        {tabs.map((tab) => {
          const active = activeTab === tab || (activeTab === 'files' && tab === 'overview');
          return (
            <button
              key={tab}
              onClick={() => onNavigateTab(tab)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                active ? 'text-weflora-dark border-weflora-teal' : 'text-slate-600 border-transparent hover:text-weflora-dark'
              }`}
            >
              {titleCase(tab)}
            </button>
          );
        })}
      </div>
    </header>
  );
};

export default ProjectHeader;

