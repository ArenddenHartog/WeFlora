
import React from 'react';
import { DatabaseIcon, SlidersIcon, WeFloraAskIcon, PencilIcon } from './icons';

type PanelType = 'none' | 'chat' | 'manage' | 'files' | 'entity' | 'writing_assistant';

interface ViewToolbarProps {
    rightPanel: PanelType;
    setRightPanel: (panel: PanelType) => void;
    context?: 'worksheet' | 'report' | 'none';
}

const ViewToolbar: React.FC<ViewToolbarProps> = ({ rightPanel, setRightPanel, context = 'none' }) => {
    return (
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setRightPanel(rightPanel === 'files' ? 'none' : 'files')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    rightPanel === 'files'
                    ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-weflora-mint/10 hover:text-weflora-teal hover:border-weflora-teal'
                }`}
                title="Toggle Files Panel"
            >
                <DatabaseIcon className={`h-4 w-4 ${rightPanel === 'files' ? 'text-weflora-teal-dark' : 'text-weflora-teal'}`} />
                <span className="hidden sm:inline">Files</span>
            </button>

            {context === 'worksheet' && (
                <button 
                    onClick={() => setRightPanel(rightPanel === 'manage' ? 'none' : 'manage')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        rightPanel === 'manage'
                        ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-weflora-mint/10 hover:text-weflora-teal hover:border-weflora-teal'
                    }`}
                    title="Toggle Manage Worksheet Panel"
                >
                    <SlidersIcon className={`h-4 w-4 ${rightPanel === 'manage' ? 'text-weflora-teal-dark' : 'text-weflora-teal'}`} />
                    <span className="hidden sm:inline">Manage Worksheet</span>
                </button>
            )}

            {context === 'report' && (
                <button 
                    onClick={() => setRightPanel(rightPanel === 'manage' ? 'none' : 'manage')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        rightPanel === 'manage'
                        ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-weflora-mint/10 hover:text-weflora-teal hover:border-weflora-teal'
                    }`}
                    title="Toggle Manage Report Panel"
                >
                    <PencilIcon className={`h-4 w-4 ${rightPanel === 'manage' ? 'text-weflora-teal-dark' : 'text-weflora-teal'}`} />
                    <span className="hidden sm:inline">Manage Report</span>
                </button>
            )}

            <button 
                onClick={() => setRightPanel(rightPanel === 'chat' ? 'none' : 'chat')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    rightPanel === 'chat'
                    ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200'
                }`}
                title="Toggle AI Chat"
            >
                <WeFloraAskIcon className={`h-4 w-4 ${rightPanel === 'chat' ? 'text-weflora-teal-dark' : 'text-purple-600'}`} />
                <span className="hidden sm:inline">Ask FloraGPT</span>
            </button>
        </div>
    );
};

export default ViewToolbar;
