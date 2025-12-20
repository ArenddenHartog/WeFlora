
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { 
    PinnedProject, Matrix, Report, Task, TeamComment, 
    WorksheetDocument, ReportDocument, Member, MatrixRow
} from '../types';
import { 
    DatabaseIcon, FileTextIcon,
    SparklesIcon, SlidersIcon, FolderIcon, ChevronRightIcon,
    UploadIcon, PencilIcon, TableIcon, XIcon, HomeIcon
} from './icons';
import ProjectTeamView from './ProjectTeamView';
import ChatView from './ChatView';
import { ResizablePanel } from './ResizablePanel';
import WorksheetContainer from './WorksheetContainer';
import ReportContainer from './ReportContainer';
import ManageWorksheetPanel from './ManageWorksheetPanel';
import { ManageReportPanel } from './ReportEditorView';
import WorksheetWizard from './WorksheetWizard';
import ReportWizard from './ReportWizard';
import WritingAssistantPanel from './WritingAssistantPanel'; 
import SpeciesIntelligencePanel from './SpeciesIntelligencePanel';
import ProjectOverview from './ProjectOverview';
import ProjectHeader from './ProjectHeader';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useChat } from '../contexts/ChatContext';
import { useUI } from '../contexts/UIContext';
import { useProject } from '../contexts/ProjectContext';
import { useData } from '../contexts/DataContext';
import { aiService } from '../services/aiService';
import { navigateToCreatedEntity } from '../utils/navigation';

const EmptyState = ({ 
    icon: Icon, 
    title, 
    description, 
    actionLabel, 
    onAction 
}: { 
    icon: any, title: string, description: string, actionLabel: string, onAction: () => void 
}) => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white m-4">
        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
            <Icon className="h-8 w-8 opacity-30 text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 max-w-xs text-center mb-6">{description}</p>
        <button 
            onClick={onAction}
            className="px-6 py-2.5 bg-weflora-teal text-white rounded-xl hover:bg-weflora-dark font-bold transition-colors shadow-sm text-sm"
        >
            {actionLabel}
        </button>
    </div>
);

// Removed props interface as it now self-sources data
const ProjectWorkspace: React.FC = () => {
    // Navigation & Params
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    const projectId = params.projectId;
    
    // Hooks
    const { 
        projects, matrices: allMatrices, reports: allReports, files: allFiles, tasks: allTasks, comments: allComments,
        createMatrix, updateMatrix, deleteMatrix, createReport, updateReport, deleteReport, 
        updateProject, uploadProjectFile, deleteProjectFile, resolveProjectFile,
        setTasks, setComments // Legacy setters for tasks/comments
    } = useProject();
    
    const { species, worksheetTemplates, reportTemplates } = useData();
    const { setActiveThreadId, chats, messages, isGenerating, sendMessage } = useChat();
    const { showNotification, selectedChatId, openDestinationModal, openFilePreview } = useUI(); // Added openFilePreview
    
    // --- Data Filtering ---
    const project = projects.find(p => p.id === projectId);
    const matrices = useMemo(() => allMatrices.filter(m => m.projectId === projectId), [allMatrices, projectId]);
    const reports = useMemo(() => allReports.filter(r => r.projectId === projectId), [allReports, projectId]);
    const files = useMemo(() => allFiles[projectId || ''] || [], [allFiles, projectId]);
    const tasks = useMemo(() => allTasks.filter(t => t.projectId === projectId), [allTasks, projectId]);
    const comments = useMemo(() => allComments.filter(c => c.projectId === projectId), [allComments, projectId]);
    
    const selectedChat = selectedChatId ? (chats[projectId || ''] || []).find(c => c.id === selectedChatId) : null;

    // --- State ---
    const subPath = params['*'] || ''; 
    const currentTab = subPath.split('/')[0] || 'overview';
    const activeTab = ['overview', 'files', 'worksheets', 'reports', 'team'].includes(currentTab) 
        ? currentTab as 'overview' | 'files' | 'worksheets' | 'reports' | 'team' 
        : 'overview';

    const [isWorksheetWizardOpen, setIsWorksheetWizardOpen] = useState(false);
    const [isReportWizardOpen, setIsReportWizardOpen] = useState(false);
    const [rightPanel, setRightPanel] = useState<'none' | 'chat' | 'manage' | 'writing_assistant' | 'entity'>('none');
    const [panelWidth, setPanelWidth] = useState(400);
    // Removed local previewFile state
    const [inspectedEntity, setInspectedEntity] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingDeleteFileId, setPendingDeleteFileId] = useState<string | null>(null);

    // Focus state for "new tab created" redirects (passed via navigate state)
    const [focusedWorksheetTabId, setFocusedWorksheetTabId] = useState<string | undefined>(undefined);
    const [focusedReportTabId, setFocusedReportTabId] = useState<string | undefined>(undefined);

    useEffect(() => {
        const navState = location.state as any;
        if (typeof navState?.focusWorksheetTabId === 'string') {
            setFocusedWorksheetTabId(navState.focusWorksheetTabId);
        }
        if (typeof navState?.focusReportTabId === 'string') {
            setFocusedReportTabId(navState.focusReportTabId);
        }
    }, [location.state]);

    // Sync tab navigation
    const handleTabChange = (tab: string) => {
        if (!projectId) return;
        navigate(`/project/${projectId}/${tab}`);
    };

    if (!project || !projectId) return <div className="p-8 text-center text-slate-400">Project not found.</div>;

    // --- Handlers ---

    const toggleChat = () => {
        setRightPanel(current => {
            if (current === 'chat') return 'none';
            setActiveThreadId(null);
            return 'chat';
        });
    };
    
    const toggleManage = () => setRightPanel(current => current === 'manage' ? 'none' : 'manage');
    const togglePanel = (panel: 'chat' | 'manage' | 'writing_assistant' | 'entity') => {
        setRightPanel(current => {
            if (current === panel) return 'none';
            if (panel === 'chat') setActiveThreadId(null);
            return panel;
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach(f => uploadProjectFile(f, projectId));
        }
    };

    const handleDeleteFile = (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        setPendingDeleteFileId(fileId);
    };

    const handleAddSpeciesToWorksheet = (data: any) => {
        let targetMatrix = matrices[0];
        if (!targetMatrix) {
            targetMatrix = {
                id: `mtx-${Date.now()}`,
                projectId: project.id,
                title: 'Species List',
                columns: [
                    { id: 'c1', title: 'Species', type: 'text', width: 200, isPrimaryKey: true },
                    { id: 'c2', title: 'Common Name', type: 'text', width: 150 },
                    { id: 'c3', title: 'Notes', type: 'text', width: 300 }
                ],
                rows: []
            };
            createMatrix(targetMatrix);
        }

        const newRow: MatrixRow = {
            id: `row-${Date.now()}`,
            entityName: data.scientificName,
            cells: {
                [targetMatrix.columns[0].id]: { columnId: targetMatrix.columns[0].id, value: data.scientificName || '' },
                [targetMatrix.columns[1]?.id]: { columnId: targetMatrix.columns[1]?.id, value: data.commonName || '' },
                [targetMatrix.columns[2]?.id]: { columnId: targetMatrix.columns[2]?.id, value: data.insight || '' }
            }
        };

        const updatedMatrix = {
            ...targetMatrix,
            rows: [...targetMatrix.rows, newRow]
        };
        updateMatrix(updatedMatrix);
        showNotification(`Added ${data.scientificName} to ${targetMatrix.title}`, 'success');
        handleTabChange('worksheets');
    };

    // Virtual Documents
    const projectWorksheetDoc: WorksheetDocument = useMemo(() => ({
        id: project.id,
        projectId: project.id,
        title: project.name, 
        createdAt: project.date,
        updatedAt: new Date().toISOString(),
        tabs: matrices
    }), [project, matrices]);

    const handleUpdateWorksheetDoc = (doc: WorksheetDocument) => {
        const currentIds = new Set(matrices.map(m => m.id));
        const newIds = new Set(doc.tabs.map(t => t.id));
        
        doc.tabs.forEach(tab => {
            if (currentIds.has(tab.id)) updateMatrix(tab);
            else createMatrix({ ...tab, projectId: project.id });
        });

        matrices.forEach(m => {
            if (!newIds.has(m.id)) deleteMatrix(m.id);
        });
    };

    const projectReportDoc: ReportDocument = useMemo(() => ({
        id: project.id,
        projectId: project.id,
        title: 'Project Reports',
        createdAt: project.date,
        updatedAt: new Date().toISOString(),
        tabs: reports
    }), [project, reports]);

    const handleUpdateReportDoc = (doc: ReportDocument) => {
        const currentIds = new Set(reports.map(r => r.id));
        const newIds = new Set(doc.tabs.map(t => t.id));

        doc.tabs.forEach(tab => {
            if (currentIds.has(tab.id)) updateReport(tab);
            else createReport({ ...tab, projectId: project.id });
        });

        reports.forEach(r => {
            if (!newIds.has(r.id)) deleteReport(r.id);
        });
    };

    const handleCreateWorksheetFromWizard = async (matrix: Matrix) => {
        const result = await createMatrix({ ...matrix, projectId: project.id });
        console.info('[create-flow] build worksheet (project)', {
            kind: 'worksheet',
            withinProject: true,
            projectId: project.id,
            matrixId: result.matrixId,
            tabId: result.tabId
        });
        navigateToCreatedEntity({
            navigate,
            kind: 'worksheet',
            withinProject: true,
            projectId: project.id,
            matrixId: result.matrixId,
            focusTabId: result.tabId
        });
        setIsWorksheetWizardOpen(false);
        return result;
    };

    const handleCreateReportFromWizard = async (report: Report) => {
        const result = await createReport({ ...report, projectId: project.id });
        console.info('[create-flow] draft report (project)', {
            kind: 'report',
            withinProject: true,
            projectId: project.id,
            reportId: result.reportId,
            tabId: result.tabId
        });
        navigateToCreatedEntity({
            navigate,
            kind: 'report',
            withinProject: true,
            projectId: project.id,
            reportId: result.reportId,
            focusTabId: result.tabId
        });
        setIsReportWizardOpen(false);
        return result;
    };

    const renderRightPanelContent = () => {
        if (rightPanel === 'chat') {
            return (
                <div className="h-full flex flex-col bg-white">
                    <ChatView 
                        chat={selectedChat || { id: 'proj-chat', title: 'Ask FloraGPT', description: 'Ask about this project', icon: SparklesIcon, time: 'Now' }} 
                        messages={messages} 
                        onBack={() => setRightPanel('none')}
                        onSendMessage={sendMessage}
                        isGenerating={isGenerating}
                        onRegenerateMessage={() => {}}
                        onOpenMenu={() => {}}
                        variant="panel"
                        contextProjectId={project.id}
                        onContinueInReport={(msg) => openDestinationModal('report', msg)}
                        onContinueInWorksheet={(msg) => openDestinationModal('worksheet', msg)}
                    />
                </div>
            );
        }
        if (rightPanel === 'manage') {
            if (activeTab === 'worksheets') {
                const matrixToManage = matrices.length > 0 ? matrices[0] : undefined; 
                return <ManageWorksheetPanel matrix={matrixToManage} onUpdate={updateMatrix} onClose={() => setRightPanel('none')} onUpload={(fs) => fs.forEach(f => uploadProjectFile(f, projectId))} />;
            }
            if (activeTab === 'reports') {
                const report = reports.length > 0 ? reports[0] : undefined;
                if (report) return <ManageReportPanel report={report} onUpdate={updateReport} onClose={() => setRightPanel('none')} />;
            }
            return <div className="p-6 text-center text-slate-400">Select a worksheet or report to view settings.</div>;
        }
        if (rightPanel === 'writing_assistant') {
            const activeReport = reports.length > 0 ? reports[0] : undefined;
            if (activeReport) {
                return (
                    <WritingAssistantPanel 
                        content={activeReport.content}
                        onApply={(newText) => updateReport({ ...activeReport, content: newText, lastModified: new Date().toLocaleDateString() })}
                        onClose={() => setRightPanel('none')}
                    />
                );
            }
            return <div className="p-6 text-center text-slate-400">Open a report to use the Writing Assistant.</div>;
        }
        if (rightPanel === 'entity' && inspectedEntity) {
            return (
                <SpeciesIntelligencePanel 
                    speciesName={inspectedEntity} 
                    speciesList={species} 
                    onClose={() => setRightPanel('none')} 
                    onAskAI={(query) => { 
                        sendMessage(query, undefined, undefined, undefined, []); 
                        setRightPanel('chat'); 
                    }}
                    onAddToWorksheet={handleAddSpeciesToWorksheet}
                />
            );
        }
        return null;
    };

    const projectContextSummary = `Project Name: ${project.name}. Description: Urban forestry project.`; 

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <ProjectOverview 
                        project={project} 
                        matrices={matrices} 
                        reports={reports} 
                        files={files} 
                    />
                );
            case 'files':
                return (
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center p-6 pb-0">
                            <h2 className="text-lg font-bold text-slate-800">Project Files</h2>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium transition-colors shadow-sm"
                            >
                                <UploadIcon className="h-4 w-4" />
                                <span>Upload Files</span>
                            </button>
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        </div>
                        
                        {files.length === 0 ? (
                            <EmptyState 
                                icon={DatabaseIcon} 
                                title="No Files Yet" 
                                description="Upload documents, datasets, or images to this project." 
                                actionLabel="Upload File" 
                                onAction={() => fileInputRef.current?.click()} 
                            />
                        ) : (
                            <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto">
                                {files.map(file => (
                                    <div key={file.id} onClick={() => openFilePreview(file)} className="flex flex-col items-center p-4 bg-slate-50 hover:bg-white border border-slate-200 hover:border-weflora-teal rounded-xl cursor-pointer transition-all hover:shadow-sm group text-center relative">
                                        <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                            <file.icon className="h-6 w-6 text-slate-500 group-hover:text-weflora-teal" />
                                        </div>
                                        <div className="font-bold text-sm text-slate-800 line-clamp-2 mb-1">{file.name}</div>
                                        <div className="text-xs text-slate-400">{file.size} • {file.date}</div>
                                        <button 
                                            onClick={(e) => handleDeleteFile(e, file.id)}
                                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-weflora-red hover:bg-weflora-red/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete File"
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'worksheets':
                if (matrices.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center h-full">
                            <EmptyState 
                                icon={TableIcon} 
                                title="No Worksheets" 
                                description="Start analyzing data with AI-powered worksheets." 
                                actionLabel="Build Worksheet" 
                                onAction={() => setIsWorksheetWizardOpen(true)} 
                            />
                        </div>
                    );
                }
                return (
                    <WorksheetContainer 
                        document={projectWorksheetDoc}
                        initialActiveTabId={focusedWorksheetTabId}
                        onUpdateDocument={handleUpdateWorksheetDoc}
                        onRunAICell={aiService.runAICell}
                        onAnalyze={aiService.analyzeDocuments}
                        speciesList={species}
                        onOpenManage={() => setRightPanel('manage')}
                        onClose={() => {}}
                        projectFiles={files}
                        onUpload={(fs) => fs.forEach(f => uploadProjectFile(f, projectId))}
                        projectContext={projectContextSummary}
                        onResolveFile={resolveProjectFile}
                        onInspectEntity={(entity) => {
                            setInspectedEntity(entity);
                            setRightPanel('entity');
                        }}
                    />
                );
            case 'reports':
                if (reports.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center h-full">
                            <EmptyState 
                                icon={FileTextIcon} 
                                title="No Reports" 
                                description="Draft a new report to document your findings." 
                                actionLabel="Draft Report" 
                                onAction={() => setIsReportWizardOpen(true)} 
                            />
                        </div>
                    );
                }
                return (
                    <ReportContainer 
                        document={projectReportDoc}
                        initialActiveTabId={focusedReportTabId}
                        onUpdateDocument={handleUpdateReportDoc}
                        onClose={() => {}}
                        availableMatrices={allMatrices} 
                        onToggleAssistant={() => togglePanel('writing_assistant')} 
                    />
                );
            case 'team':
                return (
                    <ProjectTeamView 
                        members={project.members || []} 
                        tasks={tasks} 
                        comments={comments} 
                        projectId={project.id} 
                        onCreateTask={(t) => setTasks(prev => [t, ...prev])} // Using legacy setter for now
                        onToggleTaskStatus={(tid) => setTasks(prev => prev.map(t => t.id === tid ? { ...t, status: t.status === 'Done' ? 'Todo' : 'Done' } : t))}
                        onCreateComment={(txt) => setComments(prev => [{ id: `c-${Date.now()}`, text: txt, memberId: 'me', projectId: project.id, timestamp: new Date().toLocaleString() }, ...prev])}
                        onInviteMember={(email) => updateProject({...project, members: [...project.members, { id: email, name: email.split('@')[0], initials: email.substring(0,2).toUpperCase() }]})}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div className="flex flex-col h-full bg-weflora-mint relative">
                <ProjectHeader
                    projectName={project.name || project.id}
                    activeTab={activeTab === 'files' ? 'files' : activeTab}
                    onBackToProjects={() => navigate('/projects')}
                    onNavigateTab={(tab) => {
                        if (tab === 'overview') handleTabChange('overview');
                        else handleTabChange(tab);
                    }}
                    onToggleSettings={() => {
                        if (activeTab === 'worksheets' || activeTab === 'reports') toggleManage();
                        else showNotification('Project settings are available in Worksheets or Reports.', 'success');
                    }}
                    onToggleAsk={toggleChat}
                    canShowSettings={(activeTab === 'worksheets' && matrices.length > 0) || (activeTab === 'reports' && reports.length > 0)}
                />

                <div className="flex-1 overflow-hidden bg-white relative">
                    {renderContent()}
                </div>

                <ResizablePanel isOpen={rightPanel !== 'none'} onClose={() => setRightPanel('none')} width={panelWidth} setWidth={setPanelWidth}>
                    {renderRightPanelContent()}
                </ResizablePanel>
            </div>

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteFileId)}
                title="Delete project file?"
                description={`This will permanently delete "${
                    pendingDeleteFileId ? (files.find(f => f.id === pendingDeleteFileId)?.name || 'this file') : 'this file'
                }" from the project. This cannot be undone.`}
                confirmLabel="Delete file"
                onCancel={() => setPendingDeleteFileId(null)}
                onConfirm={() => {
                    if (!pendingDeleteFileId) return;
                    deleteProjectFile(pendingDeleteFileId, projectId);
                    setPendingDeleteFileId(null);
                }}
            />

            {isWorksheetWizardOpen && (
                <WorksheetWizard 
                    onClose={() => setIsWorksheetWizardOpen(false)} 
                    onCreate={handleCreateWorksheetFromWizard} 
                    onDiscover={aiService.discoverStructures} 
                    onAnalyze={aiService.analyzeDocuments} 
                    templates={worksheetTemplates} 
                    speciesList={species} 
                    onFileSave={(file) => uploadProjectFile(file.file!, projectId)} 
                />
            )}
            {isReportWizardOpen && (
                <ReportWizard 
                    onClose={() => setIsReportWizardOpen(false)} 
                    onCreate={handleCreateReportFromWizard} 
                    templates={reportTemplates} 
                />
            )}
        </>
    );
};

export default ProjectWorkspace;
