
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { 
    PinnedProject, Chat, ProjectFile, Matrix, Report, 
    ChatMessage, DiscoveredStructure, MatrixColumn
} from '../types';
import GlobalWorkspace from './GlobalWorkspace';
import ProjectWorkspace from './ProjectWorkspace';
import WorksheetsRoute from './routes/WorksheetsRoute';
import ReportsRoute from './routes/ReportsRoute';
import GlobalLayout from './GlobalLayout';
import BaseModal from './BaseModal';
import { DatabaseIcon, FolderIcon, PlusIcon, CheckIcon, SparklesIcon, RefreshIcon } from './icons';
import { aiService } from '../services/aiService';
import { useProject } from '../contexts/ProjectContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

// Props reduced to minimal handlers if any
interface MainContentProps {
    onNavigate: (view: string) => void;
    onSelectProject: (id: string) => void;
    onOpenMenu: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ 
    onNavigate, onSelectProject, onOpenMenu 
}) => {
    // Hooks for data access
    const { projects, createMatrix, createReport, setProjects } = useProject();
    const { currentWorkspace } = useData();
    const { showNotification, destinationModal, openDestinationModal, closeDestinationModal } = useUI();

    // Wrappers to handle logic for Destination Modal
    const handleCreateMatrix = (newM: Matrix, dest?: { type: 'project' | 'standalone' | 'new_project', projectId?: string, newProjectName?: string }) => {
        let finalProjectId = dest?.projectId || newM.projectId;
        
        if (dest?.type === 'new_project' && dest.newProjectName) {
            const newProjId = `proj-${Date.now()}`;
            finalProjectId = newProjId;
            const newProj: PinnedProject = {
                id: newProjId,
                name: dest.newProjectName,
                icon: FolderIcon, 
                status: 'Active',
                date: new Date().toISOString().split('T')[0],
                workspaceId: currentWorkspace.id,
                members: []
            };
            setProjects(prev => [newProj, ...prev]);
            onSelectProject(newProjId);
        } else if (dest?.type === 'project' && dest.projectId) {
            onSelectProject(dest.projectId);
        }

        const matrixWithProject = { ...newM, projectId: finalProjectId };
        createMatrix(matrixWithProject);
    };

    const handleCreateReport = (newR: Report, dest?: { type: 'project' | 'standalone' | 'new_project', projectId?: string, newProjectName?: string }) => {
        let finalProjectId = dest?.projectId || newR.projectId;

        if (dest?.type === 'new_project' && dest.newProjectName) {
            const newProjId = `proj-${Date.now()}`;
            finalProjectId = newProjId;
            const newProj: PinnedProject = {
                id: newProjId,
                name: dest.newProjectName,
                icon: FolderIcon, 
                status: 'Active',
                date: new Date().toISOString().split('T')[0],
                workspaceId: currentWorkspace.id,
                members: []
            };
            setProjects(prev => [newProj, ...prev]);
            onSelectProject(newProjId);
        } else if (dest?.type === 'project' && dest.projectId) {
            onSelectProject(dest.projectId);
        }

        const reportWithProject = { ...newR, projectId: finalProjectId };
        createReport(reportWithProject);
    };

    // --- Modal Logic (using UI Context state) ---
    
    const [destMode, setDestMode] = useState<'general' | 'project' | 'new'>('general');
    const [selectedDestProject, setSelectedDestProject] = useState('');
    const [newDestProjectName, setNewDestProjectName] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    // Effect to reset state when modal opens
    useEffect(() => {
        if (destinationModal.isOpen) {
            setDestMode('general');
            setSelectedDestProject('');
            setNewDestProjectName('');
            setIsExtracting(false);
        }
    }, [destinationModal.isOpen]);

    const handleOpenDestinationModal = (type: 'report' | 'worksheet', message: ChatMessage) => {
        openDestinationModal(type, message);
    };

    const handleConfirmDest = async () => {
        const { type, message } = destinationModal;
        if (!message) return;

        let destination: { type: 'project' | 'standalone' | 'new_project', projectId?: string, newProjectName?: string };

        if (destMode === 'project') {
            if (!selectedDestProject) {
                alert("Please select a project.");
                return;
            }
            destination = { type: 'project', projectId: selectedDestProject };
        } else if (destMode === 'new') {
            if (!newDestProjectName.trim()) {
                alert("Please enter a project name.");
                return;
            }
            destination = { type: 'new_project', newProjectName: newDestProjectName.trim() };
        } else {
            destination = { type: 'standalone' };
        }

        if (type === 'report') {
            const report: Report = {
                id: `rep-chat-${Date.now()}`,
                title: 'AI Chat Report',
                content: message.text,
                lastModified: new Date().toLocaleDateString(),
                tags: ['ai-import']
            };
            handleCreateReport(report, destination);
            closeDestinationModal();
            showNotification('Report created from chat');
        } else {
            setIsExtracting(true);
            try {
                const result = await aiService.structureTextAsMatrix(message.text);
                const newMatrix: Matrix = {
                    id: `mtx-chat-${Date.now()}`,
                    title: 'Extracted Data',
                    description: 'Generated from chat analysis',
                    columns: result.columns,
                    rows: result.rows
                };
                handleCreateMatrix(newMatrix, destination);
                showNotification('Worksheet created from chat');
            } catch (error) {
                console.error("Extraction failed", error);
                const fallbackMatrix = {
                    id: `mtx-chat-${Date.now()}`,
                    title: 'Raw Content',
                    columns: [{ id: 'c1', title: 'Content', type: 'text' as const, width: 600, isPrimaryKey: true }],
                    rows: [{ id: 'r1', cells: { c1: { columnId: 'c1', value: message.text } } }]
                };
                handleCreateMatrix(fallbackMatrix, destination);
                showNotification('Worksheet created (raw mode)');
            } finally {
                setIsExtracting(false);
                closeDestinationModal();
            }
        }
    };

    const sharedProps = {
        onNavigate,
        onSelectProject,
        onOpenMenu,
        onOpenDestinationModal: handleOpenDestinationModal,
    };

    return (
        <>
            <Routes>
                {/* Global Routes wrapped in Global Layout */}
                <Route element={<GlobalLayout />}>
                    <Route path="/" element={<GlobalWorkspace view="home" {...sharedProps} />} />
                    <Route path="/projects" element={<GlobalWorkspace view="projects" {...sharedProps} />} />
                    <Route path="/sessions" element={<GlobalWorkspace view="research_history" {...sharedProps} />} />
                    <Route path="/chat" element={<GlobalWorkspace view="chat" {...sharedProps} />} />
                    <Route path="/files" element={<GlobalWorkspace view="knowledge_base" {...sharedProps} />} />
                    <Route path="/prompts" element={<GlobalWorkspace view="prompts" {...sharedProps} />} />
                </Route>
                
                {/* Standalone Editors (Have their own headers) */}
                <Route path="/worksheets/*" element={<WorksheetsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                <Route path="/worksheets/:matrixId" element={<WorksheetsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                <Route path="/reports/*" element={<ReportsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                <Route path="/reports/:reportId" element={<ReportsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                
                {/* Project Workspace */}
                <Route path="/project/:projectId/*" element={<ProjectWorkspace />} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Destination Picker Modal */}
            <BaseModal
                isOpen={destinationModal.isOpen}
                onClose={() => !isExtracting && closeDestinationModal()}
                title={`Save to ${destinationModal.type === 'report' ? 'Report' : 'Worksheet'}`}
                size="sm"
                footer={
                    <>
                        <button 
                            onClick={() => closeDestinationModal()}
                            disabled={isExtracting}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmDest}
                            disabled={isExtracting}
                            className="px-6 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-bold text-sm shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
                        >
                            {isExtracting ? (
                                <>
                                    <RefreshIcon className="h-4 w-4 animate-spin" />
                                    Extracting...
                                </>
                            ) : (
                                <span>{destinationModal.type === 'worksheet' ? 'Extract & Save' : 'Save Content'}</span>
                            )}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 pt-2">
                    {isExtracting ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <SparklesIcon className="h-10 w-10 text-weflora-teal mb-4 animate-pulse" />
                            <h3 className="text-sm font-bold text-slate-800">Analyzing Content</h3>
                            <p className="text-xs text-slate-500 mt-1">FloraGPT is structuring the data into columns and rows...</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-500">
                                Choose where you want to save this content.
                                {destinationModal.type === 'worksheet' && " FloraGPT will intelligently extract and structure tabular data for you."}
                            </p>

                            <div className="space-y-3">
                                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${destMode === 'general' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <input type="radio" name="destMode" className="hidden" checked={destMode === 'general'} onChange={() => setDestMode('general')} />
                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                        <DatabaseIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-800">General Library</div>
                                        <div className="text-xs text-slate-500">Create as standalone item</div>
                                    </div>
                                    {destMode === 'general' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                </label>

                                <label className={`flex flex-col gap-3 p-3 border rounded-lg cursor-pointer transition-all ${destMode === 'project' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3 w-full">
                                        <input type="radio" name="destMode" className="hidden" checked={destMode === 'project'} onChange={() => setDestMode('project')} />
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                            <FolderIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-800">Existing Project</div>
                                            <div className="text-xs text-slate-500">Add to an active project</div>
                                        </div>
                                        {destMode === 'project' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                    </div>
                                    
                                    {destMode === 'project' && (
                                        <select 
                                            value={selectedDestProject}
                                            onChange={(e) => setSelectedDestProject(e.target.value)}
                                            className="w-full mt-2 p-2 bg-white border border-weflora-teal/30 rounded-lg text-sm text-slate-900 outline-none focus:ring-1 focus:ring-weflora-teal"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="" disabled>Select Project...</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </label>

                                <label className={`flex flex-col gap-3 p-3 border rounded-lg cursor-pointer transition-all ${destMode === 'new' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3 w-full">
                                        <input type="radio" name="destMode" className="hidden" checked={destMode === 'new'} onChange={() => setDestMode('new')} />
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                            <PlusIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-800">New Project</div>
                                            <div className="text-xs text-slate-500">Create a new project container</div>
                                        </div>
                                        {destMode === 'new' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                    </div>

                                    {destMode === 'new' && (
                                        <input 
                                            type="text" 
                                            placeholder="Project Name..." 
                                            value={newDestProjectName}
                                            onChange={(e) => setNewDestProjectName(e.target.value)}
                                            className="w-full mt-2 p-2 bg-white border border-weflora-teal/30 rounded-lg text-sm text-slate-900 outline-none focus:ring-1 focus:ring-weflora-teal"
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    )}
                                </label>
                            </div>
                        </>
                    )}
                </div>
            </BaseModal>
        </>
    );
};

export default MainContent;
