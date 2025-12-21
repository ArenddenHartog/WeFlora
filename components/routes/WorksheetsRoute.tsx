
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useChat } from '../../contexts/ChatContext';
import { aiService } from '../../services/aiService';
import type { Matrix, WorksheetDocument, ChatMessage, MatrixRow } from '../../types';
import { navigateToCreatedEntity } from '../../utils/navigation';
import WorksheetTemplatesView from '../WorksheetTemplatesView';
import WorksheetContainer from '../WorksheetContainer';
import WorksheetWizard from '../WorksheetWizard';
import { ResizablePanel } from '../ResizablePanel';
import ChatView from '../ChatView';
import ManageWorksheetPanel from '../ManageWorksheetPanel';
import SpeciesIntelligencePanel from '../SpeciesIntelligencePanel';
import { 
    DatabaseIcon, SlidersIcon, SparklesIcon, ChevronRightIcon, 
    TableIcon, XIcon, LeafIcon
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

interface WorksheetsRouteProps {
    onOpenDestinationModal: (type: 'report' | 'worksheet', message: ChatMessage) => void;
}

const WorksheetsRoute: React.FC<WorksheetsRouteProps> = ({ onOpenDestinationModal }) => {
    const { matrixId } = useParams();
    const navigate = useNavigate();
    
    // Updated: Use explicit actions
    const { matrices, createMatrix, updateMatrix, deleteMatrix, uploadProjectFile, files: projectFiles, resolveProjectFile } = useProject();
    
    const { worksheetTemplates, saveWorksheetTemplate, species, addSpecies } = useData();
    const { entityThreads, sendEntityMessage, isGenerating } = useChat();
    const { showNotification } = useUI();

    // Local UI State
    const [rightPanel, setRightPanel] = useState<'none' | 'chat' | 'manage' | 'files' | 'entity' | 'species'>('none');
    const [panelWidth, setPanelWidth] = useState(400);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [inspectedEntity, setInspectedEntity] = useState<string | null>(null);

    // Derived Data
    const standaloneMatrices = matrices.filter(m => !m.projectId);
    const activeMatrix = matrixId ? matrices.find(m => m.id === matrixId) : null;

    // --- Actions ---

    const handleCreate = async (matrix: Matrix) => {
        // Ensure it's marked as standalone
        const newMatrix = { ...matrix, projectId: undefined };
        const created = await createMatrix(newMatrix);
        if (!created) return null;
        console.info('[create-flow] build worksheet (worksheets hub)', {
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
        return created;
    };

    const handleUpdate = (updated: Matrix) => {
        updateMatrix(updated);
    };

    const handleDelete = (id: string) => {
        deleteMatrix(id);
        if (matrixId === id) navigate('/worksheets');
    };

    // Virtual Document Wrapper for Container
    const worksheetDoc: WorksheetDocument | null = activeMatrix ? {
        id: activeMatrix.id,
        projectId: undefined,
        title: activeMatrix.title,
        description: activeMatrix.description,
        createdAt: activeMatrix.updatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tabs: matrices.filter(m => m.id === activeMatrix.id || m.parentId === activeMatrix.id)
            .sort((a, b) => (a.id === activeMatrix.id ? -1 : 1))
    } : null;

    const handleUpdateDoc = (doc: WorksheetDocument) => {
        const currentTabs = matrices.filter(m => m.id === doc.id || m.parentId === doc.id);
        const newTabs = doc.tabs;

        // Update title of root if changed
        if (activeMatrix && activeMatrix.title !== doc.title) {
            handleUpdate({ ...activeMatrix, title: doc.title });
        }

        // Handle Tab CRUD
        newTabs.forEach(tab => {
            const existing = currentTabs.find(t => t.id === tab.id);
            if (!existing) {
                // Mark as standalone if parent has no project
                createMatrix({ ...tab, projectId: undefined });
            } else if (JSON.stringify(existing) !== JSON.stringify(tab)) {
                handleUpdate(tab);
            }
        });

        currentTabs.forEach(oldTab => {
            if (!newTabs.find(t => t.id === oldTab.id)) {
                handleDelete(oldTab.id);
            }
        });
    };

    const togglePanel = (panel: 'chat' | 'manage' | 'files' | 'species') => {
        setRightPanel(current => current === panel ? 'none' : panel);
    };

    // --- Entity Chat Handler ---
    const handleEntityChatSend = async (text: string, files?: File[]) => {
        if (!activeMatrix) return;
        
        // Serialize Matrix Data for Context
        const contextData = `
        Active Worksheet: "${activeMatrix.title}"
        Columns: ${activeMatrix.columns.map(c => c.title).join(', ')}
        Rows Count: ${activeMatrix.rows.length}
        Data Preview (First 5 rows):
        ${activeMatrix.rows.slice(0, 5).map(r => 
            activeMatrix.columns.map(c => `${c.title}: ${r.cells[c.id]?.value}`).join(' | ')
        ).join('\n')}
        `;

        await sendEntityMessage(activeMatrix.id, text, contextData, files);
    };

    const handleAddSpeciesToWorksheet = (data: any) => {
        if (!activeMatrix) return;

        // Find primary key column (first column usually)
        const primaryCol = activeMatrix.columns.find(c => c.isPrimaryKey) || activeMatrix.columns[0];
        
        if (!primaryCol) {
            showNotification("Worksheet has no columns.", 'error');
            return;
        }

        // Construct new row
        const newRow: MatrixRow = {
            id: `row-${Date.now()}`,
            entityName: data.scientificName,
            cells: {}
        };

        // Populate cells by matching column titles loosely
        activeMatrix.columns.forEach(col => {
            const title = col.title.toLowerCase();
            let val = '';
            
            if (col.id === primaryCol.id) val = data.scientificName;
            else if (title.includes('common')) val = data.commonName;
            else if (title.includes('family')) val = data.family;
            else if (title.includes('height')) val = data.height;
            else if (title.includes('spread')) val = data.spread;
            else if (title.includes('soil')) val = data.soilPreference;
            else if (title.includes('water')) val = data.waterNeeds;
            else if (title.includes('sun') || title.includes('exposure')) val = data.sunExposure;
            else if (title.includes('note') || title.includes('description')) val = data.insight;

            newRow.cells[col.id] = { columnId: col.id, value: val };
        });

        const updatedMatrix = {
            ...activeMatrix,
            rows: [...activeMatrix.rows, newRow]
        };
        handleUpdate(updatedMatrix);
        showNotification(`Added ${data.scientificName} to worksheet.`, 'success');
    };

    const activeEntityMessages = activeMatrix ? (entityThreads[activeMatrix.id] || []) : [];

    // --- Render ---

    if (matrixId && activeMatrix && worksheetDoc) {
        return (
            <div className="h-full flex flex-col bg-white relative">
                {/* Editor Header */}
                <header className="flex-none h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/worksheets')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium">
                            <ChevronRightIcon className="h-4 w-4 rotate-180" /> Back
                        </button>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal">
                            <TableIcon className="h-5 w-5" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 truncate max-w-md">{activeMatrix.title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                         <HeaderActionButton icon={LeafIcon} label="Species" active={rightPanel === 'species'} onClick={() => togglePanel('species')} />
                         <HeaderActionButton icon={DatabaseIcon} label="Files" active={rightPanel === 'files'} onClick={() => togglePanel('files')} />
                         <HeaderActionButton icon={SlidersIcon} label="Settings" active={rightPanel === 'manage'} onClick={() => togglePanel('manage')} />
                         <HeaderActionButton icon={SparklesIcon} label="FloraGPT" active={rightPanel === 'chat'} onClick={() => togglePanel('chat')} />
                    </div>
                </header>

                <div className="flex-1 flex min-w-0 relative overflow-hidden">
                    <div className="flex-1 min-w-0 h-full">
                        <WorksheetContainer 
                            document={worksheetDoc}
                            onUpdateDocument={handleUpdateDoc}
                            onRunAICell={(p, f) => aiService.runAICell(p, f)}
                            onAnalyze={(f, c, cols) => aiService.analyzeDocuments(f, c, cols)}
                            onClose={() => navigate('/worksheets')}
                            speciesList={species}
                            onOpenManage={() => togglePanel('manage')} 
                            projectFiles={Object.values(projectFiles).flat()}
                            onUpload={(files) => files.forEach(f => uploadProjectFile(f, 'generic'))}
                            onResolveFile={resolveProjectFile}
                            onInspectEntity={(entity) => {
                                setInspectedEntity(entity);
                                setRightPanel('species');
                            }}
                        />
                    </div>
                </div>

                <ResizablePanel isOpen={rightPanel !== 'none'} onClose={() => setRightPanel('none')} width={panelWidth} setWidth={setPanelWidth} minWidth={320} maxWidth={800}>
                    {rightPanel === 'manage' && (
                        <ManageWorksheetPanel matrix={activeMatrix} onUpdate={handleUpdate} onClose={() => setRightPanel('none')} onUpload={(files) => files.forEach(f => uploadProjectFile(f, 'generic'))} />
                    )}
                    {rightPanel === 'chat' && (
                        <div className="h-full bg-white flex flex-col">
                             <ChatView 
                                chat={{ id: `ws-chat-${activeMatrix.id}`, title: 'Worksheet Assistant', description: 'Analyzing this sheet', icon: SparklesIcon, time: 'Now' }} 
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
                    {rightPanel === 'files' && (
                        <div className="flex flex-col h-full bg-slate-50">
                            <header className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                                <div className="font-bold text-slate-800 flex items-center gap-2"><DatabaseIcon className="h-5 w-5 text-weflora-teal"/> Global Files</div>
                                <button onClick={() => setRightPanel('none')}><XIcon className="h-5 w-5 text-slate-400"/></button>
                            </header>
                            <div className="p-8 text-center text-slate-400">Select a project to access specific files.</div>
                        </div>
                    )}
                    {rightPanel === 'species' && (
                        <SpeciesIntelligencePanel 
                            speciesName={inspectedEntity || ""} 
                            speciesList={species} 
                            onClose={() => setRightPanel('none')} 
                            onAskAI={(query) => { 
                                // Redirect question to chat
                                togglePanel('chat');
                                setTimeout(() => handleEntityChatSend(query), 100); 
                            }}
                            onAddToWorksheet={handleAddSpeciesToWorksheet}
                            onSaveToLibrary={addSpecies}
                        />
                    )}
                </ResizablePanel>
            </div>
        );
    }

    // List View
    return (
        <>
            <WorksheetTemplatesView 
                items={worksheetTemplates} 
                standaloneMatrices={standaloneMatrices.filter(m => !m.parentId)} 
                onOpenMenu={() => {}} 
                onUseTemplate={(t) => handleCreate({ ...t, id: `mtx-${Date.now()}`, rows: t.rows || [] })} 
                onCreateTemplate={saveWorksheetTemplate} 
                onDeleteMatrix={handleDelete} 
                onOpenMatrix={(m) => navigate(`/worksheets/${m.id}`)} 
                onOpenCreateWorksheet={() => setIsWizardOpen(true)} 
            />
            {isWizardOpen && (
                <WorksheetWizard 
                    onClose={() => setIsWizardOpen(false)} 
                    onCreate={handleCreate} 
                    onDiscover={(f) => aiService.discoverStructures(f)} 
                    onAnalyze={(f, c, cols) => aiService.analyzeDocuments(f, c, cols)} 
                    templates={worksheetTemplates} 
                    speciesList={species} 
                    onFileSave={(f) => uploadProjectFile(f.file!, 'generic')} 
                />
            )}
        </>
    );
};

export default WorksheetsRoute;
