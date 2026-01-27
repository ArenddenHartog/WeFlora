import React from 'react';
import { agentProfilesContract } from '../../../src/agentic/registry/agents';
import { flowTemplates } from '../../../src/agentic/registry/flows';

interface StepSelectSkillsProps {
  selectedSkillIds: string[];
  selectedFlowId: string | null;
  showFlows: boolean;
  onToggleSkill: (skillId: string) => void;
  onFlowToggle: (value: boolean) => void;
  onFlowSelect: (flowId: string) => void;
}

const StepSelectSkills: React.FC<StepSelectSkillsProps> = ({
  selectedSkillIds,
  selectedFlowId,
  showFlows,
  onToggleSkill,
  onFlowToggle,
  onFlowSelect
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Choose skills</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Select one or more skills to run.</p>
      </div>

      <div className="space-y-3">
        {agentProfilesContract.map((profile) => (
          <label key={profile.id} className="flex items-start justify-between gap-4 border-b border-slate-200 py-4">
            <div>
              <p className="text-base font-semibold text-slate-900">{profile.title}</p>
              <p className="mt-1 text-sm text-slate-600">{profile.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <input
              type="checkbox"
              checked={selectedSkillIds.includes(profile.id)}
              onChange={() => onToggleSkill(profile.id)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-weflora-teal focus:ring-weflora-teal"
            />
          </label>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={() => onFlowToggle(!showFlows)}
          className="text-xs font-semibold text-weflora-teal hover:text-weflora-dark"
        >
          Prefer a pre-engineered Flow?
        </button>

        {showFlows ? (
          <div className="mt-4 space-y-3">
            {flowTemplates.map((flow) => (
              <label key={flow.id} className="flex items-start justify-between gap-4 border-b border-slate-200 py-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">{flow.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{flow.description}</p>
                </div>
                <input
                  type="radio"
                  name="flow-picker"
                  checked={selectedFlowId === flow.id}
                  onChange={() => onFlowSelect(flow.id)}
                  className="mt-1 h-4 w-4 text-weflora-teal"
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StepSelectSkills;
