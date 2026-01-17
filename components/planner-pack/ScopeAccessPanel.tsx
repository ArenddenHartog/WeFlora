import React from 'react';
import type { PcivScopeMemberV1 } from '../../src/decision-program/pciv/v1/schemas';

interface ScopeAccessPanelProps {
  scopeId: string;
  members: PcivScopeMemberV1[];
  currentUserId?: string | null;
  onRoleChange: (userId: string, role: PcivScopeMemberV1['role']) => void;
  onRemove: (userId: string) => void;
  onCopyInvite: () => void;
  isLoading: boolean;
}

const ScopeAccessPanel: React.FC<ScopeAccessPanelProps> = ({
  scopeId,
  members,
  currentUserId,
  onRoleChange,
  onRemove,
  onCopyInvite,
  isLoading
}) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Scope Access</h3>
        <button
          onClick={onCopyInvite}
          className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-weflora-teal"
        >
          Copy invite link
        </button>
      </div>

      <div className="text-[10px] text-slate-400">Scope: {scopeId}</div>

      {isLoading ? (
        <div className="text-xs text-slate-400">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="text-xs text-slate-400">No members found.</div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            return (
              <div key={member.userId} className="border border-slate-200 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-700">
                      {isSelf ? 'You' : member.userId.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-slate-400">Granted {new Date(member.createdAt).toLocaleDateString()}</span>
                  </div>
                  <select
                    value={member.role}
                    onChange={(event) => onRoleChange(member.userId, event.target.value as PcivScopeMemberV1['role'])}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-[10px]"
                  >
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => onRemove(member.userId)}
                    className="text-[10px] text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ScopeAccessPanel;
