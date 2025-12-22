import React, { useMemo } from 'react';
import { ChevronRightIcon } from './icons';

type ProjectSection = 'overview' | 'worksheets' | 'reports' | 'team';

interface ProjectHeaderProps {
  projectName: string;
  activeTab?: ProjectSection;
  onBackToProjects: () => void;
  onNavigateTab: (tab: ProjectSection) => void;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  projectName,
  activeTab,
  onBackToProjects,
  onNavigateTab,
}) => {
  const tabs = useMemo(() => ['overview', 'worksheets', 'reports', 'team'] as const, []);

  return (
    <header className="flex-none border-b border-slate-200 bg-white">
      <div className="relative h-14 px-4 flex items-center">
        {/* Left: back + project name */}
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

        {/* Center: tabs (navigation only) */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-end gap-6 h-full">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => onNavigateTab(tab)}
                className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                  active ? 'text-weflora-dark border-weflora-teal' : 'text-slate-600 border-transparent hover:text-weflora-dark'
                }`}
              >
                {titleCase(tab)}
              </button>
            );
          })}
        </nav>

        {/* Right: intentionally empty */}
        <div className="ml-auto w-10" />
      </div>
    </header>
  );
};

export default ProjectHeader;

