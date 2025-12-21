
import React, { useEffect, useState } from 'react';
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
    SparklesIcon
} from '../icons';

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
    const { showNotification, topBarCommand, clearTopBarCommand } = useUI();

    // Local UI State
    const [rightPanel, setRightPanel] = useState<'none' | 'chat' | 'manage' | 'writing_assistant'>('none');
    const [panelWidth, setPanelWidth] = useState(400);
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    useEffect(() => {
        if (!topBarCommand) return;
        if (topBarCommand.type === 'openReportsWizard') {
            setIsWizardOpen(true);
            clearTopBarCommand();
            return;
        }
        if (topBarCommand.type === 'reportTogglePanel') {
            if (topBarCommand.panel === 'settings') togglePanel('manage');
            if (topBarCommand.panel === 'ask') togglePanel('chat');
            clearTopBarCommand();
        }
    }, [topBarCommand, clearTopBarCommand]);

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
