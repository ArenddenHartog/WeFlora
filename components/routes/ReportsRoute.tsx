
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useChat } from '../../contexts/ChatContext';
import type { Report, ReportDocument, ChatMessage } from '../../types';
import { navigateToCreatedEntity } from '../../utils/navigation';
import ReportsHubView from '../ReportsHubView';
import ReportEditorView, { ManageReportPanel } from '../ReportEditorView';
import ReportWizard from '../ReportWizard';
import { ResizablePanel } from '../ResizablePanel';
import WritingAssistantPanel from '../WritingAssistantPanel';
import ChatView from '../ChatView';
import { 
    FileTextIcon, SlidersIcon, SparklesIcon, ChevronRightIcon
} from '../icons';

// Header Button Helper
const HeaderActionButton = ({ icon: Icon, label, active, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all shadow-sm whitespace-nowrap
            ${active 
                ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-dark' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }
        `}
    >
        <Icon className={`h-4 w-4 ${active ? 'text-weflora-teal' : 'text-weflora-teal'}`} />
        <span>{label}</span>
    </button>
);

interface ReportsRouteProps {
    onOpenDestinationModal: (type: 'report' | 'worksheet', message: ChatMessage) => void;
}

const ReportsRoute: React.FC<ReportsRouteProps> = ({ onOpenDestinationModal }) => {
    const { reportId } = useParams();
    const navigate = useNavigate();
    
    // Updated: Use explicit actions
    const { reports, createReport, updateReport, deleteReport, matrices } = useProject(); 
    
    const { reportTemplates, saveReportTemplate } = useData();
    const { entityThreads, sendEntityMessage, isGenerating } = useChat();
    const { showNotification } = useUI();

    // Local UI State
    const [rightPanel, setRightPanel] = useState<'none' | 'chat' | 'manage' | 'writing_assistant'>('none');
    const [panelWidth, setPanelWidth] = useState(400);
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    // Derived Data
    const standaloneReports = reports.filter(r => !r.projectId);
    const activeReport = reportId ? reports.find(r => r.id === reportId) : null;

    // --- Actions ---

    const handleCreate = async (report: Report) => {
        // Ensure it's marked as standalone
        const newReport = { ...report, projectId: undefined };
        const created = await createReport(newReport);
        if (!created) return null;
        console.info('[create-flow] draft report (reports hub)', {
            kind: 'report',
            withinProject: Boolean(created.projectId),
            projectId: created.projectId,
            reportId: created.id,
            tabId: Boolean(created.projectId) ? created.id : undefined
        });
        navigateToCreatedEntity({
            navigate,
            kind: 'report',
            withinProject: false,
            reportId: created.id
        });
        return created;
    };

    const handleUpdate = (updated: Report) => {
        updateReport(updated);
    };

    const handleDelete = (id: string) => {
        deleteReport(id);
        if (reportId === id) navigate('/reports');
    };

    const togglePanel = (panel: 'chat' | 'manage' | 'writing_assistant') => {
        setRightPanel(current => current === panel ? 'none' : panel);
    };

    // --- Entity Chat Handler ---
    const handleEntityChatSend = async (text: string, files?: File[]) => {
        if (!activeReport) return;
        
        // Inject Report Content
        const contextData = `
        Active Report: "${activeReport.title}"
        Content:
        ${activeReport.content.substring(0, 3000)} ${activeReport.content.length > 3000 ? '...(truncated)' : ''}
        `;

        await sendEntityMessage(activeReport.id, text, contextData, files);
    };

    const activeEntityMessages = activeReport ? (entityThreads[activeReport.id] || []) : [];

    // --- Render ---

    if (reportId && activeReport) {
        return (
            <div className="h-full flex flex-col bg-white relative">
                <div className="flex items-center justify-between px-6 py-0 border-b border-slate-200 bg-white h-16 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium">
                            <ChevronRightIcon className="h-4 w-4 rotate-180" /> Back
                        </button>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal">
                            <FileTextIcon className="h-5 w-5" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 truncate max-w-md">{activeReport.title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <HeaderActionButton icon={SlidersIcon} label="Settings" active={rightPanel === 'manage'} onClick={() => togglePanel('manage')} />
                        <HeaderActionButton icon={SparklesIcon} label="FloraGPT" active={rightPanel === 'chat'} onClick={() => togglePanel('chat')} />
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <ReportEditorView 
                        report={activeReport}
                        onUpdate={handleUpdate}
                        onClose={() => navigate('/reports')}
                        hideToolbar={true}
                        availableMatrices={matrices} // Pass all matrices for "Insert Data"
                        onToggleAssistant={() => togglePanel('writing_assistant')}
                    />
                </div>

                <ResizablePanel isOpen={rightPanel !== 'none'} onClose={() => setRightPanel('none')} width={panelWidth} setWidth={setPanelWidth} minWidth={320} maxWidth={800}>
                    {rightPanel === 'manage' && (
                        <ManageReportPanel report={activeReport} onUpdate={handleUpdate} onClose={() => setRightPanel('none')} />
                    )}
                    {rightPanel === 'writing_assistant' && (
                        <WritingAssistantPanel 
                            content={activeReport.content} 
                            onApply={(text) => handleUpdate({...activeReport, content: text, lastModified: new Date().toLocaleDateString()})} 
                            onClose={() => setRightPanel('none')} 
                        />
                    )}
                    {rightPanel === 'chat' && (
                        <div className="h-full bg-white flex flex-col">
                             <ChatView 
                                chat={{ id: `rep-chat-${activeReport.id}`, title: 'Report Assistant', description: 'Reading this document', icon: SparklesIcon, time: 'Now' }} 
                                messages={activeEntityMessages} 
                                onBack={() => setRightPanel('none')} 
                                onSendMessage={handleEntityChatSend} 
                                isGenerating={isGenerating} 
                                onRegenerateMessage={() => {}}
                                onOpenMenu={() => {}}
                                variant="panel"
                                onContinueInReport={(msg) => onOpenDestinationModal('report', msg)}
                                onContinueInWorksheet={(msg) => onOpenDestinationModal('worksheet', msg)}
                             />
                        </div>
                    )}
                </ResizablePanel>
            </div>
        );
    } else if (reportId && !activeReport) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-white">
                <p className="text-slate-500">Report not found.</p>
                <button onClick={() => navigate('/reports')} className="mt-4 text-weflora-teal hover:underline">Return to Hub</button>
            </div>
        );
    }

    // List View
    return (
        <>
            <ReportsHubView 
                reports={standaloneReports.filter(r => !r.parentId)} 
                templates={reportTemplates} 
                onOpenMenu={() => {}} 
                onOpenReport={(r) => navigate(`/reports/${r.id}`)} 
                onCreateReport={() => setIsWizardOpen(true)} 
                onCreateTemplate={saveReportTemplate} 
                onDeleteReport={handleDelete} 
                onUseTemplate={(t) => handleCreate({...t, id: `rep-${Date.now()}`, projectId: undefined, lastModified: new Date().toLocaleDateString(), tags: []})} 
            />
            {isWizardOpen && (
                <ReportWizard 
                    onClose={() => setIsWizardOpen(false)} 
                    onCreate={handleCreate} 
                    templates={reportTemplates} 
                />
            )}
        </>
    );
};

export default ReportsRoute;
