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
  onQuickAsk,
  quickAskActive,
}) => {
  const tabs = useMemo(() => ['overview', 'worksheets', 'reports', 'team'] as const, []);

  return (
    <header className="w-full bg-white border-b border-slate-200">
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        {/* Left cluster: back + project identity + tabs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-1 text-slate-500 hover:text-weflora-dark transition-colors"
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            title="Project Files"
          >
            <DatabaseIcon className="h-4 w-4 text-weflora-teal" />
            <span>Project Files</span>
          </button>
          <button
            onClick={onOpenProjectSettings}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            title="Project Settings"
          >
            <SlidersIcon className="h-4 w-4 text-weflora-teal" />
            <span>Project Settings</span>
          </button>
          <button
            onClick={onQuickAsk}
            aria-label="Ask FloraGPT"
            className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors border ${
              quickAskActive
                ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal'
                : 'bg-white border-slate-200 text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10'
            }`}
            title="Ask FloraGPT"
          >
            <SparklesIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProjectHeader;

