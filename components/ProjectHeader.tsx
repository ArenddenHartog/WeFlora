import React, { useMemo } from 'react';
import { ChevronRightIcon, FolderIcon, DatabaseIcon, SlidersIcon, SparklesIcon } from './icons';

type ProjectSection = 'overview' | 'worksheets' | 'reports' | 'team';

interface ProjectHeaderProps {
  projectName: string;
  activeTab?: ProjectSection;
  onBackToProjects: () => void;
  onNavigateTab: (tab: ProjectSection) => void;
  onOpenProjectFiles: () => void;
  onOpenProjectSettings: () => void;
  settingsOpen?: boolean;
  onQuickAsk: () => void;
  quickAskActive?: boolean;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  projectName,
  activeTab,
  onBackToProjects,
  onNavigateTab,
  onOpenProjectFiles,
  onOpenProjectSettings,
  settingsOpen,
  onQuickAsk,
  quickAskActive,
}) => {
  const tabs = useMemo(() => ['overview', 'worksheets', 'reports', 'team'] as const, []);
  const settingsLabel =
    activeTab === 'worksheets'
      ? 'Worksheet Settings'
      : activeTab === 'reports'
        ? 'Report Settings'
        : 'Project Settings';

  const askLabel =
    activeTab === 'worksheets'
      ? 'Worksheet Assistant'
      : activeTab === 'reports'
        ? 'Report Assistant'
        : 'Project Assistant';

  const settingsButtonLabel = settingsOpen ? settingsLabel : 'Settings';

  return (
    <header className="w-full bg-white border-b border-slate-200">
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        {/* Left cluster: back + project identity + tabs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
            title="Back to Projects"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal flex-shrink-0">
              <FolderIcon className="h-5 w-5" />
            </div>
            <span className="font-semibold text-slate-900 truncate">{projectName}</span>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <nav className="hidden sm:flex items-center gap-6">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => onNavigateTab(tab)}
                  className={`text-sm font-medium border-b-2 transition-colors pb-1 ${
                    active ? 'text-weflora-dark border-weflora-teal' : 'text-slate-600 border-transparent hover:text-weflora-dark'
                  }`}
                >
                  {titleCase(tab)}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right cluster: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenProjectFiles}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            title="Files"
          >
            <DatabaseIcon className="h-4 w-4 text-weflora-teal" />
            <span>Files</span>
          </button>
          <button
            onClick={onOpenProjectSettings}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all shadow-sm whitespace-nowrap
              ${settingsOpen 
                ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-dark'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }
            `}
            title={settingsButtonLabel}
          >
            <SlidersIcon className={`h-4 w-4 ${settingsOpen ? 'text-weflora-teal' : 'text-weflora-teal'}`} />
            <span>{settingsButtonLabel}</span>
          </button>
          <button
            onClick={onQuickAsk}
            aria-label={askLabel}
            className={`group flex items-center justify-center h-9 w-9 rounded-lg border transition-colors shadow-sm ${
              quickAskActive
                ? 'bg-weflora-success/10 border-weflora-success/20 text-slate-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title={askLabel}
          >
            <SparklesIcon
              className={`h-4 w-4 transition-colors ${
                quickAskActive ? 'text-weflora-success' : 'text-slate-500 group-hover:text-weflora-success'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProjectHeader;

