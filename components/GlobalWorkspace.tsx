
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { 
    ViewMode, PinnedProject, Matrix, Report, 
    ContextItem, Chat
} from '../types';
import HomeView from './HomeView';
import AppPage from './AppPage';
import ProjectsView from './ProjectsView';
import ChatView from './ChatView';
import KnowledgeBaseView from './KnowledgeBaseView';
import PromptTemplatesView from './PromptTemplatesView';
import ResearchHistoryView from './ResearchHistoryView';
import WorksheetWizard from './WorksheetWizard';
import ReportWizard from './ReportWizard';
import BaseModal from './BaseModal';
import { FolderIcon, MenuIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { useProject } from '../contexts/ProjectContext';
import { useChat } from '../contexts/ChatContext';
import { useUI } from '../contexts/UIContext';
import { aiService } from '../services/aiService';
import { navigateToCreatedEntity } from '../utils/navigation';

interface GlobalWorkspaceProps {
    view: ViewMode;
    // Handlers that are still passed from main content or can be migrated
    onNavigate: (view: string) => void;
    onSelectProject: (id: string) => void;
    onOpenMenu: () => void;
    onOpenDestinationModal: (type: 'report' | 'worksheet', message: any) => void;
}

const GlobalWorkspace: React.FC<GlobalWorkspaceProps> = ({
    view, onNavigate, onSelectProject, onOpenMenu, onOpenDestinationModal
}) => {
    const navigate = useNavigate();
    // Hooks
    const { 
        projects: pinnedProjects, createProject,
        files: allFiles, matrices: allMatrices, reports: allReports,
        createMatrix, deleteMatrix, createReport, deleteReport, 
        updateMatrix, updateReport, uploadProjectFile, deleteProjectFile
    } = useProject();
    
    const { 
        knowledgeItems, deleteKnowledgeItem, currentWorkspace, 
        promptTemplates, savePromptTemplate, reportTemplates, 
        worksheetTemplates, saveWorksheetTemplate, saveReportTemplate,
        species, recentItems 
    } = useData();
    
    const { 
        chats, threads, activeThreadId, isGenerating, messages,
        sendMessage, setActiveThreadId
    } = useChat();

    const { selectedChatId, sessionOpenOrigin, setSessionOpenOrigin } = useUI();

    // Derived Data
    const standaloneMatrices = useMemo(() => allMatrices.filter(m => !m.projectId), [allMatrices]);
    const standaloneReports = useMemo(() => allReports.filter(r => !r.projectId), [allReports]);
    const selectedChat = selectedChatId ? (Object.values(chats).flat() as Chat[]).find(c => c.id === selectedChatId) : null;

    // Wizard States
    const [isCreateWorksheetOpen, setIsCreateWorksheetOpen] = useState(false);
    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    
    // Project Creation Form State
    const [newProjName, setNewProjName] = useState('');
    const [newProjStatus, setNewProjStatus] = useState<'Active' | 'Archived'>('Active');
    const [newProjDate, setNewProjDate] = useState(new Date().toISOString().split('T')[0]);

    const handleCreateProjectSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newProjName.trim()) return;

        const newProject: PinnedProject = {
            id: `new-${Date.now()}`,
            name: newProjName,
            icon: FolderIcon,
            status: newProjStatus,
            date: newProjDate,
            workspaceId: currentWorkspace.id, 
            members: []
        };
        const created = await createProject(newProject);
        if (!created) return;
        console.info('[project-created]', { source: 'home', id: created.id });
        setIsCreateProjectOpen(false);
        setNewProjName('');
        setNewProjStatus('Active');
        setNewProjDate(new Date().toISOString().split('T')[0]);
    };

    const handleCreateWorksheet = async (matrix: Matrix) => {
        const created = await createMatrix({ ...matrix, projectId: undefined }); // Standalone
        if (!created) return null;
        console.info('[create-flow] build worksheet (home)', {
            kind: 'worksheet',
            withinProject: Boolean(created.projectId),
            projectId: created.projectId,
            matrixId: created.id,
            tabId: Boolean(created.projectId) ? created.id : undefined
        });
        navigateToCreatedEntity({
            navigate,
            kind: 'worksheet',
            withinProject: false,
            matrixId: created.id
        });
        setIsCreateWorksheetOpen(false);
        return created;
    };

    const handleCreateReport = async (report: Report) => {
        const created = await createReport({ ...report, projectId: undefined });
        if (!created) return null;
        console.info('[create-flow] draft report (home)', {
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
        setIsCreateReportOpen(false);
        return created;
    };

    switch (view) {
        case 'home':
            return (
                <>
                    <HomeView
                        pinnedProjects={pinnedProjects}
                        recentItems={recentItems}
                        activeThreadId={activeThreadId}
                        threads={threads}
                        onSelectProject={onSelectProject}
                        onSendQuery={(text, files, instructions, model, contextItems) => 
                            sendMessage(text, files, instructions, model, contextItems, 'home')
                        }
                        onOpenMenu={onOpenMenu}
                        onOpenCreateWorksheet={() => setIsCreateWorksheetOpen(true)}
                        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
                        onCreateReport={() => setIsCreateReportOpen(true)}
                        onPromoteToProject={() => {}}
                        onCopyContentToReport={(msg) => onOpenDestinationModal('report', msg)}
                        onCopyContentToWorksheet={(msg) => onOpenDestinationModal('worksheet', msg)}
                        isGenerating={isGenerating}
                        onBack={sessionOpenOrigin === 'sessions' ? () => {
                            setSessionOpenOrigin(null);
                            setActiveThreadId(null);
                            navigate('/research-history');
                        } : undefined}
                    />
                    {isCreateWorksheetOpen && (
                        <WorksheetWizard 
                            onClose={() => setIsCreateWorksheetOpen(false)} 
                            onCreate={handleCreateWorksheet} 
                            onDiscover={aiService.discoverStructures} 
                            onAnalyze={aiService.analyzeDocuments} 
                            templates={worksheetTemplates} 
                            speciesList={species} 
                            onFileSave={(file) => uploadProjectFile(file.file!, 'generic')} 
                        />
                    )}
                    {isCreateReportOpen && (
                        <ReportWizard 
                            onClose={() => setIsCreateReportOpen(false)} 
                            onCreate={handleCreateReport} 
                            templates={reportTemplates} 
                        />
                    )}
                    <BaseModal isOpen={isCreateProjectOpen} onClose={() => setIsCreateProjectOpen(false)} title="Create New Project" size="md" footer={<><button onClick={() => setIsCreateProjectOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button><button onClick={handleCreateProjectSubmit} className="px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium text-sm shadow-sm transition-colors">Create Project</button></>}>
                        <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label><input autoFocus type="text" required value={newProjName} onChange={(e) => setNewProjName(e.target.value)} placeholder="e.g., AMS-West Site Analysis" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label><select value={newProjStatus} onChange={(e) => setNewProjStatus(e.target.value as any)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"><option value="Active">Active</option><option value="Archived">Archived</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" value={newProjDate} onChange={(e) => setNewProjDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900" /></div>
                            </div>
                        </form>
                    </BaseModal>
                </>
            );
        case 'projects':
            return (
                <ProjectsView
                    projects={pinnedProjects}
                    onSelectProject={onSelectProject}
                    onOpenMenu={onOpenMenu}
                    onCreateProject={async (p) => {
                        const created = await createProject({ ...p, workspaceId: currentWorkspace.id });
                        if (created) console.info('[project-created]', { source: 'projects-hub', id: created.id });
                        return created;
                    }}
                />
            );
        case 'chat':
            if (selectedChat) return (
                <AppPage
                    title={selectedChat.title || 'Chat'}
                    actions={null}
                    toolbar={
                        <div className="flex items-center gap-3">
                            <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                                <MenuIcon className="h-6 w-6" />
                            </button>
                        </div>
                    }
                >
                    <ChatView
                        chat={selectedChat}
                        messages={messages}
                        onBack={() => onNavigate('home')}
                        onSendMessage={sendMessage}
                        isGenerating={isGenerating}
                        onOpenMenu={onOpenMenu}
                        onRegenerateMessage={() => {}}
                        onContinueInReport={(msg) => onOpenDestinationModal('report', msg)}
                        onContinueInWorksheet={(msg) => onOpenDestinationModal('worksheet', msg)}
                        showHeader={false}
                    />
                </AppPage>
            );
            return <div className="p-10 text-center text-slate-400">Chat not found</div>;
        case 'knowledge_base':
            return (
                <KnowledgeBaseView 
                    items={knowledgeItems} 
                    projectFiles={allFiles} 
                    projects={pinnedProjects} 
                    onOpenMenu={onOpenMenu} 
                    onUpload={(files, pid) => files.forEach(f => uploadProjectFile(f, pid || 'generic'))} 
                    onDelete={(item: any) => {
                        if (item.source === 'project') deleteProjectFile(item.id, item.projectId || 'generic');
                        else if (item.source === 'knowledge') deleteKnowledgeItem(item.id);
                    }} 
                    onAskAI={(item) => { 
                        const contextItem: ContextItem = { id: `ctx-${item.id}`, name: 'name' in item ? item.name : item.title, source: 'knowledge', itemId: item.id }; 
                        sendMessage(`Analyze this file: ${contextItem.name}`, undefined, undefined, undefined, [contextItem], 'home', false, true); 
                        onNavigate('chat'); 
                    }} 
                />
            );
        case 'prompts':
            return <PromptTemplatesView items={promptTemplates} onOpenMenu={onOpenMenu} onUseTemplate={(tpl) => { sendMessage(tpl.templateText, undefined, tpl.systemInstruction, undefined, []); onNavigate('home'); }} onCreateTemplate={savePromptTemplate} />;
        case 'research_history':
            return <ResearchHistoryView onOpenMenu={onOpenMenu} />;
        default:
            return <div>Unknown View</div>;
    }
};

export default GlobalWorkspace;
