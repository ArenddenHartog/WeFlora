import React from 'react';
import type { PcivCommittedContext, PcivStage } from '../../../src/decision-program/pciv/v0/types';
import PCIVFlow from './PCIVFlow';

export interface PCIVModalProps {
  isOpen: boolean;
  projectId?: string | null;
  userId?: string | null;
  initialStage?: PcivStage;
  onClose: () => void;
  onComplete: (commit: PcivCommittedContext) => void;
}

const PCIVModal: React.FC<PCIVModalProps> = ({
  isOpen,
  projectId,
  userId,
  initialStage,
  onClose,
  onComplete
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" data-testid="pciv-modal">
      <div className="w-full max-w-6xl h-[90vh] rounded-2xl bg-white shadow-xl overflow-hidden">
        {projectId ? (
          <PCIVFlow
            projectId={projectId}
            userId={userId}
            initialStage={initialStage}
            onCancel={onClose}
            onComplete={onComplete}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
            <h2 className="text-lg font-semibold text-slate-800">Select a project to start context intake</h2>
            <p className="text-sm text-slate-500">A project is required before importing or mapping context.</p>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PCIVModal;
