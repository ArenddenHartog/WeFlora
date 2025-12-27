import React from 'react';
import { DatabaseIcon, SlidersIcon, SparklesIcon } from './icons';

type ProjectActionsTab = 'overview' | 'worksheets' | 'reports' | 'team' | 'files';

type Props = {
  activeTab: ProjectActionsTab;
  onOpenProjectFiles: () => void;
  onOpenSettings: () => void;
  settingsLabel: string;
  canOpenSettings?: boolean;
  onToggleAssistant?: () => void; // icon-only
  assistantActive?: boolean;
  showAssistant?: boolean;
};

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors shadow-sm ${
      disabled
        ? 'bg-white border-slate-200 text-slate-300 cursor-not-allowed'
        : active
          ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-dark'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <Icon className={`h-4 w-4 ${disabled ? 'text-slate-300' : 'text-weflora-teal'}`} />
    <span>{label}</span>
  </button>
);

const IconOnlyButton = ({
  icon: Icon,
  onClick,
  active,
  title,
}: {
  icon: any;
  onClick: () => void;
  active?: boolean;
  title: string;
}) => (
  <button
    onClick={onClick}
    className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors border ${
      active
        ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal'
        : 'bg-white border-slate-200 text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10'
    }`}
    title={title}
  >
    <Icon className="h-4 w-4" />
  </button>
);

const ProjectActionsBar: React.FC<Props> = ({
  activeTab,
  onOpenProjectFiles,
  onOpenSettings,
  settingsLabel,
  canOpenSettings = true,
  onToggleAssistant,
  assistantActive,
  showAssistant,
}) => {
  const showFiles = activeTab === 'overview' || activeTab === 'worksheets' || activeTab === 'reports' || activeTab === 'team' || activeTab === 'files';
  const showSettings = activeTab === 'overview' || activeTab === 'worksheets' || activeTab === 'reports';

  return (
    <div className="flex-none h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {showFiles && (
          <ActionButton
            icon={DatabaseIcon}
            label="Project Files"
            onClick={onOpenProjectFiles}
            active={activeTab === 'files'}
          />
        )}
        {showSettings && (
          <ActionButton
            icon={SlidersIcon}
            label={settingsLabel}
            onClick={onOpenSettings}
            disabled={!canOpenSettings}
          />
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {showAssistant && onToggleAssistant && (
          <IconOnlyButton
            icon={SparklesIcon}
            onClick={onToggleAssistant}
            active={assistantActive}
            title="Assistant"
          />
        )}
      </div>
    </div>
  );
};

export default ProjectActionsBar;

