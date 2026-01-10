
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useChat } from '../../contexts/ChatContext';
import type { Report, ReportDocument, ChatMessage } from '../../types';
import { navigateToCreatedEntity } from '../../utils/navigation';
import ReportsHubView from '../ReportsHubView';
import { ManageReportPanel } from '../ReportEditorView';
import ReportWizard from '../ReportWizard';
import { ResizablePanel } from '../ResizablePanel';
import WritingAssistantPanel from '../WritingAssistantPanel';
import ChatView from '../ChatView';
import ReportContainer from '../ReportContainer';
import { 
    ChevronRightIcon,
    DatabaseIcon,
    FileTextIcon,
    SlidersIcon,
    SparklesIcon
} from '../icons';

// Header Button Helper
const HeaderActionButton = ({ icon: Icon, label, active, onClick, primary }: any) => (
    <button 
        onClick={onClick}
        className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all shadow-sm whitespace-nowrap
            ${primary
                ? 'bg-weflora-teal text-white border-weflora-teal hover:bg-weflora-dark'
                : active 
                    ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-dark' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }
        `}
    >
        <Icon className={`h-4 w-4 ${primary ? 'text-white' : 'text-weflora-teal'}`} />
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
    const [focusTabId, setFocusTabId] = useState<string | undefined>(undefined);
    const [activeTabReportId, setActiveTabReportId] = useState<string | null>(null);

    // Derived Data
    const standaloneReports = reports.filter(r => !r.projectId);
    const activeRootReport = reportId ? reports.find(r => r.id === reportId) : null;

    const reportDoc: ReportDocument | null = useMemo(() => {
        if (!activeRootReport) return null;
        const allTabs = reports.filter(r => r.id === activeRootReport.id || r.parentId === activeRootReport.id);
        const root = allTabs.find(t => t.id === activeRootReport.id);
        const children = allTabs
            .filter(t => t.id !== activeRootReport.id)
            .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
        const tabs = root ? [root, ...children] : children;
        return {
            id: activeRootReport.id,
            projectId: undefined,
            title: activeRootReport.title,
            createdAt: activeRootReport.lastModified || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tabs
        };
    }, [activeRootReport, reports]);

    const activeReport = useMemo(() => {
        if (!reportDoc) return null;
        const id = activeTabReportId || reportDoc.id;
        return reportDoc.tabs.find(t => t.id === id) || reportDoc.tabs[0] || null;
    }, [activeTabReportId, reportDoc]);

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

    const handleUpdateDoc = async (doc: ReportDocument) => {
        if (!activeRootReport) return;
        const currentTabs = reports.filter(r => r.id === doc.id || r.parentId === doc.id);
        const newTabs = doc.tabs;

        // Update title of root if changed
        if (activeRootReport.title !== doc.title) {
            handleUpdate({ ...activeRootReport, title: doc.title });
        }

        for (const tab of newTabs) {
            const existing = currentTabs.find(t => t.id === tab.id);
            if (!existing) {
                const created = await createReport({ ...tab, projectId: undefined, parentId: doc.id });
                if (created?.id) setFocusTabId(created.id);
            } else if (JSON.stringify(existing) !== JSON.stringify(tab)) {
                handleUpdate(tab);
            }
        }

        currentTabs.forEach(oldTab => {
            if (!newTabs.find(t => t.id === oldTab.id)) {
                handleDelete(oldTab.id);
            }
        });
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

    if (reportId && activeRootReport && reportDoc && activeReport) {
        return (
            <div className="h-full flex flex-col bg-white relative">
                <header className="flex-none h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium">
                            <ChevronRightIcon className="h-4 w-4 rotate-180" /> Back
                        </button>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal">
                            <FileTextIcon className="h-5 w-5" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 truncate max-w-md">{activeRootReport.title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <HeaderActionButton icon={DatabaseIcon} label="Files" active={false} onClick={() => navigate('/files')} />
                        <HeaderActionButton icon={SlidersIcon} label="Settings" active={rightPanel === 'manage'} onClick={() => togglePanel('manage')} />
                        <button
                            onClick={() => togglePanel('chat')}
                            className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors border ${
                                rightPanel === 'chat'
                                    ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10'
                            }`}
                            title="Assistant"
                        >
                            <SparklesIcon className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative">
                    <ReportContainer
                        document={reportDoc}
                        initialActiveTabId={focusTabId}
                        onUpdateDocument={handleUpdateDoc}
                        onClose={() => {}}
                        availableMatrices={matrices}
                        onToggleAssistant={() => togglePanel('writing_assistant')}
                        onActiveReportIdChange={(id) => setActiveTabReportId(id)}
                        hideHeader={true}
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
